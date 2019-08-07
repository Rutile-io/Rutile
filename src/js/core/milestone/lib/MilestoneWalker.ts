import Transaction from "../../../models/Transaction";
import getTransactionCumulativeWeights from "../../dag/lib/services/CumulativeWeightService";

/**
 * The milestone walker walks upon all the transactions of the DAG
 * trying to find out the heaviest branch, this allows for a main chain to be created
 *
 * @class MilestoneWalker
 */
class MilestoneWalker {
    currentMilestone: Transaction;
    milestoneList: string[];

    constructor(lastKnownMilestone: Transaction) {
        this.currentMilestone = lastKnownMilestone;
        console.log('[] this.currentMilestone -> ', this.currentMilestone);
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

    /**
     * Searches for the next milestone
     *
     * @returns {Promise<Transaction>}
     * @memberof MilestoneWalker
     */
    async findNext(): Promise<void> {
        const cumulativeWeights = await getTransactionCumulativeWeights(5000);
        this.updateMilestoneChain(this.currentMilestone, cumulativeWeights, [this.currentMilestone]);



        // Update our internal milestones
        // this.previousMilestone = this.currentMilestone.id !== heighestWeightedChild.id ? this.currentMilestone : this.previousMilestone;
        // this.currentMilestone = heighestWeightedChild ? heighestWeightedChild : this.currentMilestone;
        // this.milestoneList.push(heighestWeightedChild.id);
    }

    executeFromPoint() {

    }
}

export default MilestoneWalker;
