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
import { databaseGetAll, databaseRemove } from "../../services/DatabaseService";
import { isProofOfWorkValid } from "../../services/transaction/ProofOfWork";
import * as Logger from 'js-logger';
import TipValidator from "./lib/TipValidator";

const GENESIS_MILESTONE = 1;
const TRANSACTION_AMOUNT_TO_VALIDATE = 2;

class Dag extends EventHandler {
    networkController: NetworkController;
    walker: Walker;
    ipfs: Ipfs;
    tipValidator: TipValidator;

    constructor(network: Network) {
        super();

        this.networkController = new NetworkController(this, network);
        this.walker = new Walker();
        this.ipfs = Ipfs.getInstance(configuration.ipfs);
        this.tipValidator = new TipValidator();
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

            Logger.debug(`Received transaction 0x${transaction.id}`);

            // Send the transaction to the rest of the nodes.
            this.networkController.network.broadcastTransaction(transaction, [fromPeerId]);

            await validateTransaction(transaction);
            await applyTransaction(transaction);

            // Let the rest of the application know it's valid.
            this.trigger('transactionAdded', {
                transaction,
            });
        } catch (error) {
            Logger.warn('Transaction with id', transaction.id, 'failed', error);
        }
    }

    async getAccountBalance(address: string) {
        const walkedTransactions = await this.walker.getTransactionToValidate(1, 1);
        const balances = await this.tipValidator.generateAccountBalances(walkedTransactions[0].id);

        return balances;
    }

    /**
     * Submits a transaction to the dag (From a user perspective)
     *
     * @param {Transaction} transaction
     * @param {KeyPair} keyPair
     * @memberof Dag
     */
    async submitTransaction(transaction: Transaction, keyPair: KeyPair, depth: number = 0) {
        // We have tried searching 10 times for a tip but couldn't find a valid one
        // user should submit it on a later time..
        if (depth > 5) {
            throw new Error(`Could not find valid transaction tip after ${depth} tries`);
        }

        // Find transactions using the random weighted walk
        const parentTransactions = await this.walker.getTransactionToValidate(1, TRANSACTION_AMOUNT_TO_VALIDATE);

        // Validate these transactions by searching for a path that allows the user to spend this amount.
        const invalidTransaction = await this.tipValidator.validateTransactionBalances(parentTransactions);


        // One of the tips is considered invalid and should not be used
        // We retry to submit our transaction to a different tip
        if (invalidTransaction) {
            depth += 1;

            Logger.debug(`Transaction ${invalidTransaction.id} was not considered valid and will be deleted`);
            await databaseRemove(invalidTransaction.id);

            // Now retry our tip selection without the bad transaction in the way
            await this.submitTransaction(transaction, keyPair, depth);
            return;
        }

        Logger.debug(`Attaching to ${parentTransactions.map(t => t.id)}`);
        await transaction.addParents(parentTransactions);

        transaction.sign(keyPair);

        Logger.debug(`Applying PoW to transaction ${transaction.id}`);
        transaction.proofOfWork();

        Logger.debug(`Executing transaction ${transaction.id}`);
        const result = await transaction.execute();

        // Make sure all is ok with our transaction before sending it off
        Logger.debug(`Re-validating transaction before sending ${transaction.id}`);
        await validateTransaction(transaction);

        Logger.debug(`Applying transaction ${transaction.id}`);
        await applyTransaction(transaction);

        // Apply the transaction to our local node
        this.networkController.broadcastTransaction(transaction);

        return result;
    }

    /**
     * Synchronises to a peer
     *
     * @param {number} beginMilestoneIndex
     * @param {string} peerId
     * @memberof Dag
     */
    async synchroniseTo(beginMilestoneIndex: number, peerId: string) {
        Logger.debug(`Synchronising to peer ${peerId} starting from ${beginMilestoneIndex}`);

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
            genesisTransaction = await createGenesisTransaction();
            await applyTransaction(genesisTransaction);
        }

        // Make sure we have a peer that can accept the request
        this.networkController.network.one('peerConnected', () => {
            // Find the highest milestone we currently have and ask a node to get data up to the next milestone.
            Logger.info('Requesting synchronisation');
            this.networkController.broadcastSynchroniseRequest(0);
        });
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
