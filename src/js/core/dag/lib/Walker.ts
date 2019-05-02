import Transaction from "../../../models/Transaction";
import { getMilestoneTransaction, getTransactionById } from "./services/TransactionService";
import { databaseFind } from "../../../services/DatabaseService";
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

    async getAttachedTransactions(transactionId: string) {
        const branchTransactionsPromise = databaseFind('branchTransaction', transactionId);
        const trunkTransactionsPromise = databaseFind('trunkTransaction', transactionId);

        const branchTransactions = (await branchTransactionsPromise).docs.map(transaction => Transaction.fromRaw(JSON.stringify(transaction)));
        const trunkTransactions = (await trunkTransactionsPromise).docs.map(transaction => Transaction.fromRaw(JSON.stringify(transaction)));

        const transactions = [
            ...branchTransactions,
            ...trunkTransactions,
        ];

        return transactions;
    }

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

    async getTransactionToValidate(milestoneIndex: number): Promise<Transaction[]> {
        let transactionsToValidate: Transaction[] = [];

        // First we have to get the milestone transaction with the given milestoneIndex
        this.transactionCumulativeWeights = await getTransactionCumulativeWeights();
        const milestoneTransaction = await getMilestoneTransaction(milestoneIndex);

        Logger.debug('Searching for trunk transaction');
        const trunkTransactionTip = await this.getTransactionTip(milestoneTransaction);

        Logger.debug('Searching for branch transaction');
        const branchTransactionTip = await this.getTransactionTip(milestoneTransaction);

        transactionsToValidate.push(trunkTransactionTip);

        // We can't add the same transaction id, as this would result in a chain rather than a DAG.
        if (trunkTransactionTip.id === branchTransactionTip.id && !trunkTransactionTip.isGenesis()) {
            // We get the parent of the transaction since that came before this one.
            // TODO: Make sure we validate that transaction before selecting it.
            const trunkAndBranch = [
                trunkTransactionTip.trunkTransaction,
                trunkTransactionTip.branchTransaction,
            ];

            const parentTransaction = await getTransactionById(trunkAndBranch[getRandomInt(0, 1)]);
            transactionsToValidate.push(parentTransaction);
        } else {
            transactionsToValidate.push(branchTransactionTip);
        }

        return transactionsToValidate;

        // Then we have to walk backwards on that transaction (Remembering the weight/amount spend)
    }
}

export default Walker;
