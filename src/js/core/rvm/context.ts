import { memoryGet, loadMemory } from "./lib/memory";
import { toHex, hexStringToByte } from "./utils/hexUtils";

class Context {
    id: string;
    fromAddress: string;
    data: string;
    dataParsed: Uint32Array;

    memory: Uint32Array;
    wasmInstance: WebAssembly.ResultObject;

    constructor(id: string, fromAddress: string, data: string) {
        this.id = id;
        this.fromAddress = fromAddress;
        this.data = data;
        this.dataParsed = hexStringToByte(data);
    }

    updateMemory() {
        this.memory = new Uint32Array(this.wasmInstance.instance.exports.memory.buffer);
    }

    storageStore(pathOffset: number, valueOffset: number) {
        this.updateMemory();
        // TODO: Some safety checks for poking in memory that might nog exists..
        const path = memoryGet(this.memory, pathOffset);
        const value = memoryGet(this.memory, valueOffset);
        const hex = toHex(path);

        //TODO: Store the actual value in the database
    }

    getAddress(resultOffset: number) {
        this.updateMemory();

        //@ts-ignore
        const addressInBytes = hexStringToByte(this.fromAddress);
        loadMemory(this.memory, resultOffset, addressInBytes);
    }

    callDataCopy(resultOffset: number, dataOffset: number, length: number) {
        this.updateMemory();
        const off = resultOffset;

        // Mis using the memory get function to extract our data.. :)
        const result = memoryGet(this.dataParsed, dataOffset, length);
        loadMemory(this.memory, off, result, length);

        console.log(resultOffset);
    }

    /**
     * Retrieves the data length of the transaction
     *
     * @returns
     * @memberof Context
     */
    getCallDataSize(): number {
        return this.dataParsed.length;
    }

    revert(offset: number, size: number) {
        console.log('Reverting..', offset, size);
    }

    log(dataOffset: number, length: number) {
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
            rut_storageLoad: () => {},
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
            rut_finish: () => {},
            rut_revert: this.revert.bind(this),
            rut_getReturnDataSize: () => {},
            rut_returnDataCopy: () => {},
            rut_selfDestruct: () => {},
            rut_getTransactionTimestamp: () => {},
        }
    }
}

export default Context;
