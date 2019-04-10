import './context';
import Context from './context';
import { configuration } from '../../Configuration'
import Transaction from '../../models/Transaction';
import { createWorker } from './utils/workerUtils';
import WorkerMessageController from './controller/WorkerMessageController';

const metering = require('wasm-metering');
const saferEval = require('safer-eval');

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
export default async function execute(transaction: Transaction, wasmBinary: Uint8Array) {
    const worker = createWorker(configuration.vmUrl);

    // This is the physical context it contains all functions and data
    // needed to execute a smart contract. It lives on the main thread
    // since database calls and asynchronous calls cannot be done on the
    // worker thread.
    // TODO: replace 03c074e7992389c7b5403c35fe01b1fa with actual data
    const context = new Context({
        id: transaction.id,
        fromAddress: '53ae893e4b22d707943299a8d0c844df0e3d5557',
        toAddress: '52ae893e4b22d707943299a8d0c844df0e3d5557',
        data: transaction.data,
        value: transaction.value,
        transactionDifficulty: configuration.difficulty
    });

    const controller = new WorkerMessageController(worker, context);
    const result = await controller.start(transaction, wasmBinary);

    console.log('[] result -> ', result);

    return {
        result: {
            gasUsed: 100,
        },
    }



    // const wasm = await WebAssembly.instantiate(meteredWas, {
    //     metering: {
    //         usegas: (gas: number) => {
    //             context.useGas(gas);
    //         }
    //     },
    //     env: context.getExposedFunctions(),
    // });

    // context.wasmInstance = wasm;
    // await context.init();

    // const exports = wasm.instance.exports;

    // // Since we cannot trust the environment we have to sandbox the code.
    // // This code cannot access anything outside it's environment.
    // const sandboxInitator = (): ExecuteSecureResults => {
    //     if (!exports.main && !exports._main) {
    //         throw new Error(`Could not find entry 'main' on WASM binary`);
    //     }

    //     const mainFunc = exports.main || exports._main;
    //     const result = mainFunc();

    //     return {
    //         result,
    //     };
    // }

    // try {
    //     await saferEval(`${sandboxInitator}()`, {
    //         exports,
    //     });
    // } catch (error) {
    //     if (error.errorType !== 'VmError' && error.errorType !== 'FinishExecution') {
    //         throw error;
    //     }
    // }

    // await context.close();

    // const totalGasUsed = Math.round(context.results.gasUsed * 1e-4);

    // return {
    //     result: context.results,
    //     // state: context.state,
    // };
}
