import Network from "../network/Network";
import NetworkController from "./controller/NetworkController";
import Transaction from "../../models/Transaction";
import KeyPair from "../../models/KeyPair";
import { getMilestoneTransaction, validateTransaction, applyTransaction } from "./lib/services/TransactionService";
import { configuration } from "../../Configuration";
import Walker from "./lib/Walker";
import createGenesisTransaction from "./lib/transaction/createGenesisTransaction";
import EventHandler from "../network/lib/EventHandler";

const GENESIS_MILESTONE = 1;

class Dag extends EventHandler {
    networkController: NetworkController;
    walker: Walker;

    constructor(network: Network) {
        super();
        this.networkController = new NetworkController(this, network);
        this.walker = new Walker(configuration.genesis.config.minimumParentsValidation);
    }

    /**
     * Validated and adds the transaction to the database
     *
     * @param {Transaction} transaction
     * @memberof Dag
     */
    async addTransaction(transaction: Transaction) {
        try {
            console.log('[DAG]: Received transaction..' ,transaction);
            await validateTransaction(transaction);
            console.log('[DAG]: Transaction is valid, adding to db.');
            this.trigger('transactionAdded', {
                transaction,
            });
        } catch (error) {
            console.error('[DAG]: Transaction adding failed: ', error);
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
        const transactions = await this.walker.getTransactionToValidate(1);
        await transaction.addParents(transactions[0], transactions[1]);
        transaction.sign(keyPair);
        transaction.proofOfWork();
        await validateTransaction(transaction);
        this.networkController.broadcastTransaction(transaction);
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

    }
}

export default Dag;
