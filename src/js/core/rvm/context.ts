import { memoryGet, loadMemory, Memory } from "./lib/memory";
import { toHex, hexStringToByte, createZerosArray } from "./utils/hexUtils";
import { VmError, VM_ERROR, FinishExecution } from "./lib/exceptions";
const ethUtil = require('ethereumjs-util')

interface ContextOptions {
    id: string;
    fromAddress: string;
    toAddress: string;
    data: string;
}

interface Results {
    exception: number;
    exceptionError?: VM_ERROR;
    gasUsed: number;
    return: Uint8Array;
}

interface AccountStorageMap {
    storage: Map<string, Uint8Array>;
}

class Context {
    id: string;
    fromAddress: string;
    toAddress: string;

    results: Results = {
        exception: 0,
        gasUsed: 0,
        return: new Uint8Array([]),
    };

    data: string;
    state: Map<string, AccountStorageMap>;
    dataParsed: any;

    memory: Uint32Array;
    mem: Memory;
    wasmInstance: WebAssembly.ResultObject;

    constructor(options: ContextOptions) {
        this.id = options.id;
        this.fromAddress = options.fromAddress;
        this.toAddress = options.toAddress;
        this.data = options.data;
        this.dataParsed = ethUtil.toBuffer(options.data);
        this.state = new Map();
    }

    public updateMemory() {
        // this.memory = new Uint32Array(this.wasmInstance.instance.exports.memory.buffer);
        this.mem = new Memory(this.wasmInstance.instance.exports.memory);
    }

    public useGas(amount: number) {
        this.results.gasUsed += amount;
    }

    private storageStore(pathOffset: number, valueOffset: number) {
        // this.updateMemory();
        // TODO: Some safety checks for poking in memory that might nog exists..
        const path = this.mem.read(pathOffset, 32);
        const value = this.mem.read(valueOffset, 32);
        let account = this.state.get(this.toAddress);

        if (typeof account === 'undefined') {
            account = {
                storage: new Map(),
            }

            this.state.set(this.toAddress, account);
        }

        account.storage.set(toHex(path), value);
    }

    private storageLoad(pathOffset: number, resultOffset: number) {
        const path = this.mem.read(pathOffset, 32);
        let account = this.state.get(this.toAddress);

        if (typeof account === 'undefined') {
            account = {
                storage: new Map(),
            }

            this.state.set(this.toAddress, account);
        }

        let value = account.storage.get(toHex(path));
        if (typeof value === 'undefined') {
            value = createZerosArray(32);
        }

        this.mem.write(resultOffset, 32, value);
    }

    private getAddress(resultOffset: number) {
        const addressInBytes = hexStringToByte(this.toAddress);
        this.mem.write(resultOffset, 20, addressInBytes)
    }

    private getCaller(resultOffset: number) {
        const addressInBytes = hexStringToByte(this.fromAddress);
        this.mem.write(resultOffset, 20, addressInBytes)
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
        this.mem.write(resultOffset, length, data);
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

    private revert(dataOffset: number, dataLength: number) {
        let ret = new Uint8Array([]);

        if (dataLength) {
            ret = this.mem.read(dataOffset, dataLength);
        }

        this.results.exception = 0;
        this.results.exceptionError = VM_ERROR.REVERT;
        this.results.return = ret;

        throw new VmError(VM_ERROR.REVERT);
    }

    private finish(dataOffset: number, dataLength: number) {
        let ret = new Uint8Array([]);
        if (dataLength) {
            ret = this.mem.read(dataOffset, dataLength);
        }

        this.results.exception = 0;
        this.results.return = ret;

        throw new FinishExecution('Finished execution');
    }

    private log(dataOffset: number, length: number) {
        this.updateMemory();

        const result = this.mem.read(dataOffset, length);
        console.log('[LOG]: ', result);
    }

    getExposedFunctions() {
        return {
            getAddress: this.getAddress.bind(this),
            rut_getExternalBalance: () => {},
            rut_getMilestoneHash: () => {},
            rut_call: () => {},
            callDataCopy: this.callDataCopy.bind(this),
            getCallDataSize: this.getCallDataSize.bind(this),
            rut_callCode: () => {},
            rut_callDelegate: () => {},
            rut_callStatic: () => {},
            storageStore: this.storageStore.bind(this),
            storageLoad: this.storageLoad.bind(this),
            getCaller: this.getCaller.bind(this),
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
            log: this.log.bind(this),
            rut_getMilestoneNumber: () => {},
            rut_getTxOrigin: () => {},
            finish: this.finish.bind(this),
            revert: this.revert.bind(this),
            rut_getReturnDataSize: () => {},
            rut_returnDataCopy: () => {},
            rut_selfDestruct: () => {},
            rut_getTransactionTimestamp: () => {},
        }
    }
}

export default Context;
