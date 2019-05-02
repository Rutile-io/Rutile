import * as Logger from 'js-logger';
import getAllTransactionsStream from '../transaction/getAllTransactionsStream';
import Transaction from '../../../../models/Transaction';
import { getTransactionById } from './TransactionService';
const toposort = require('toposort');

function getTransactionsInTopologicalOrder(): Promise<string[]> {
    return new Promise((resolve) => {
        const graph: [string, string][] = [];
        const transactions = getAllTransactionsStream();

        transactions.on('data', (transactionBuffer: Buffer) => {
            const transaction = Transaction.fromRaw(transactionBuffer.toString());

            graph.push([transaction.id, transaction.branchTransaction]);
            graph.push([transaction.id, transaction.trunkTransaction]);
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
    const transaction = await getTransactionById(transactionId);

    const trunkApprovers = createApprovers(transactionApprovers, transactionId, approvers, transaction.trunkTransaction);
    transactionApprovers.set(transaction.trunkTransaction, trunkApprovers);

    const branchApprovers = createApprovers(transactionApprovers, transactionId, approvers, transaction.branchTransaction);
    transactionApprovers.set(transaction.branchTransaction, branchApprovers);

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

export default async function getTransactionCumulativeWeights() {
    Logger.debug(`Calculating cumulative weight`);
    const sortedTransactions = await getTransactionsInTopologicalOrder();
    return calculateCumulativeWeight(sortedTransactions);
}
