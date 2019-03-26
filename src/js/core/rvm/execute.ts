import './context';
import Context from './context';
import Transaction from '../../models/Transaction';

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
    // Inject metering so we know what the gas cost of each operatio will be.
    const meteredWas = metering.meterWASM(wasmBinary, {
        meterType: 'i32',
    });

    // TODO: replace 03c074e7992389c7b5403c35fe01b1fa with actual data
    const context = new Context({
        id: transaction.id,
        fromAddress: '03c074e7992389c7b5403c35fe01b1fa',
        toAddress: '02c074e7992389c7b5403c35fe01b1fa',
        data: transaction.data,
    });

    const wasm = await WebAssembly.instantiate(meteredWas, {
        metering: {
            usegas: (gas: number) => {
                context.useGas(gas);
            }
        },
        env: context.getExposedFunctions(),
    });

    context.wasmInstance = wasm;
    context.updateMemory();

    const exports = wasm.instance.exports;

    // Since we cannot trust the environment we have to sandbox the code.
    // This code cannot access anything outside it's environment.
    const sandboxInitator = (): ExecuteSecureResults => {
        if (!exports.main && !exports._main) {
            throw new Error(`Could not find entry 'main' on WASM binary`);
        }

        const mainFunc = exports.main || exports._main;
        const result = mainFunc();

        return {
            result,
        };
    }

    try {
        await saferEval(`${sandboxInitator}()`, {
            exports,
        });
    } catch (error) {
        if (error.errorType !== 'VmError' && error.errorType !== 'FinishExecution') {
            throw error;
        }
    }

    const totalGasUsed = Math.round(context.results.gasUsed * 1e-4);

    return {
        result: context.results,
        state: context.state,
    };
}
