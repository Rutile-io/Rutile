import * as Logger from 'js-logger';
import Dag from "../chain/Chain";
import Transaction from "../../models/Transaction";
import Account from "../../models/Account";
import { databaseGetById } from '../../services/DatabaseService';
import Block from '../../models/Block';

/**
 * Milestone represents the main chain inside the network.
 * All shards originate from this chain
 *
 * @class Milestone
 */
class Milestone {
    currentMilestone: Transaction;
    nextValidator: Account;
    dag: Dag;

    constructor(dag: Dag) {
        this.dag = dag;
    }

    async getLatestMilestoneBlock() {
        const milestoneRaw = await databaseGetById('currentMilestone');

        // Just return the genesis milestone if we never run before
        if (!milestoneRaw) {
            return Block.getByNumber(1);
        }

        return Block.fromRaw(milestoneRaw.value);
    }

    async onTransactionAdded(transaction: Transaction) {
        // Once a transaction is added we should adjust our milestone view
        // await this.milestoneWalker.findNext();
    }

    async start() {
        // First find the very first transaction
        const latestMilestoneBlock = await this.getLatestMilestoneBlock();

        // Let the rest of the application know it's valid.
        this.dag.on('transactionAdded', (transaction: Transaction) => this.onTransactionAdded(transaction));
    }
}

export default Milestone;
