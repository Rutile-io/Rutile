import BNType from 'bn.js';
import * as Logger from 'js-logger';
import { Memory } from "./lib/memory";
import { toHex, hexStringToByte, createZerosArray } from "./utils/hexUtils";
import { VmError, VM_ERROR, FinishExecution } from "./lib/exceptions";
import Account from "../../models/Account";
import MerkleTree from "../../models/MerkleTree";
import { getDatabaseLevelDbMapping } from "../../services/DatabaseService";
import { storeAndNotify } from "./utils/sharedBufferUtils";
const ethUtil = require('ethereumjs-util');
const BN = require('bn.js');


interface ContextOptions {
    id: string;
    fromAddress: string;
    toAddress: string;
    data: string;
    value: BNType;
    transactionDifficulty: number;
}

export interface Results {
    exception: number;
    exceptionError?: VM_ERROR;
    gasUsed: number;
    return: string;
}

class Context {
    id: string;
    fromAddress: string;
    toAddress: string;
    toAccount: Account;
    value: BNType;
    transactionDifficulty: number;

    results: Results = {
        exception: 0,
        gasUsed: 0,
        return: '0x',
    };

    data: string;
    state: MerkleTree;
    dataParsed: any;

    mem: Memory;
    notifierBuffer: SharedArrayBuffer;
    wasmInstance: WebAssembly.ResultObject;

    constructor(options: ContextOptions) {
        this.id = options.id;
        this.fromAddress = options.fromAddress;
        this.toAddress = options.toAddress;
        this.data = options.data;
        this.value = options.value;
        this.transactionDifficulty = options.transactionDifficulty;
        this.dataParsed = ethUtil.toBuffer(options.data);
    }

    public async init(memory: SharedArrayBuffer, notifier: SharedArrayBuffer) {
        const database = getDatabaseLevelDbMapping();

        this.notifierBuffer = notifier;
        this.toAccount = await Account.findOrCreate(this.toAddress);
        this.state = new MerkleTree(database, this.toAccount.storageRoot);

        await this.state.fill();
        this.updateMemory(memory);

        return {
            notifier: this.notifierBuffer,
            memory,
        }
    }

    public updateMemory(memory: SharedArrayBuffer) {
        this.mem = new Memory(memory);
    }

    public async close() {
        this.toAccount.storageRoot = await this.state.getMerkleRoot();
        await this.toAccount.save();
    }

    /**
     * Consumes gas
     *
     * @param {number} amount
     * @memberof Context
     */
    public useGas(notifierIndex: number, amount: number) {
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
    private async storageStore(notifierIndex: number, pathOffset: number, valueOffset: number) {
        const path = Buffer.from(this.mem.read(pathOffset, 32));
        const value = Buffer.from(this.mem.read(valueOffset, 32));

        await this.state.put(path.toString('hex'), value);
        storeAndNotify(this.notifierBuffer, notifierIndex, 1);
    }

    /**
     * Loads storage from the database
     *
     * @private
     * @param {number} pathOffset
     * @param {number} resultOffset
     * @memberof Context
     */
    private async storageLoad(notifierIndex: number, pathOffset: number, resultOffset: number) {
        const path = this.mem.read(pathOffset, 32);
        let value = await this.state.get(toHex(path));

        // When the value is not available fall back to 32 bytes of 0
        if (typeof value === 'undefined' || value === null) {
            value = createZerosArray(32);
        }

        this.mem.write(resultOffset, 32, value);
        storeAndNotify(this.notifierBuffer, notifierIndex, 1);
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

    private getExternalBalance(addressOffset: number, resultOffset: number){

        const address = this.mem.read(addressOffset, 20);

        // TODO: Get an account sync from db
        // const toAccount = Account.getFromAddress(toHex(address));
        // console.log(toAccount)

        // this.mem.write(resultOffset, 32, data);

    }


    /**
     * Gets the address of the contract caller and stores it in memory
     *
     * @private
     * @param {number} resultOffset
     * @memberof Context
     */
    private getCaller(notifierIndex: number, resultOffset: number) {
        const addressInBytes = hexStringToByte(this.fromAddress);
        this.mem.write(resultOffset, 20, addressInBytes);
        storeAndNotify(this.notifierBuffer, notifierIndex, 1);
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
    private callDataCopy(notifierIndex: number, resultOffset: number, dataOffset: number, length: number) {
        if (length === 0) {
            console.log('EXCEPTION ERROR');
            // TODO: Throw some sort of exception
            return;
        }

        const data = this.dataParsed.slice(dataOffset, dataOffset + length);
        this.mem.write(resultOffset, length, data);

        storeAndNotify(this.notifierBuffer, notifierIndex, 1);
    }

    /**
     * Gets the deposited value by the instruction/transaction responsible for this execution and loads it into memory at the given location.
     * @todo Should change 32 to 128
     * @param resultOffset i32ptr the memory offset to load the value into (u128)
     */
    private getCallValue(notifierIndex: number, resultOffset: number){
        this.mem.write(resultOffset, 16, this.value.toArray(undefined, 16));
        storeAndNotify(this.notifierBuffer, notifierIndex, 1);
    }

    /**
     * Retrieves the data length of the transaction
     *
     * @returns
     * @memberof Context
     */
    private getCallDataSize(notifierIndex: number): void {
        storeAndNotify(this.notifierBuffer, notifierIndex, this.dataParsed.length)
    }

    private getTransactionDifficulty(resultOffset: number){
        const difficultyHex = "0x" + this.transactionDifficulty.toString(16)
        const difficultyBytes = hexStringToByte(difficultyHex);
        this.mem.write(resultOffset, 32, difficultyBytes);
    }

    /**
     * Reverts the changes that where done and quits the program
     *
     * @private
     * @param {number} dataOffset
     * @param {number} dataLength
     * @memberof Context
     */
    private revert(notifierIndex: number, dataOffset: number, dataLength: number) {
        let ret = new Uint8Array([]);

        if (dataLength) {
            ret = this.mem.read(dataOffset, dataLength);
        }

        this.results.exception = 0;
        this.results.exceptionError = VM_ERROR.REVERT;
        this.results.return = '0x' + toHex(ret);

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
    private finish(notifierIndex: number, dataOffset: number, dataLength: number) {
        let ret = new Uint8Array([]);
        if (dataLength) {
            ret = this.mem.read(dataOffset, dataLength);
        }

        this.results.exception = 0;
        this.results.return = '0x' + toHex(ret);

        throw new FinishExecution('Finished execution');
    }

    private log(notifierIndex: number, dataOffset: number, length: number) {
        const result = this.mem.read(dataOffset, length);
        Logger.info(`vm.log 0x${toHex(result)} ${dataOffset}:${length}`);

        storeAndNotify(this.notifierBuffer, notifierIndex, 1);
    }

    getExposedFunctions() {
        return {
            getAddress: this.getAddress.bind(this),
            getExternalBalance: this.getExternalBalance.bind(this),
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
            getCallValue: this.getCallValue.bind(this),
            codeCopy: () => {},
            getCodeSize: () => {},
            getMilestoneCoinbase: () => {},
            create: () => {},
            getTransactionDifficulty: this.getTransactionDifficulty.bind(this),
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
            useGas: this.useGas.bind(this),
        }
    }
}

export default Context;
