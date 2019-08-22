import * as Logger from 'js-logger';
import Transaction from "../../../models/Transaction";
import getTransactionCumulativeWeights from "../../dag/lib/services/CumulativeWeightService";
import Dag from '../../dag/Dag';
import { Results } from '../../rvm/context';
import Snapshot from '../../snapshot/Snapshot';
import { startDatabase, databaseCreate, createOrUpdate, databaseFind, databaseGetById } from '../../../services/DatabaseService';

/**
 * The milestone walker walks upon all the transactions of the DAG
 * trying to find out the heaviest branch, this allows for a main chain to be created
 *
 * @class MilestoneWalker
 */
class MilestoneWalker {
    dag: Dag;
    currentMilestone: Transaction;
    milestoneList: string[];

    constructor(lastKnownMilestone: Transaction, dag: Dag) {
        this.currentMilestone = lastKnownMilestone;
        this.dag = dag;
    }

    static async getLatestMilestone() {
        const milestoneRaw = await databaseGetById('currentMilestone');

        // Just return the genesis milestone if we never run before
        if (!milestoneRaw) {
            return Transaction.getByMilestoneIndex(1);
        }

        return Transaction.fromRaw(milestoneRaw.value);
    }

    /**
     * Creates a milestone chain starting with the given transaction
     *
     * @param {Transaction} startTransaction
     * @param {Map<string, number>} cumulativeWeights
     * @param {Transaction[]} [milestoneList=[]]
     * @returns {Promise<Transaction[]>}
     * @memberof MilestoneWalker
     */
    async updateMilestoneChain(startTransaction: Transaction, cumulativeWeights: Map<string, number>, milestoneList: Transaction[] = []): Promise<Transaction[]> {
        const children = await Transaction.getChildren(startTransaction.id);

        let heighestWeightedChild: Transaction = null;
        let heighestWeight: number = 0;
        const transactionsToBeSaved: Transaction[] = [];

        // Now pick the highest weighted transaction which will be our next milestone
        for (let index = 0; index < children.length; index++) {
            const childTx = children[index];
            const childWeight = cumulativeWeights.get(childTx.id);

            // We know that because we are updating the chain it's temp
            // So we should remove our previous few until we are confident enough
            // to commit to it
            if (childTx.milestoneIndex !== null) {
                childTx.milestoneIndex = null;
                transactionsToBeSaved.push(childTx);
            }

            if (childWeight > heighestWeight) {
                heighestWeight = childWeight;
                heighestWeightedChild = childTx;
            }
        }

        if (!heighestWeightedChild) {
            return milestoneList;
        }

        // Update our milestone index view
        heighestWeightedChild.milestoneIndex = startTransaction.milestoneIndex + 1;

        if (!transactionsToBeSaved.includes(heighestWeightedChild)) {
            transactionsToBeSaved.push(heighestWeightedChild);
        }

        // Now update the milestone chain
        const promises = transactionsToBeSaved.map(tx => tx.save());
        await Promise.all(promises);

        // Add it to our "temp" milestone chain list
        milestoneList.push(heighestWeightedChild);

        await Promise.all(transactionsToBeSaved);

        return this.updateMilestoneChain(heighestWeightedChild, cumulativeWeights, milestoneList);
    }

    async getTransactionsInOrder(beginMilestone: Transaction, endMilestone: Transaction): Promise<Transaction[]> {
        const amountOfMilestones = endMilestone.milestoneIndex - beginMilestone.milestoneIndex;
        const lengthArr = new Array(amountOfMilestones);
        const transactionOrder: Transaction[] = [];

        for (const [index] of lengthArr.entries()) {
            const milestoneIndex = endMilestone.milestoneIndex - index;

            // This may not be the most reliable function, since the continous shifting the main chain
            // resulting in two or more milestones receiving the milestone status. We have to chose between them
            const milestoneTransaction = await Transaction.getByMilestoneIndex(milestoneIndex);

            if (!milestoneTransaction) {
                throw new Error(`MilestoneWalker: The milestone index #${milestoneIndex} was requested but it does not exist`);
            }

            transactionOrder.push(milestoneTransaction);

            // Now we are walking all the transactions that where not yet referenced by a milestone before
            const transactionsToWalk = milestoneTransaction.parents;

            // Now we keep walking all transaction that where referenced by the parents
            for (const transactionId of transactionsToWalk) {
                // We should stop at the begin milestone id
                if (transactionId === beginMilestone.id) {
                    continue;
                }

                const transaction = await Transaction.getById(transactionId);

                // Transactions that are milestones should be picked up by the loop above
                if (transaction.milestoneIndex !== null) {
                    continue;
                }

                transaction.referencedMilestonIndex = milestoneIndex;
                transactionOrder.push(transaction);
                transactionsToWalk.push(...transaction.parents);
                await transaction.save();
            }
        }

        return transactionOrder;
    }

    /**
     * Searches for the next milestone
     *
     * @returns {Promise<Transaction>}
     * @memberof MilestoneWalker
     */
    async findNext(): Promise<void> {
        Logger.debug(`Calculating next milestone and executing the order starting from ${this.currentMilestone.milestoneIndex}`);
        const cumulativeWeights = await getTransactionCumulativeWeights(5000);
        const milestoneList = await this.updateMilestoneChain(this.currentMilestone, cumulativeWeights, [this.currentMilestone]);
        const startingPoint = this.currentMilestone;

        // Update our milestone pointer
        if (milestoneList.length) {
            this.currentMilestone = milestoneList[milestoneList.length - 1];
            await createOrUpdate('currentMilestone', this.currentMilestone.toRaw());
        }

        const endPoint = this.currentMilestone;
        const txResults: {id: string, results: Results}[] = [];

        // Make sure the two transaction points are
        if (startingPoint.id !== endPoint.id) {
            const orderedTransactions = await this.getTransactionsInOrder(startingPoint, endPoint);

            for (const transaction of orderedTransactions.reverse()) {
                txResults.push({
                    id: transaction.id,
                    results: await transaction.execute()
                });
            }
        }

        this.dag.trigger('transactionsExecuteResult', {
            transactionResults: txResults,
        });

        Logger.debug(`Done, new milestone height is ${this.currentMilestone.milestoneIndex}`);
        // Update our internal milestones
        // this.previousMilestone = this.currentMilestone.id !== heighestWeightedChild.id ? this.currentMilestone : this.previousMilestone;
        // this.currentMilestone = heighestWeightedChild ? heighestWeightedChild : this.currentMilestone;
        // this.milestoneList.push(heighestWeightedChild.id);
    }

    executeFromPoint() {

    }
}

export default MilestoneWalker;
