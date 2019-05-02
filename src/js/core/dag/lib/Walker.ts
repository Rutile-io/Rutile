import Transaction from "../../../models/Transaction";
import { getMilestoneTransaction, getTransactionById } from "./services/TransactionService";
import { databaseFind } from "../../../services/DatabaseService";

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

        const randomIndex = getRandomInt(0, attachedTransactions.length - 1);

        // TODO: Make a weighted decision between the given transactions..
        // For now we are going to random select one.
        const nextTransaction = attachedTransactions[randomIndex];

        // TODO: Check balance of account before chosing a transaction path.

        return this.getTransactionTip(nextTransaction);
    }

    async getTransactionToValidate(milestoneIndex: number): Promise<Transaction[]> {
        let transactionsToValidate: Transaction[] = [];

        // First we have to get the milestone transaction with the given milestoneIndex
        const milestoneTransaction = await getMilestoneTransaction(milestoneIndex);
        const trunkTransactionTip = await this.getTransactionTip(milestoneTransaction);
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
