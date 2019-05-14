import Network from "../network/Network";
import NetworkController from "./controller/NetworkController";
import Transaction from "../../models/Transaction";
import KeyPair from "../../models/KeyPair";
import { getMilestoneTransaction, validateTransaction, applyTransaction, saveTransaction, getTransactionById } from "./lib/services/TransactionService";
import { configuration } from "../../Configuration";
import Walker from "./lib/Walker";
import createGenesisTransaction from "./lib/transaction/createGenesisTransaction";
import EventHandler from "../network/lib/EventHandler";
import Ipfs from "../../services/wrappers/Ipfs";
import { databaseGetAll } from "../../services/DatabaseService";
import { isProofOfWorkValid } from "../../services/transaction/ProofOfWork";
import * as Logger from 'js-logger';

const GENESIS_MILESTONE = 1;
const TRANSACTION_AMOUNT_TO_VALIDATE = 2;

class Dag extends EventHandler {
    networkController: NetworkController;
    walker: Walker;
    ipfs: Ipfs;

    constructor(network: Network) {
        super();
        this.networkController = new NetworkController(this, network);
        this.walker = new Walker();
        this.ipfs = Ipfs.getInstance(configuration.ipfs);
    }

    /**
     * Validated and adds the transaction to the database
     *
     * @param {Transaction} transaction
     * @memberof Dag
     */
    async addTransaction(transaction: Transaction, fromPeerId: string) {
        try {
            // Make sure we are not storing duplicates.
            const isTransactionInDatabase = !!(await getTransactionById(transaction.id));

            if (isTransactionInDatabase) {
                Logger.debug(`Transaction ${transaction.id} already received`);
                return;
            }

            // Send the transaction to the rest of the nodes.
            this.networkController.network.broadcastTransaction(transaction, [fromPeerId]);

            Logger.debug('Received transaction ', transaction.id);

            await validateTransaction(transaction);

            // Let the rest of the application know it's valid.
            this.trigger('transactionAdded', {
                transaction,
            });
        } catch (error) {
            Logger.warn('Transaction with id', transaction.id, 'failed', error);
        }
    }

    /**
     * Submits a transaction to the dag (From a user perspective)
     *
     * @param {Transaction} transaction
     * @param {KeyPair} keyPair
     * @memberof Dag
     */
    async submitTransaction(transaction: Transaction, keyPair: KeyPair) {
        const parentTransactions = await this.walker.getTransactionToValidate(1, TRANSACTION_AMOUNT_TO_VALIDATE);
        await transaction.addParents(parentTransactions);

        transaction.sign(keyPair);
        transaction.proofOfWork();

        await validateTransaction(transaction);
        this.networkController.broadcastTransaction(transaction);
    }

    /**
     * Synchronises to a peer
     *
     * @param {number} beginMilestoneIndex
     * @param {string} peerId
     * @memberof Dag
     */
    async synchroniseTo(beginMilestoneIndex: number, peerId: string) {
        // TODO: Synchronise from the beginMilestoneIndex instead of sending all.
        const stream = databaseGetAll({
            selector: {
                timestamp: {
                    $gte: 0,
                }
            }
        });

        stream.on('data', (chunk: Buffer) => {
            this.networkController.sendTransactionSyncString(chunk.toString(), peerId);
        })
        // this.networkController.sendTransaction();
    }

    /**
     * Synchronises between nodes to get the latest transaction information
     * It should not represent the Account state.
     *
     * @memberof Dag
     */
    async synchronise() {
        let genesisTransaction = await getMilestoneTransaction(GENESIS_MILESTONE);

        if (!genesisTransaction) {
            genesisTransaction = createGenesisTransaction();
            await applyTransaction(genesisTransaction);
        }

        // Find the highest milestone we currently have and ask a node to get data up to the next milestone.
        this.networkController.broadcastSynchroniseRequest(0);
    }

    async onTransactionSyncMessage(transaction: Transaction) {
        try {
            // TODO: Check more than only the PoW.
            if (!isProofOfWorkValid(transaction.id, transaction.nonce)) {
                console.error(`Transaction [${transaction.id}] is invalid. Not adding.`);
                return;
            }

            await saveTransaction(transaction);
        } catch (error) {

        }
    }
}

export default Dag;
