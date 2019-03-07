import RutileContext from '../models/RutileContext';
import Lamda, { LamdaResult } from '../Lamda';

const metering = require('wasm-metering');
const saferEval = require('safer-eval');

interface ExecuteSecureResults {
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
export default async function executeSecure(lamda: Lamda, state: any, data: any[]): Promise<LamdaResult> {
    const dataCopy = data.slice();
    const context = new RutileContext(state, dataCopy);

    // Inject metering so we know what the gas cost of each operatio will be.
    const meteredWas = metering.meterWASM(lamda.wasmBinary, {
        meterType: 'i32',
    });

    let gasUsed = 0;

    const wasm = await WebAssembly.instantiate(meteredWas, {
        metering: {
            usegas: (gas: number) => {
                gasUsed += gas;
            }
        }
    });

    const exports = wasm.instance.exports;

    // The first argument should always represent the function that is exported. Rest is arguments.
    const functionName = dataCopy.shift();
    context.funcToExecute = functionName;

    // Since we cannot trust the environment we have to sandbox the code.
    // This code cannot access anything outside it's environment.
    const sandboxInitator = (): ExecuteSecureResults => {
        const chosenFunction = exports[context.funcToExecute];

        if (!chosenFunction) {
            throw new Error(`Could not find entry '${context.funcToExecute}' on WASM binary`);
        }

        const result = chosenFunction(...context.data);

        return {
            result,
        };
    }

    const executeResults: ExecuteSecureResults = await saferEval(`${sandboxInitator}()`, {
        exports,
        context,
    });

    const totalGasUsed = gasUsed * 1e-4;

    // Gas us
    return {
        gasUsed: totalGasUsed,
        result: executeResults.result,
    };
}
