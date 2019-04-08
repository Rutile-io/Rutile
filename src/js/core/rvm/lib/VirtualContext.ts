import { workerRequest } from "../utils/workerUtils";
import Transaction from "../../../models/Transaction";
import { waitAndLoad, reset } from "../utils/sharedBufferUtils";

/**
 * Virtual Context is meant as a way to expose functions to WASM while posting requests
 * to the main thread and waiting for them to be resolved.
 *
 * @class VirtualContext
 */
class VirtualContext {
    sharedMemory: SharedArrayBuffer;
    sharedNotifier: SharedArrayBuffer;
    memoryU8: Uint8Array;

    async init(wasm: WebAssembly.ResultObject) {
         // Ask the main thread to init the context and create a shared buffer.
         const contextInitResults = await workerRequest({
            type: 'CONTEXT_INIT',
            value: {
                memoryBuffer: wasm.instance.exports.memory.buffer,
            },
        });

        this.sharedMemory = contextInitResults.value.sharedMemory;
        this.sharedNotifier = contextInitResults.value.sharedNotifier;
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
        this.refreshMemory();

        workerRequest({
            type: 'context::' + method,
            value: args || [],
            bufferIndex: 0,
        });

        const value = waitAndLoad(this.sharedNotifier, 0);
        reset(this.sharedNotifier, 0);

        return value;
    }

    refreshMemory() {
        this.memoryU8 = new Uint8Array(this.sharedMemory);
    }

    getCallDataSize() {
        return this.callContext('getCallDataSize');
    }

    /**
     * Gets the address of the contract caller and stores it in memory
     *
     * @private
     * @param {number} resultOffset
     * @memberof Context
     */
    getCaller(resultOffset: number) {
        this.callContext('getCaller', [
            resultOffset,
        ]);
    }

    revert(dataOffset: number, dataLength: number) {
        this.callContext('revert', [
            dataOffset,
            dataLength,
        ]);
    }

    useGas(gas: number) {
        // TODO: This does not translate well
        // since useGas is called before the sharedBuffer is send along
        // Maybe create the sharedBuffer on the worker side?
        // this.callContext('useGas', [
        //     gas,
        // ]);
    }

    callDataCopy(resultOffset: number, dataOffset: number, length: number) {
        this.callContext('callDataCopy', [
            resultOffset,
            dataOffset,
            length,
        ]);
    }

    storageLoad() {
        console.log('STorage load');
    }

    storageStore() {
        console.log('Storage store');
    }

    finish() {
        console.log('Finish!');
    }

    getExposedFunctions() {
        return {
            useGas: this.useGas.bind(this),
            revert: this.revert.bind(this),
            getCallDataSize: this.getCallDataSize.bind(this),
            callDataCopy: this.callDataCopy.bind(this),
            storageLoad: this.storageLoad.bind(this),
            storageStore: this.storageStore.bind(this),
            finish: this.finish.bind(this),
            getCaller: this.getCaller.bind(this),
        }
    }
}

export default VirtualContext;
