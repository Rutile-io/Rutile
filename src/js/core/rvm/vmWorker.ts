import { WASI as WasiType } from '@wasmer/wasi';
import { WasmFs } from '@wasmer/wasmfs';
import { workerAddEventListener, extractMessageFromEvent, RequestMessage, workerPostMessage } from "./utils/workerUtils";
import VirtualContext from "./lib/VirtualContext";
import WasiFileSystem from './lib/wasi/WasiFileSystem';
import Logger = require('js-logger');
const metering = require('wasm-metering');
const WASI = require('@wasmer/wasi/lib/index.cjs').WASI;
const wasmTransformer = __non_webpack_require__("@wasmer/wasm-transformer");

Logger.setLevel(Logger.DEBUG);
const loggerHandler = Logger.createDefaultHandler({
    formatter: function(message, context) {
        message.unshift(`[${context.level.name.toLowerCase()}]:`);
        message.unshift(new Date().toLocaleString());
    }
});

Logger.setHandler(loggerHandler);

/**
 * This code is run inside the worker module.
 *
 * @param {Uint8Array} wasmBinary
 */
async function runWasm(wasmBinary: Uint8Array, env: any, args: string[] = []) {
    let wasmFs: WasmFs = null;

    try {
        const context = new VirtualContext();

        // Couple the WASI to the WASM
        const wasiFileSystem = new WasiFileSystem(env, context);
        wasmFs = await wasiFileSystem.create();

        const wasi: WasiType = new WASI({
            args,
            env,
            bindings: {
                ...WASI.defaultBindings,
                fs: wasmFs.fs,
            },
            preopenDirectories: wasiFileSystem.preopenDirectories,
        });

        let isExitCalled = false;

        // Set up the process exit to a post message
        wasi.wasiImport.proc_exit = async (status: number) => {
            // Proc_exit should only be called once.
            if (isExitCalled) {
                return;
            }

            isExitCalled = true;

            const output = await wasmFs.getStdOut();
            context.callContext('exit', [
                status,
                output,
            ]);
        };

        // Instantiate the WebAssembly module with metering included
        const meteredWasm = metering.meterWASM(wasmBinary, {
            meterType: 'i32',
        });

        const loweredBinary = await wasmTransformer.lowerI64Imports(meteredWasm);
        const wasm = await WebAssembly.instantiate(loweredBinary, {
            metering: {
                usegas: (gas: number) => {
                    // context.useGas(gas);
                }
            },
            wasi_unstable: wasi.wasiImport,
            ...context.getExposedFunctions(),
        });

        // Grow memory to 64Kib
        // @ts-ignore
        wasm.instance.exports.memory.grow(32);

        // Get the context ready on the client side
        // It is responsible of actually executing tasks.
        await context.init(wasm);

        // Now boot it up through WASI
        wasiFileSystem.isExecuting = true;
        wasi.start(wasm.instance);
        wasi.wasiImport.proc_exit(0);
        // In WASM it's not required to use a extra layer of sandboxing
        // // Since we cannot trust the environment we have to sandbox the code.
        // // This code cannot access anything outside it's environment.
        // const sandboxInitator = () => {
        //     // We know that wasmExports is available in this sandbox code
        //     // See 'saferEval' call later in this code.
        //     // @ts-ignore
        //     const wasmContext = wasmExports;
        //     const mainFunc = wasmContext.main || wasmContext._main;
        //     mainFunc();
        // }

        // Execution was completed without any errors
        // The code probbably didn't call finish() on it's own
        // so it's safe to assume we can close the VM.
        // context.getExposedFunctions().finish(0, 0);
    } catch (error) {
        console.log('=============Error Debug============');
        console.log(await wasmFs.getStdOut());
        console.log('====================================');

        console.error(error);

        // workerPostMessage({
        //     type: 'EXIT',
        //     value: {
        //         status: 1,
        //     },
        // });

        if (error.errorType !== 'VmError' && error.errorType !== 'FinishExecution') {
            console.error('[VM] Error:', error);
            throw error;
        }
    }
}

async function onMessage(event: any) {
    const message = extractMessageFromEvent(event);

    if (message.type === 'START') {
        await runWasm(message.value.wasm, message.value.env, message.value.args);
    }
}

workerAddEventListener('message', onMessage);
