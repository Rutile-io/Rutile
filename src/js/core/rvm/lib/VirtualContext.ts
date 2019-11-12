import { workerRequest } from "../utils/workerUtils";
import Transaction from "../../../models/Transaction";
import { waitAndLoad, reset } from "../utils/sharedBufferUtils";
import { Memory, synchroniseBufferToMemory, synchroniseMemoryToBuffer } from "./memory";
import { CallKind } from "./CallMessage";
import fromI64 from "./services/fromI64";

const i64Transformer = require('../../../../wasm/i64-transformer');

/**
 * Virtual Context is meant as a way to expose functions to WASM while posting requests
 * to the main thread and waiting for them to be resolved.
 *
 * @class VirtualContext
 */
class VirtualContext {
    sharedMemory: SharedArrayBuffer;
    sharedNotifier: SharedArrayBuffer;
    wasm: WebAssembly.WebAssemblyInstantiatedSource;
    transformer: WebAssembly.Instance;

    constructor() {
        this.sharedNotifier = new SharedArrayBuffer(4);
        this.transformer = new WebAssembly.Instance(new WebAssembly.Module(i64Transformer), {
            interface: {
                useGas: this._useGas.bind(this),
                getGasLeftHigh: this._getGasLeftHigh.bind(this),
                getGasLeftLow: this._getGasLeftLow.bind(this),
                call: this._call.bind(this),
                callCode: this._callCode.bind(this),
                callDelegate: this._callDelegate.bind(this),
                callStatic: this._callStatic.bind(this),
                getBlockNumberHigh: this._getBlockNumberHigh.bind(this),
                getBlockNumberLow: this._getBlockNumberLow.bind(this),
                getBlockTimestampHigh: this._getBlockTimestampHigh.bind(this),
                getBlockTimestampLow: this._getBlockTimestampLow.bind(this),
                getBlockGasLimitHigh: this._getBlockGasLimitHigh.bind(this),
                getBlockGasLimitLow: this._getBlockGasLimitLow.bind(this)
            }
        });
    }

    async init(wasm: WebAssembly.WebAssemblyInstantiatedSource) {
        // @ts-ignore
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
     * Grows the shared memory and waits for the worker starter to accept the changes
     *
     * @memberof VirtualContext
     */
    growSharedMemory() {
        // @ts-ignore
        const length = Uint8Array.BYTES_PER_ELEMENT * this.wasm.instance.exports.memory.buffer.byteLength;
        this.sharedMemory = new SharedArrayBuffer(length);

        workerRequest({
            type: 'SHAREDMEMORY_GROW',
            value: this.sharedMemory,
            bufferIndex: 0,
        });

        waitAndLoad(this.sharedNotifier, 0);
        reset(this.sharedNotifier, 0);
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
        // It's possible that the WASM module called the memory.grow opcode
        // If this is the case we need to replace our shared buffer with a new one
        // Otherwise we would run in out of bounds errors
        // @ts-ignore
        if (this.wasm.instance.exports.memory.buffer.byteLength !== this.sharedMemory.byteLength) {
            this.growSharedMemory();
        }

        // First synchronise the WebAssembly Memory with the SharedBuffer memory
        // @ts-ignore
        synchroniseMemoryToBuffer(this.wasm.instance.exports.memory, this.sharedMemory);

        workerRequest({
            type: 'context::' + method,
            value: args || [],
            bufferIndex: 0,
        });

        const value = waitAndLoad(this.sharedNotifier, 0);
        reset(this.sharedNotifier, 0);

        // Now synchronise the changes made to the shared buffer back to memory
        // @ts-ignore
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

    _useGas(high: number, low: number) {
        const amount = fromI64(high, low);
        this.useGas(amount);
    }

    _getGasLeftHigh() {

    }

    _getGasLeftLow() {

    }

    _call() {

    }

    _callCode() {

    }

    _callDelegate() {

    }

    _callStatic() {

    }

    _getBlockNumberHigh() {

    }

    _getBlockNumberLow() {

    }

    _getBlockTimestampHigh() {

    }

    _getBlockTimestampLow() {

    }

    _getBlockGasLimitHigh() {

    }

    _getBlockGasLimitLow() {

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
                useGas: this.transformer.exports.useGas,
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
