import { startDatabase } from "../../../services/DatabaseService";
import getTransactionCumulativeWeights from "./services/CumulativeWeightService";
import * as Logger from 'js-logger';
import { getRandomWeightedTransaction } from "./services/TransactionService";
import getRandomInt from "../../../utils/getRandomInt";
import Transaction from "../../../models/Transaction";
import { getAccountCreationTransaction, getStateInputTransactionTip } from "./services/TransactionService";

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
        const db = await startDatabase();

        const data = await db.find({
            selector: {
                'parents': {
                    '$in': [transactionId],
                }
            }
        });

        return data.docs.map(tx => Transaction.fromRaw(JSON.stringify(tx)))
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

        const nextTransaction = getRandomWeightedTransaction(attachedTransactions, this.transactionCumulativeWeights);

        return this.getTransactionTip(nextTransaction);
    }

    /**
     * Finds the latest transaction that was attached to the chain of the given address
     * this can be used to select an input state root which is used for WASM execution
     *
     * @param {string} address
     * @memberof Walker
     */
    async getLatestTransactionForAddress(address: string): Promise<Transaction> {
        if (!address) {
            throw new Error('Address is missing');
        }

        console.log('[] address -> ', address);

        // First find the "genesis" transaction of the given address
        // we call it genesis since it has been te first interaction of the contract.
        const accountGenesisTransaction = await getAccountCreationTransaction(address);

        if (!accountGenesisTransaction) {
            return null;
        }

        // Now follow the DAG back to the latest transaction.
        // We can do this with the weighted random walk in mind.
        if (!this.transactionCumulativeWeights) {
            this.transactionCumulativeWeights = await getTransactionCumulativeWeights();
        }

        console.log('[] accountGenesisTransaction -> ', accountGenesisTransaction);

        return getStateInputTransactionTip(accountGenesisTransaction, this.transactionCumulativeWeights);
    }

    /**
     * Finds transactions that can be validated. Will not give duplicates (Unless it's the genesis transaction)
     *
     * @param {number} milestoneIndex
     * @param {number} transactionsAmount
     * @returns {Promise<Transaction[]>}
     * @memberof Walker
     */
    async getTransactionsToValidate(milestoneIndex: number, transactionParentsAmount: number): Promise<Transaction[]> {
        let transactionsToValidate: Transaction[] = [];

        // First we have to get the milestone transaction with the given milestoneIndex
        this.transactionCumulativeWeights = await getTransactionCumulativeWeights();
        const milestoneTransaction = await Transaction.getByMilestoneIndex(milestoneIndex);

        if (!milestoneTransaction) {
            throw new Error(`Milestone index #${milestoneIndex} could not be found`);
        }

        console.log('[Tx] transactionParentsAmount -> ', transactionParentsAmount);

        // for of loops (required for async loops) only have support for iterables and not ranges
        // this is why we create an empty array of x length and iterate over that
        const transactionAmountIterator = new Array(transactionParentsAmount);

        for (let [index] of transactionAmountIterator.entries()) {
            Logger.debug(`Searching for transaction ${index + 1}/${transactionParentsAmount}`);

            const transactionTip = await this.getTransactionTip(milestoneTransaction);
            const alreadyHasTransaction = !!transactionsToValidate.find(tx => tx.id === transactionTip.id);

            if (alreadyHasTransaction && !transactionTip.isGenesis()) {
                // We can't add the same transaction id, as this would result in a chain rather than a DAG.
                const randomParentTransactionId = transactionTip.parents[getRandomInt(0, transactionTip.parents.length - 1)];
                transactionsToValidate.push(await Transaction.getById(randomParentTransactionId));
            } else {
                transactionsToValidate.push(transactionTip);
            }
        }

        return transactionsToValidate;
    }
}

export default Walker;
