import * as Logger from 'js-logger';
import Dag from "../dag/Dag";
import Transaction from "../../models/Transaction";
import Account from "../../models/Account";
import MilestoneWalker from './lib/MilestoneWalker';

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
    milestoneWalker: MilestoneWalker;

    constructor(dag: Dag) {
        this.dag = dag;
    }

    async onTransactionAdded(transaction: Transaction) {
        // Once a transaction is added we should adjust our milestone view
        await this.milestoneWalker.findNext();
        console.log('[] this.milestoneWalker -> ', this.milestoneWalker);
    }

    // async prepareNextBlock() {
    //     // Looking for blocks..
    //     const block = new Block({
    //         number: this.currentMilestone.milestoneIndex + 1,
    //     });

    //     // TODO: Should add transactions that change the state of the shards..
    //     const randomReferenceBlock = await this.dag.walker.getTransactionsToValidate(this.currentBlock.number, 1);
    //     const blocksToAdd = [this.currentBlock];
    //     blocksToAdd.push(...randomReferenceBlock);

    //     block.addParents(blocksToAdd);
    //     block.proofOfWork(true);
    // }

    async start() {
        // First find the very first transaction
        const firstTransaction = await Transaction.getByMilestoneIndex(1);
        this.milestoneWalker = new MilestoneWalker(firstTransaction);
        this.milestoneWalker.findNext();

        // Let the rest of the application know it's valid.
        this.dag.on('transactionAdded', (transaction: Transaction) => this.onTransactionAdded(transaction));
    }
}

export default Milestone;
