import { Memory } from "./lib/memory";
import { toHex, hexStringToByte, createZerosArray } from "./utils/hexUtils";
import { VmError, VM_ERROR, FinishExecution } from "./lib/exceptions";
import Account from "../../models/Account";
import MerkleTree from "../../models/MerkleTree";
import { startDatabase } from "../../services/DatabaseService";
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

class Context {
    id: string;
    fromAddress: string;
    toAddress: string;
    toAccount: Account;

    results: Results = {
        exception: 0,
        gasUsed: 0,
        return: new Uint8Array([]),
    };

    data: string;
    state: MerkleTree;
    dataParsed: any;

    mem: Memory;
    wasmInstance: WebAssembly.ResultObject;

    constructor(options: ContextOptions) {
        this.id = options.id;
        this.fromAddress = options.fromAddress;
        this.toAddress = options.toAddress;
        this.data = options.data;
        this.dataParsed = ethUtil.toBuffer(options.data);
    }

    public async init() {
        const database = startDatabase();

        this.toAccount = await Account.findOrCreate(this.toAddress);
        this.state = new MerkleTree(database, this.toAccount.storageRoot);

        await this.state.fill();
        this.updateMemory();
    }

    public async close() {
        this.toAccount.storageRoot = await this.state.getMerkleRoot();
        await this.toAccount.save();
    }

    /**
     * Updates the memory instance. Should only be called once.
     *
     * @memberof Context
     */
    public updateMemory() {
        this.mem = new Memory(this.wasmInstance.instance.exports.memory);
    }

    /**
     * Consumes gas
     *
     * @param {number} amount
     * @memberof Context
     */
    public useGas(amount: number) {
        this.results.gasUsed += amount;
    }

    /**
     * Stores a key value pair inside the database
     *
     * @private
     * @param {number} pathOffset
     * @param {number} valueOffset
     * @memberof Context
     */
    private storageStore(pathOffset: number, valueOffset: number) {
        const path = this.mem.read(pathOffset, 32);
        const value = this.mem.read(valueOffset, 32);

        this.state.putSync(toHex(path), value);
    }

    /**
     * Loads storage from the database
     *
     * @private
     * @param {number} pathOffset
     * @param {number} resultOffset
     * @memberof Context
     */
    private storageLoad(pathOffset: number, resultOffset: number) {
        const path = this.mem.read(pathOffset, 32);
        let value = this.state.getSync(toHex(path));

        // When the value is not available fall back to 32 bytes of 0
        if (typeof value === 'undefined') {
            value = createZerosArray(32);
        }

        this.mem.write(resultOffset, 32, value);
    }

    /**
     * Gets the address from the receiver and stores it in memory
     *
     * @private
     * @param {number} resultOffset
     * @memberof Context
     */
    private getAddress(resultOffset: number) {
        const addressInBytes = hexStringToByte(this.toAddress);
        this.mem.write(resultOffset, 20, addressInBytes)
    }

    /**
     * Gets the address of the contract caller and stores it in memory
     *
     * @private
     * @param {number} resultOffset
     * @memberof Context
     */
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

    /**
     * Reverts the changes that where done and quits the program
     *
     * @private
     * @param {number} dataOffset
     * @param {number} dataLength
     * @memberof Context
     */
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

    /**
     * Finishes execution and returns the results
     *
     * @private
     * @param {number} dataOffset
     * @param {number} dataLength
     * @memberof Context
     */
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
            getExternalBalance: () => {},
            getMilestoneHash: () => {},
            call: () => {},
            callDataCopy: this.callDataCopy.bind(this),
            getCallDataSize: this.getCallDataSize.bind(this),
            callCode: () => {},
            callDelegate: () => {},
            callStatic: () => {},
            storageStore: this.storageStore.bind(this),
            storageLoad: this.storageLoad.bind(this),
            getCaller: this.getCaller.bind(this),
            getCallValue: () => {},
            codeCopy: () => {},
            getCodeSize: () => {},
            getMilestoneCoinbase: () => {},
            create: () => {},
            getTransactionDifficulty: () => {},
            getExternalCodeCopy: () => {},
            getExternalCodeSize: () => {},
            getGasLeft: () => {},
            getTransactionGasLimit: () => {},
            getTxGasPrice: () => {},
            log: this.log.bind(this),
            getMilestoneNumber: () => {},
            getTxOrigin: () => {},
            finish: this.finish.bind(this),
            revert: this.revert.bind(this),
            getReturnDataSize: () => {},
            returnDataCopy: () => {},
            selfDestruct: () => {},
            getTransactionTimestamp: () => {},
        }
    }
}

export default Context;
