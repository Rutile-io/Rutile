import Network from "../network/Network";
import NetworkController from "./controller/NetworkController";
import Transaction from "../../models/Transaction";
import { validateTransaction, applyTransaction } from "../../services/TransactionService";

class Dag {
    networkController: NetworkController;

    constructor(network: Network) {
        this.networkController = new NetworkController(this, network);
    }

    /**
     * Validated and adds the transaction to the database
     *
     * @param {Transaction} transaction
     * @memberof Dag
     */
    async addTransaction(transaction: Transaction) {
        try {
            await validateTransaction(transaction);
            await applyTransaction(transaction);
        } catch (error) {
            console.error('[DAG]: Transaction adding failed: ', error);
        }
    }

    /**
     * Synchronises between nodes to get the latest transaction information
     * It should not represent the Account state.
     *
     * @memberof Dag
     */
    sync() {

    }
}

export default Dag;
