import './context';
import Context from './context';
import { configuration } from '../../Configuration'
import Transaction from '../../models/Transaction';
import { createWorker } from './utils/workerUtils';
import WorkerMessageController from './controller/WorkerMessageController';
import { getAddressFromTransaction } from '../dag/lib/services/TransactionService';

interface ExecuteSecureResults {
    gasUsed?: number;
    result: any;
}

/**
 * Executes code in a different context and vm.
 * This way the code is executed safely.
 *
 * @export
 * @param {string} code
 * @param {string[]} scriptArgs
 * @returns
 */
export default async function execute(transaction: Transaction, wasmBinary: Uint8Array) {
    const worker = createWorker(configuration.vmUrl);

    // This is the physical context it contains all functions and data
    // needed to execute a smart contract. It lives on the main thread
    // since database calls and asynchronous calls cannot be done on the
    // worker thread.
    const addresses = getAddressFromTransaction(transaction);

    const context = new Context({
        id: transaction.id,
        fromAddress: addresses.from,
        toAddress: addresses.to,
        data: transaction.data,
        value: transaction.value,
        transactionDifficulty: configuration.difficulty
    });

    const controller = new WorkerMessageController(worker, context);
    const result = await controller.start(transaction, wasmBinary);

    return result;
}
