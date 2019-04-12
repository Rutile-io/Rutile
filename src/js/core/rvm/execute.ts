import './context';
import Context from './context';
import { configuration } from '../../Configuration'
import Transaction from '../../models/Transaction';
import { createWorker } from './utils/workerUtils';
import WorkerMessageController from './controller/WorkerMessageController';
import CallMessage from './lib/CallMessage';
import Ipfs from '../../services/wrappers/Ipfs';
import stringToByteArray from '../../utils/stringToByteArray';

interface ExecuteSecureResults {
    gasUsed?: number;
    result: any;
}

/**
 * Executes code in a different context and vm.
 * This way the code is executed safely.
 * We only give it an instance of Rutile
 *
 * @export
 * @param {string} code
 * @param {string[]} scriptArgs
 * @returns
 */
export default async function execute(callMessage: CallMessage) {
    const worker = createWorker(configuration.vmUrl);

    // This is the physical context it contains all functions and data
    // needed to execute a smart contract. It lives on the main thread
    // since database calls and asynchronous calls cannot be done on the
    // worker thread.
    // TODO: replace 03c074e7992389c7b5403c35fe01b1fa with actual data
    // const context = new Context({
    //     id: transaction.id,
    //     fromAddress: '53ae893e4b22d707943299a8d0c844df0e3d5557',
    //     toAddress: '52ae893e4b22d707943299a8d0c844df0e3d5557',
    //     data: transaction.data,
    //     value: transaction.value,
    //     transactionDifficulty: configuration.difficulty
    // });

    const ipfs = Ipfs.getInstance(configuration.ipfs);

    // "to" should represent the wasm function address or the user address.
    // const contents = await ipfs.cat(callMessage.destination);
    const contents = await ipfs.cat('QmdX1dXeYE4fzPfCDVsSB5s67rCgfVFebBLQ6YNorJwr7Z');
    const wasm = stringToByteArray(contents);

    const context = new Context(callMessage);

    const controller = new WorkerMessageController(worker, context);
    const result = await controller.start(wasm);

    console.log('[] result -> ', result);

    return {
        result: {
            gasUsed: 100,
        },
    }
}
