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
    private minimumTransactionsToValidate: number;

    constructor(minimumTransactionsToValidate: number) {
        this.minimumTransactionsToValidate = minimumTransactionsToValidate;
    }

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

    async getTransactionTip(transaction: Transaction): Promise<Transaction> {
        const attachedTransactions = await this.getAttachedTransactions(transaction.id);

        // We found a tip
        if (attachedTransactions.length === 0) {
            return transaction;
        }

        const randomIndex = getRandomInt(0, attachedTransactions.length - 1);
        console.log(`[] Random number... ->  ${attachedTransactions.length} -> `, randomIndex);


        // TODO: Make a weighted decision between the given transactions..
        // For now we are going to random select one.
        const nextTransaction = attachedTransactions[randomIndex];

        return this.getTransactionTip(nextTransaction);
    }

    async getTransactionToValidate(milestoneIndex: number): Promise<Transaction[]> {
        let transactionsToValidate: Transaction[] = [];

        console.log('Walking transactions..');
        // First we have to get the milestone transaction with the given milestoneIndex
        const milestoneTransaction = await getMilestoneTransaction(milestoneIndex);
        const trunkTransactionTip = await this.getTransactionTip(milestoneTransaction);
        console.log('Second walk..');
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
            console.log('Found doubles');
        } else {
            transactionsToValidate.push(branchTransactionTip);
        }

        console.log('[] transactionsToValidate -> ', transactionsToValidate);

        return transactionsToValidate;

        // Then we have to find the children of that transaction
        // const attachedTransactions = await this.getAttachedTransactions(milestoneTransaction.id);

        // if (attachedTransactions.length === 0) {
        //     transactionsToValidate = [
        //         milestoneTransaction,
        //         milestoneTransaction,
        //     ];
        // } else if (attachedTransactions.length === 1) {
        //     transactionsToValidate = [
        //         milestoneTransaction,
        //         ...attachedTransactions,
        //     ];
        // } else {
        //     console.log('Yay...');
        //     // Continue walking the dag..
        // }

        // // It's possible that the genesis milestone does not have any transactions attached to it yet
        // // in this case we simply attach the new transaction to the genesis.
        // if (milestoneTransaction.isGenesis() && attachedTransactions.length !== 2) {

        // }

        // Then we have to walk backwards on that transaction (Remembering the weight/amount spend)

        return transactionsToValidate;
    }
}

export default Walker;
