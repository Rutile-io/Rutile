import Transaction from "../../../models/Transaction";
import { getMilestoneTransaction, getTransactionById } from "./services/TransactionService";
import { databaseFind, startDatabase } from "../../../services/DatabaseService";
import getTransactionCumulativeWeights from "./services/CumulativeWeightService";
import * as Logger from 'js-logger';

function getRandomInt(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Walks backwards from the last milestone to determine a confirmation rate.
 * It checks the balance of the account and determines if the transaction is possible.
 *
 * @class Walker
 */
class Walker {
    transactionCumulativeWeights: Map<string, number>;

    /**
     * Finds transaction that includes the transactionId as it's parent
     *
     * @param {string} transactionId
     * @returns {Promise<Transaction[]>}
     * @memberof Walker
     */
    async getAttachedTransactions(transactionId: string): Promise<Transaction[]> {
        const db = startDatabase();

        const data = await db.find({
            selector: {
                'parents': {
                    '$in': [transactionId],
                }
            }
        });

        return data.docs.map(transaction => Transaction.fromRaw(JSON.stringify(transaction)))
    }

    /**
     * Gets a random weighted transaction from the dag
     *
     * @param {Transaction[]} transactions
     * @returns {Transaction}
     * @memberof Walker
     */
    getRandomWeightedTransaction(transactions: Transaction[]): Transaction {
        let sumOfWeight = 0;

        transactions.forEach((transaction) => {
            sumOfWeight += this.transactionCumulativeWeights.get(transaction.id);
        });

        let randomNum = getRandomInt(0, sumOfWeight);

        const transaction = transactions.find((transaction) => {
            if (randomNum < this.transactionCumulativeWeights.get(transaction.id)) {
                return true;
            }

            randomNum -= this.transactionCumulativeWeights.get(transaction.id);
        });

        if (!transaction) {
            return transactions[0];
        }

        return transaction;
    }

    /**
     * Finds a transaction tip that we can use to validate.
     *
     * @param {Transaction} transaction
     * @returns {Promise<Transaction>}
     * @memberof Walker
     */
    async getTransactionTip(transaction: Transaction): Promise<Transaction> {
        const attachedTransactions = await this.getAttachedTransactions(transaction.id);

        // We found a tip
        if (attachedTransactions.length === 0) {
            return transaction;
        }

        const nextTransaction = this.getRandomWeightedTransaction(attachedTransactions);

        // TODO: Check balance of account before chosing a transaction path.

        return this.getTransactionTip(nextTransaction);
    }

    /**
     * Finds transactions that can be validated. Will not give duplicates (Unless it's the genesis transaction)
     *
     * @param {number} milestoneIndex
     * @param {number} transactionsAmount
     * @returns {Promise<Transaction[]>}
     * @memberof Walker
     */
    async getTransactionToValidate(milestoneIndex: number, transactionsAmount: number): Promise<Transaction[]> {
        let transactionsToValidate: Transaction[] = [];

        // First we have to get the milestone transaction with the given milestoneIndex
        this.transactionCumulativeWeights = await getTransactionCumulativeWeights();
        const milestoneTransaction = await getMilestoneTransaction(milestoneIndex);

        // for of loops (required for async loops) only have support for iterables and not ranges
        // this is why we create an empty array of x length and iterate over that
        const transactionAmountIterator = new Array(transactionsAmount);

        for (let [index] of transactionAmountIterator.entries()) {
            Logger.debug(`Searching for transaction ${index + 1}/${transactionsAmount}`);

            const transaction = await this.getTransactionTip(milestoneTransaction);
            const alreadyHasTransaction = !!transactionsToValidate.find(tx => tx.id === transaction.id);

            if (alreadyHasTransaction && !transaction.isGenesis()) {
                // We can't add the same transaction id, as this would result in a chain rather than a DAG.
                const randomParent = transaction.parents[getRandomInt(0, transaction.parents.length - 1)];
                transactionsToValidate.push(await getTransactionById(randomParent));
            } else {
                transactionsToValidate.push(transaction);
            }
        }

        return transactionsToValidate;
    }
}

export default Walker;
