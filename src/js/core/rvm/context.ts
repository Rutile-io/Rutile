import { Memory } from "./lib/memory";
import { toHex, hexStringToByte, createZerosArray } from "./utils/hexUtils";
import { VmError, VM_ERROR, FinishExecution } from "./lib/exceptions";
import Account from "../../models/Account";
import MerkleTree from "../../models/MerkleTree";
import { startDatabase } from "../../services/DatabaseService";
import { number } from "prop-types";
import { storeAndNotify } from "./utils/sharedBufferUtils";
import CallMessage, { CallKind } from "./lib/CallMessage";
import execute from "./execute";
import toHexString from "../../utils/toHexString";
import { configuration } from "../../Configuration";
const ethUtil = require('ethereumjs-util')

interface ContextOptions {
    id: string;
    fromAddress: string;
    toAddress: string;
    data: string;
    value: number;
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
    value: number;
    transactionDifficulty: number;

    results: Results = {
        exception: 0,
        gasUsed: 0,
        return: '0x',
    };

    state: MerkleTree;
    dataParsed: any;
    message: CallMessage;
    mem: Memory;
    notifierBuffer: SharedArrayBuffer;
    wasmInstance: WebAssembly.ResultObject;

    constructor(callMessage: CallMessage){
        this.message = callMessage;
        this.fromAddress = callMessage.sender;
        this.toAddress = callMessage.destination;
        this.value = callMessage.value;
        this.transactionDifficulty = configuration.difficulty;
        this.dataParsed = callMessage.inputData;
    }

    public async init(memory: SharedArrayBuffer, notifier: SharedArrayBuffer) {
        const database = startDatabase();

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
    private getAddress(notifierIndex: number, resultOffset: number) {
        const addressInBytes = hexStringToByte(this.toAddress);
        this.mem.write(resultOffset, 20, addressInBytes)
        storeAndNotify(this.notifierBuffer, notifierIndex, 1);

    }

    /**
     * Gets the external balance of an address and stores it in memory
     * @param notifierIndex 
     * @param addressOffset 
     * @param resultOffset 
     */
    private async getExternalBalance(notifierIndex: number, addressOffset: number, resultOffset: number){

        const address = this.mem.read(addressOffset, 20);
        const toAccount = await Account.findOrCreate(toHex(address));

        const balanceHex = "0x" + toAccount.balance.toString(16);
        const balanceBytes = hexStringToByte(balanceHex);

        this.mem.write(resultOffset, 32, balanceBytes);
        storeAndNotify(this.notifierBuffer, notifierIndex, 1);
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

    private async call(notifierIndex: number, callKind: CallKind, gas: number, addressOffset: number, valueOffset: number, dataOffset: number, dataLength: number){
        const address = this.mem.read(addressOffset, 20);
        const destination = toHex(address);
        console.log('turbo', 'dab');
        const callMessage = new CallMessage();
        callMessage.destination = destination;
        callMessage.flags = 1; // TODO: create flag enum and get flag from previous: m_msg.flags & EVMC_STATIC;
        callMessage.depth = this.message.depth + 1;
        callMessage.kind = callKind;

        switch(callKind){
            case CallKind.Call:
            case CallKind.CallCode:
                callMessage.sender = this.message.destination;
                const value = this.mem.read(valueOffset, 32);
                callMessage.value = parseInt(toHex(value), 16);
                if(callKind === CallKind.Call && callMessage.value !== 0){
                    // TODO: ensureCondition exception
                    
                }
            break;
        }

        //TODO: Take gas for internal functions


        if(callMessage.depth >= 1024){
            return 1;
        }

        callMessage.gas = gas;


        if(dataLength){
            callMessage.inputData = this.mem.read(dataOffset, dataLength);
            callMessage.inputSize = dataLength;
        }
        else{
            callMessage.inputData = new Uint8Array();
            callMessage.inputSize = 0;
        }
        await execute(callMessage);

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
        const valueHex = "0x" + this.value.toString(16);
        const valueBytes = hexStringToByte(valueHex);
        this.mem.write(resultOffset, 32, valueBytes);
        storeAndNotify(this.notifierBuffer, notifierIndex, 1);
    }

    /** TODO: check if it should return anything
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
        console.log(`[LOG]: 0x${toHex(result)} ${dataOffset}:${length}`);

        storeAndNotify(this.notifierBuffer, notifierIndex, 1);
    }

    getExposedFunctions() {
        return {
            getAddress: this.getAddress.bind(this),
            getExternalBalance: this.getExternalBalance.bind(this),
            getMilestoneHash: () => {},
            call: this.call.bind(this),
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
