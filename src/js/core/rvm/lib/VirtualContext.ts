import { workerRequest } from "../utils/workerUtils";
import Transaction from "../../../models/Transaction";
import { waitAndLoad, reset } from "../utils/sharedBufferUtils";
import { Memory, synchroniseBufferToMemory, synchroniseMemoryToBuffer } from "./memory";
import { CallKind } from "./CallMessage";

/**
 * Virtual Context is meant as a way to expose functions to WASM while posting requests
 * to the main thread and waiting for them to be resolved.
 *
 * @class VirtualContext
 */
class VirtualContext {
    sharedMemory: SharedArrayBuffer;
    sharedNotifier: SharedArrayBuffer;
    wasm: WebAssembly.ResultObject;

    constructor() {
        this.sharedNotifier = new SharedArrayBuffer(4);
    }

    async init(wasm: WebAssembly.ResultObject) {
        const length = Uint8Array.BYTES_PER_ELEMENT * wasm.instance.exports.memory.buffer.byteLength;
        const sharedMemory = new SharedArrayBuffer(length);

        this.wasm = wasm;
        // Ask the main thread to init the context
        // and wait till it's completed
        await workerRequest({
            type: 'CONTEXT_INIT',
            value: {
                memory: sharedMemory,
                notifier: this.sharedNotifier,
            },
        });

        this.sharedMemory = sharedMemory;
    }

    /**
     * Calls a function on the main thread and gets it's value
     *
     * @param {string} method
     * @param {any[]} [args]
     * @returns
     * @memberof VirtualContext
     */
    callContext(method: string, args?: any[]) {
        // First synchronise the WebAssembly Memory with the SharedBuffer memory
        synchroniseMemoryToBuffer(this.wasm.instance.exports.memory, this.sharedMemory);

        workerRequest({
            type: 'context::' + method,
            value: args || [],
            bufferIndex: 0,
        });

        const value = waitAndLoad(this.sharedNotifier, 0);
        reset(this.sharedNotifier, 0);

        // Now synchronise the changes made to the shared buffer back to memory
        synchroniseBufferToMemory(this.wasm.instance.exports.memory, this.sharedMemory);

        return value;
    }

    call(gas: number, addressOffset: number, valueOffset: number, dataOffset: number, dataLength: number){
        const executionResult = this.callContext('call', [CallKind.Call, gas, addressOffset, valueOffset, dataOffset, dataLength]);

        // 1 = success
        // 2 = failure
        // 3 = revert
        // Since 0 is not supported for the sharedbuffer synchronisation
        // we chose to just add 1 to the execution statuses
        // Now we just subtract with 1 to go to the original statuses where 0 = success
        return (executionResult - 1);
    }

    useGas(gas: number) {
        // We allow gas to be async called
        // Since useGas is at init time called while notifierBuffer is not
        // available. Resulting in a crash
        workerRequest({
            type: 'context::useGas',
            value: [gas],
            bufferIndex: 0,
        });
    }

    /**
     * Passes all arguments to the this.callContext function
     * All functions will be handled on the main thread.
     *
     * @returns
     * @memberof VirtualContext
     */
    getExposedFunctions() {
        const exposedFunctions = {
            ethereum: {},
            env: {
                useGas: this.useGas.bind(this),
                call: this.call.bind(this),
                revert: (...args: any[]) => this.callContext('revert', args),
                getCallDataSize: (...args: any[]) => this.callContext('getCallDataSize', args),
                callDataCopy: (...args: any[]) => this.callContext('callDataCopy', args),
                storageLoad: (...args: any[]) => this.callContext('storageLoad', args),
                storageStore: (...args: any[]) => this.callContext('storageStore', args),
                finish: (...args: any[]) => this.callContext('finish', args),
                getCaller: (...args: any[]) => this.callContext('getCaller', args),
                log: (...args: any[]) => this.callContext('log', args),
                getCallValue: (...args: any[]) => this.callContext('getCallValue', args),
                getAddress: (...args: any[]) => this.callContext('getAddress', args),
                getReturnDataSize: (...args: any[]) => this.callContext('getReturnDataSize', args),
                returnDataCopy: (...args: any[]) => this.callContext('returnDataCopy', args),
                abort: (...args: any[]) => {
                    console.log('[Abort] args -> ', args);
                }
            },
            debug: {
                print32: (...args: any[]) => this.callContext('print32', args),
                print64: (...args: any[]) => this.callContext('print64', args),
                printMemHex: (...args: any[]) => this.callContext('printMemHex', args),
                printString: (...args: any[]) => this.callContext('printString', args),
            }
        }

        // Keeping backwards compatibility with ethereum contracts
        exposedFunctions.ethereum = exposedFunctions.env;

        return exposedFunctions;
    }
}

export default VirtualContext;
