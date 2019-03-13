import './context';
import Context from './context';

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
export default async function execute(id: string, wasmBinary: Uint8Array, data: Uint32Array[]): Promise<ExecuteSecureResults> {
    // Inject metering so we know what the gas cost of each operatio will be.
    const meteredWas = metering.meterWASM(wasmBinary, {
        meterType: 'i32',
    });

    // TODO: replace 03c074e7992389c7b5403c35fe01b1fa with actual data
    const context = new Context(id, '03c074e7992389c7b5403c35fe01b1fa');
    let gasUsed = 0;

    const wasm = await WebAssembly.instantiate(meteredWas, {
        metering: {
            usegas: (gas: number) => {
                gasUsed += gas;
            }
        },
        index: {
            ...context.getExposedFunctions(),
        }
    });

    context.wasmInstance = wasm;

    const exports = wasm.instance.exports;

    // Since we cannot trust the environment we have to sandbox the code.
    // This code cannot access anything outside it's environment.
    const sandboxInitator = (): ExecuteSecureResults => {
        if (!exports.main) {
            throw new Error(`Could not find entry 'main' on WASM binary`);
        }

        const result = exports.main();

        return {
            result,
        };
    }

    const executeResults: ExecuteSecureResults = await saferEval(`${sandboxInitator}()`, {
        exports,
    });

    const totalGasUsed = gasUsed * 1e-4;

    return {
        gasUsed: totalGasUsed,
        result: executeResults.result,
    };
}
