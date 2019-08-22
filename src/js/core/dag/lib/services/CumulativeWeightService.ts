import * as Logger from 'js-logger';
import getAllTransactionsStream from '../transaction/getAllTransactionsStream';
import Transaction from '../../../../models/Transaction';
const toposort = require('toposort');

/**
 * Sorts all transactions in topological order
 *
 * @returns {Promise<string[]>}
 */
function getTransactionsInTopologicalOrder(): Promise<string[]> {
    return new Promise((resolve) => {
        const graph: [string, string][] = [];
        const transactions = getAllTransactionsStream();

        transactions.on('data', (transactionBuffer: Buffer) => {
            const transaction = Transaction.fromRaw(transactionBuffer.toString());

            transaction.parents.forEach((parentTxId) => {
                graph.push([transaction.id, parentTxId]);
            });
        });

        transactions.on('end', () => {
            const sorted: string[] = toposort(graph);

            // Make sure we don't get any undefined items.
            const filtered = sorted.filter((item) => item);

            resolve(filtered);
        });
    });
}

async function updateApprovers(transactionApprovers: Map<string, string[]>, transactionId: string): Promise<Map<string, string[]>>  {
    const approvers = transactionApprovers.get(transactionId);
    const transaction = await Transaction.getById(transactionId);

    if (!transaction) {
        Logger.debug(`Missing transaction ${transactionId}`);
        return transactionApprovers;
    }

    transaction.parents.forEach((parentTransactionId) => {
        const parentApprovers = createApprovers(transactionApprovers, transactionId, approvers, parentTransactionId);
        transactionApprovers.set(parentTransactionId, parentApprovers);
    });

    // We've already calculated this transactionId. We can forget it.
    transactionApprovers.delete(transactionId);

    return transactionApprovers;
}

function createApprovers(transactionApprovers: Map<string, string[]>, transactionId: string, approvers: string[], trunkHash: string): string[] {
    const approverSet: string[] = (approvers && approvers.length) ? approvers : [];
    const hashesToAdd = transactionApprovers.get(trunkHash);

    if (hashesToAdd) {
        for (let i = 0; i < hashesToAdd.length; i++) {
            if (!approverSet.includes(hashesToAdd[i])) {
                approverSet.push(hashesToAdd[i]);
            }
        }
    }

    // Since the transaction that points to it confirms this transaction
    approverSet.push(transactionId);

    return approverSet;
}

function updateCumulativeWeight(transactionApprovers: Map<string, string[]>, transactionCumulativeWeights: Map<string, number>, transactionId: string): Map<string, number> {
    const approvers = transactionApprovers.get(transactionId);
    let cumulativeWeight = (approvers ? approvers.length : 0) + 1;

    transactionCumulativeWeights.set(transactionId, cumulativeWeight);
    return transactionCumulativeWeights;
}

async function calculateCumulativeWeight(transactionIds: string[]) {
    let transactionApprovers = new Map<string, string[]>();
    let transactionCumulativeWeights = new Map<string, number>();

    for (const transactionId of transactionIds) {
        transactionCumulativeWeights = updateCumulativeWeight(transactionApprovers, transactionCumulativeWeights, transactionId);
        transactionApprovers = await updateApprovers(transactionApprovers, transactionId);
    }

    return transactionCumulativeWeights;
}

const cachedWeights: {
    timestamp: number,
    result: Map<string, number>
} = {
    timestamp: Date.now(),
    result: null,
};


/**
 * Gets the transaction current cumulative weights of the DAG
 *
 * @export
 * @param {number} [staleTime=0] allows you to use a cached version of the weights or a fresh one
 * @returns
 */
export default async function getTransactionCumulativeWeights(staleTime: number = 0): Promise<Map<string, number>> {
    if (staleTime > 0) {
        const delta =  Date.now() - cachedWeights.timestamp;

        if (staleTime > delta && cachedWeights.result !== null) {
            return cachedWeights.result;
        }
    }

    Logger.debug(`Calculating cumulative weight`);
    const sortedTransactions = await getTransactionsInTopologicalOrder();
    cachedWeights.result = await calculateCumulativeWeight(sortedTransactions);
    cachedWeights.timestamp = Date.now();

    return cachedWeights.result;
}
