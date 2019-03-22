import { memoryGet, loadMemory, Memory } from "./lib/memory";
import { toHex, hexStringToByte } from "./utils/hexUtils";
const ethUtil = require('ethereumjs-util')

class Context {
    id: string;
    fromAddress: string;
    data: string;
    dataParsed: any;

    memory: Uint32Array;
    mem: Memory;
    wasmInstance: WebAssembly.ResultObject;

    constructor(id: string, fromAddress: string, data: string) {
        this.id = id;
        this.fromAddress = fromAddress;
        this.data = data;
        this.dataParsed = ethUtil.toBuffer(data);
    }

    public updateMemory() {
        // this.memory = new Uint32Array(this.wasmInstance.instance.exports.memory.buffer);
        this.mem = new Memory(this.wasmInstance.instance.exports.memory);
    }

    private storageStore(pathOffset: number, valueOffset: number) {
        // this.updateMemory();
        // TODO: Some safety checks for poking in memory that might nog exists..
        const path = memoryGet(this.memory, pathOffset);
        const value = memoryGet(this.memory, valueOffset);
        const hex = toHex(path);

        //TODO: Store the actual value in the database
    }

    private storageLoad(pathOffset: number, resultOffset: number) {
        console.log('[storageLoad] pathOffset -> ', pathOffset);
        console.log('[storageLoad] resultOffset -> ', resultOffset);
    }

    private getAddress(resultOffset: number) {
        // this.updateMemory();

        //@ts-ignore
        const addressInBytes = hexStringToByte(this.fromAddress);
        loadMemory(this.memory, resultOffset, addressInBytes);
    }

    /**
     * Copies the input data in current environment to memory.
     * This pertains to the input data passed with the message call instruction or transaction.
     *
     * @private
     * @param {number} resultOffset the memory offset to load data into
     * @param {number} dataOffset the offset in the input data
     * @param {number} length the length of data to copy
     * @returns
     * @memberof Context
     */
    private callDataCopy(resultOffset: number, dataOffset: number, length: number) {
        if (length === 0) {
            // TODO: Throw some sort of exception
            return;
        }

        const data = this.dataParsed.slice(dataOffset, dataOffset + length);

        // TODO: Double check this one..
        const ui8a = new Uint8Array(data);
        const result = Array.from(ui8a).reverse();

        this.mem.write(resultOffset, length, result);
    }

    /**
     * Retrieves the data length of the transaction
     *
     * @returns
     * @memberof Context
     */
    private getCallDataSize(): number {
        return this.dataParsed.length;
    }

    private revert(offset: number, size: number) {
        console.log('Reverting..', offset, size);
        throw new Error('Reverted');
    }

    private finish(dataOffset: number, dataLength: number) {
        console.log('Finishing..', dataOffset, dataLength);
    }

    private log(dataOffset: number, length: number) {
        this.updateMemory();

        console.log('[] dataOffset -> ', dataOffset);

        // const result = memoryGet(this.memory, dataOffset, length);

        // console.log('[LOG] offset:', dataOffset, ' length: ', length, ' value: ', result);
    }

    getExposedFunctions() {
        return {
            rut_getAddress: this.getAddress.bind(this),
            rut_getExternalBalance: () => {},
            rut_getMilestoneHash: () => {},
            rut_call: () => {},
            rut_callDataCopy: this.callDataCopy.bind(this),
            rut_getCallDataSize: this.getCallDataSize.bind(this),
            rut_callCode: () => {},
            rut_callDelegate: () => {},
            rut_callStatic: () => {},
            rut_storageStore: this.storageStore.bind(this),
            rut_storageLoad: this.storageLoad.bind(this),
            rut_getCaller: () => {},
            rut_getCallValue: () => {},
            rut_codeCopy: () => {},
            rut_getCodeSize: () => {},
            rut_getMilestoneCoinbase: () => {},
            rut_create: () => {},
            rut_getTransactionDifficulty: () => {},
            rut_getExternalCodeCopy: () => {},
            rut_getExternalCodeSize: () => {},
            rut_getGasLeft: () => {},
            rut_getTransactionGasLimit: () => {},
            rut_getTxGasPrice: () => {},
            rut_log: this.log.bind(this),
            rut_getMilestoneNumber: () => {},
            rut_getTxOrigin: () => {},
            rut_finish: this.finish.bind(this),
            rut_revert: this.revert.bind(this),
            rut_getReturnDataSize: () => {},
            rut_returnDataCopy: () => {},
            rut_selfDestruct: () => {},
            rut_getTransactionTimestamp: () => {},
        }
    }
}

export default Context;
