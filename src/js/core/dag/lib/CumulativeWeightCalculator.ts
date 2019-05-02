import * as Logger from 'js-logger';
import { databaseGetAll } from '../../../services/DatabaseService';
import getAllTransactionsStream from './transaction/getAllTransactionsStream';
import Transaction from '../../../models/Transaction';
import { getTransactionById } from './services/TransactionService';
const toposort = require('toposort');

class CumulativeWeightCalculator {
    async calculate(entryPoint: string) {
        Logger.debug(`Start calculating cw starting with tx hash ${entryPoint}`);

        const txHashesToRate = await this.sortTxInTopologicalOrder(entryPoint);
        return this.calculateCwInOrder(txHashesToRate);
    }

    sortTxInTopologicalOrder(startTx: string): Promise<string[]> {
        return new Promise((resolve) => {
            // It's pretty ineffecient to load the whole DAG in. We should only load in what we need (using the startTx)
            // For now let's go with it..
            const graph: [string, string][] = [];
            const transactions = getAllTransactionsStream();

            transactions.on('data', (txBuffer: Buffer) => {
                const transaction = Transaction.fromRaw(txBuffer.toString());

                graph.push([transaction.id, transaction.branchTransaction]);
                graph.push([transaction.id, transaction.trunkTransaction]);
            });

            transactions.on('end', () => {
                const sorted: string[] = toposort(graph);
                const filtered = sorted.filter((item) => item);

                resolve(filtered);
            });
        });
    }

    async calculateCwInOrder(txsToRate: string[]) {
        let txHashToApprovers = new Map<string, string[]>();
        let txHashToCumulativeWeight = new Map<string, number>();

        for (const txHash of txsToRate) {
            txHashToCumulativeWeight = this.updateCw(txHashToApprovers, txHashToCumulativeWeight, txHash);
            txHashToApprovers = await this.updateApproversAndReleaseMemory(txHashToApprovers, txHash);
        }

        return txHashToCumulativeWeight;
    }

    async updateApproversAndReleaseMemory(txHashToApprovers: Map<string, string[]>, txHash: string): Promise<Map<string, string[]>> {
        const approvers = txHashToApprovers.get(txHash);
        const transaction = await getTransactionById(txHash);

        const trunkApprovers = this.createApprovers(txHashToApprovers, txHash, approvers, transaction.trunkTransaction);
        txHashToApprovers.set(transaction.trunkTransaction, trunkApprovers);
        const branchApprovers = this.createApprovers(txHashToApprovers, txHash, approvers, transaction.branchTransaction);
        txHashToApprovers.set(transaction.branchTransaction, branchApprovers);

        txHashToApprovers.delete(txHash);

        return txHashToApprovers;
    }

    createApprovers(txHashToApprovers: Map<string, string[]>, txHash: string, approvers: string[], trunkHash: string): string[] {
        const approverSet: string[] = (approvers && approvers.length) ? approvers : [];
        const hashesToAdd = txHashToApprovers.get(trunkHash);

        if (hashesToAdd) {
            for (let i = 0; i < hashesToAdd.length; i++) {
                if (!approverSet.includes(hashesToAdd[i])) {
                    approverSet.push(hashesToAdd[i]);
                }
            }
        }

        // Since the transaction that points to it confirms this transaction
        approverSet.push(txHash);

        return approverSet;
    }

    updateCw(txHashToApprovers: Map<string, string[]>, txToCumulativeWeight: Map<string, number>, txHash: string): Map<string, number> {
        const approvers = txHashToApprovers.get(txHash);
        let weight = (approvers ? approvers.length : 0) + 1;

        txToCumulativeWeight.set(txHash, weight);
        return txToCumulativeWeight;
    }

    getTxDirectApproversHash(txHash: string, txToDirectApprovers: Map<string, string[]>): string[] {
        return null;
    }
}


export default CumulativeWeightCalculator;
