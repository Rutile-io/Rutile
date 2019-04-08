import { workerAddEventListener, workerPostMessage, workerRequest } from "./utils/workerUtils";
import VirtualContext from "./lib/virtualcontext";

const saferEval = require('safer-eval');
const metering = require('wasm-metering');

async function runWasm(wasmBinary: Uint8Array) {
    try {
        const context = new VirtualContext();

        // Instantiate the WebAssembly module with metering included
        const meteredWas = metering.meterWASM(wasmBinary, {
            meterType: 'i32',
        });

        const wasm = await WebAssembly.instantiate(meteredWas, {
            metering: {
                usegas: (gas: number) => {
                    context.useGas(gas);
                }
            },
            env: context.getExposedFunctions(),
        });

        // Grow memory to 64Kib
        wasm.instance.exports.memory.grow(1);

        // Get the context ready on the client side
        // It is responsible of actually executing tasks.
        await context.init(wasm);

        const exports = wasm.instance.exports;

        // Since we cannot trust the environment we have to sandbox the code.
        // This code cannot access anything outside it's environment.
        const sandboxInitator = () => {
            // We know that wasmExports is available in this sandbox code
            // See 'saferEval' call later in this code.
            // @ts-ignore
            const wasmContext = wasmExports;

            if (!wasmContext.main && !wasmContext._main) {
                throw new Error(`Could not find entry 'main' on WASM binary`);
            }

            const mainFunc = wasmContext.main || wasmContext._main;
            mainFunc();
        }

        saferEval(`${sandboxInitator}()`, {
            wasmExports: exports,
        });
    } catch (error) {
        if (error.errorType !== 'VmError' && error.errorType !== 'FinishExecution') {
            console.error('[VM] Error:', error);
            throw error;
        }
    }

    // await context.close();
    // context = null;
}

async function onMessage(event: any) {
    const data = event;

    if (data.type === 'START') {
        await runWasm(data.value.wasm);
    }
}

workerAddEventListener('message', onMessage);
