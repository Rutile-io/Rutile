import Transaction from "../../models/Transaction";
import Chain from "./Chain";
import Block from "../../models/Block";

/**
 * Pool of transactions that can be picked to be used in a block
 *
 * @class TransactionPool
 */
class TransactionPool {
    private transactions: Transaction[];

    constructor(chain: Chain) {
        this.transactions = [];

        chain.on('blockAdded', this.onBlockAdded.bind(this));
    }

    private onBlockAdded(event: any) {
        const block: Block = event.block;

        // We need to make sure we remove all transactions that where in this block
        const blockTransactionIds = block.transactions.map(tx => tx.id);
        this.remove(blockTransactionIds);
    }

    /**
     * Removes transaction ids from the pool
     *
     * @param {string[]} transactionIds An array of transaction ids
     * @memberof TransactionPool
     */
    remove(transactionIds: string[]) {
        const toRemove: number[] = [];

        this.transactions.forEach((tx, index) => {
            if (transactionIds.includes(tx.id)) {
                toRemove.push(index);
            }
        });

        while(toRemove.length) {
            this.transactions.splice(toRemove.pop(), 1);
        }
    }

    /**
     * Checks whether the pool still has transactions
     *
     * @returns {boolean}
     * @memberof TransactionPool
     */
    hasTransactions(): boolean {
        return !!this.transactions.length;
    }

    /**
     * Pops a transaction of the pool
     *
     * @returns {Transaction}
     * @memberof TransactionPool
     */
    pop(): Transaction | null {
        const tx = this.transactions.pop();

        if (!tx) {
            return null;
        }

        return tx;
    }

    /**
     * Adds a transaction to the pool
     *
     * @param {Transaction} transaction
     * @returns
     * @memberof TransactionPool
     */
    add(transaction: Transaction): Promise<void> {
        // First make sure we do not have this transaction already
        const isInPool = !!this.transactions.find(tx => tx.id === transaction.id);

        if (isInPool) {
            return;
        }

        this.transactions.push(transaction);
    }

    /**
     * Checks if a transaction is already in the pool
     *
     * @param {string} transactionId
     * @returns {boolean}
     * @memberof TransactionPool
     */
    isInPool(transactionId: string): boolean {
        return !!this.transactions.find(tx => tx.id === transactionId);
    }
}

export default TransactionPool;
