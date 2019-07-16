import BNType from 'bn.js';
import * as Logger from 'js-logger';
import { Memory } from "./lib/memory";
import { toHex, hexStringToByte, createZerosArray } from "./utils/hexUtils";
import { VmError, VM_ERROR, FinishExecution } from "./lib/exceptions";
import Account from "../../models/Account";
import MerkleTree from "../../models/MerkleTree";
import { getDatabaseLevelDbMapping } from "../../services/DatabaseService";
import { storeAndNotify } from "./utils/sharedBufferUtils";
import byteArrayToString from '../../utils/byteArrayToString';
import CallMessage, { CallKind } from './lib/CallMessage';
import execute from './execute';
import { configuration } from '../../Configuration';
const ethUtil = require('ethereumjs-util');
const BN = require('bn.js');


interface ContextOptions {
    fromAddress: string;
    toAddress: string;
    data: Buffer | Uint8Array;
    value: BNType;
    transactionDifficulty: number;
}

export interface Results {
    exception: number;
    exceptionError?: VM_ERROR;
    gasUsed: number;
    return: Uint8Array;
    returnHex: string;
    outputRoot: string;
    createdAddress: boolean;
}


class Context {
    fromAddress: string;
    toAddress: string;
    toAccount: Account;
    value: BNType;
    transactionDifficulty: number;

    /**
     * The results of the call, callcode, calldelegate, callStatic or create
     *
     * @type {Results}
     * @memberof Context
     */
    callResults: Results = null;

    results: Results = {
        exception: 0,
        gasUsed: 0,
        outputRoot: '0x',
        return: new Uint8Array(),
        returnHex: '0x',
        createdAddress: false,
    };

    data: string;
    state: MerkleTree;
    dataParsed: any;

    mem: Memory;
    message: CallMessage;
    notifierBuffer: SharedArrayBuffer;
    wasmInstance: WebAssembly.ResultObject;

    constructor(callMessage: CallMessage) {
        this.fromAddress = callMessage.sender;
        this.toAddress = callMessage.destination;
        this.dataParsed = callMessage.inputData;
        this.value = callMessage.value;
        this.transactionDifficulty = configuration.difficulty;
        this.message = callMessage;
    }

    public async init(memory: SharedArrayBuffer, notifier: SharedArrayBuffer) {
        const database = await getDatabaseLevelDbMapping();

        this.notifierBuffer = notifier;
        this.toAccount = await Account.findOrCreate(this.toAddress);
        this.state = new MerkleTree(database, this.message.inputRoot);

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
        let root = await this.state.getMerkleRoot();

        this.toAccount.storageRoot = root;
        this.results.outputRoot = root;

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
    private async storageStore(notifierIndex: number, pathOffset: number, valueOffset: number, pathLength: number = 32, valueLength: number = 32) {
        if (pathLength === 0) {
            pathLength = 32;
        }

        if (valueLength === 0) {
            valueLength = 32;
        }

        const path = Buffer.from(this.mem.read(pathOffset, pathLength));
        const value = Buffer.from(this.mem.read(valueOffset, valueLength));

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

    /**
     * Gets the size of the return data
     *
     * @private
     * @param {number} notifierIndex
     * @memberof Context
     */
    private getReturnDataSize(notifierIndex: number) {
        storeAndNotify(this.notifierBuffer, notifierIndex, this.callResults.return.length);
    }

    /**
     * Writes the call return data to the given memory offset
     *
     * @private
     * @param {number} notifierIndex
     * @param {number} resultOffset
     * @param {number} dataOffset
     * @param {number} length
     * @memberof Context
     */
    private returnDataCopy(notifierIndex: number, resultOffset: number, dataOffset: number, length: number) {
        const data = this.callResults.return.slice(dataOffset, dataOffset + length);
        this.mem.write(resultOffset, length, data);

        storeAndNotify(this.notifierBuffer, notifierIndex, 1);
    }

    private getExternalBalance(addressOffset: number, resultOffset: number){
        const address = this.mem.read(addressOffset, 20);
        // Should walk the DAG backwards from a random transaction and calculate the balance from that point.
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
     * @todo Should change 64 to 128
     * @param resultOffset i32ptr the memory offset to load the value into (u128)
     */
    private getCallValue(notifierIndex: number, resultOffset: number){
        // We should not yet use u128 for values since they need to be supported in WASM.
        // We either wait for WASM to support Big numbers or create a WASM module for this
        this.mem.write(resultOffset, 8, this.value.toArray(undefined, 8));
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
        this.results.return = ret;
        this.results.returnHex = '0x' + toHex(ret);

        // Everything was reverted so no new state
        this.results.outputRoot = this.message.inputRoot;

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
        this.results.return = ret;
        this.results.returnHex = '0x' + toHex(ret);

        throw new FinishExecution('Finished execution');
    }

    private log(notifierIndex: number, dataOffset: number, length: number) {
        const result = this.mem.read(dataOffset, length);
        Logger.info(`vm.log 0x${toHex(result)} ${dataOffset}:${length}`);

        storeAndNotify(this.notifierBuffer, notifierIndex, 1);
    }

    /**
     * Calls the wasm code located at the given address
     *
     * 1 = success
     * 2 = failure
     * 3 = revert
     *
     * @private
     * @param {number} notifierIndex
     * @param {CallKind} callKind
     * @param {number} gas
     * @param {number} addressOffset
     * @param {number} valueOffset
     * @param {number} dataOffset
     * @param {number} dataLength
     * @returns
     * @memberof Context
     */
    private async call(notifierIndex: number, callKind: CallKind, gas: number, addressOffset: number, valueOffset: number, dataOffset: number, dataLength: number) {
        const address = this.mem.read(addressOffset, 20);
        const destination = '0x' + toHex(address);

        const callMessage = new CallMessage();
        callMessage.destination = destination;
        callMessage.flags = 1; // TODO: create flag enum and get flag from previous: m_msg.flags & EVMC_STATIC;
        callMessage.depth = this.message.depth + 1;
        callMessage.kind = callKind;

        switch(callKind){
            case CallKind.Call:
            case CallKind.CallCode:
                // callMessage.sender = this.message.destination;

                // const value = this.mem.read(valueOffset, 32);
                // callMessage.value = parseInt(toHex(value), 16);

                // if(callKind === CallKind.Call && callMessage.value !== 0){
                //     // TODO: ensureCondition exception

                // }
            break;
        }

        // TODO: Take gas for internal functions

        // Messages should not call infinitely
        // TODO: Throw an exception instead..
        if (callMessage.depth >= 1024) {
            storeAndNotify(this.notifierBuffer, notifierIndex, 2);
            return;
        }

        callMessage.gas = gas;

        if (dataLength) {
            callMessage.inputData = this.mem.read(dataOffset, dataLength);
            callMessage.inputSize = dataLength;
        } else {
            callMessage.inputData = new Uint8Array();
            callMessage.inputSize = 0;
        };

        // TODO: Should depending on the result throw the exception to above
        const result = await execute(callMessage);

        this.callResults = result;

        if (result.exceptionError === VM_ERROR.REVERT) {
            storeAndNotify(this.notifierBuffer, notifierIndex, 3);
            return;
        } else if (result.exceptionError == VM_ERROR.OUT_OF_GAS) {
            // TODO: Out of gas error
            storeAndNotify(this.notifierBuffer, notifierIndex, 3);
            return;
        }

        // Finish execution should not be notified
        // TODO: The logs should however
        storeAndNotify(this.notifierBuffer, notifierIndex, 1);
    }

    // ---------------------------------------------------------------------
    // ------------------------ Start debug methods ------------------------
    // ---------------------------------------------------------------------

    /**
     * Prints a 32bit integer
     *
     * @private
     * @param {number} notifierIndex
     * @param {number} value
     * @memberof Context
     */
    private print32(notifierIndex: number, value: number) {
        Logger.info(`vm.print32 ${value}`);
        storeAndNotify(this.notifierBuffer, notifierIndex, 1);
    }

    /**
     * Prints a 64bit integer (Not supported for now..)
     *
     * @private
     * @param {number} notifierIndex
     * @param {number} value
     * @memberof Context
     */
    private print64(notifierIndex: number, value: number) {
        Logger.info(`vm.print64 ${value}`);
        storeAndNotify(this.notifierBuffer, notifierIndex, 1);
    }

    private printString(notifierIndex: number, offset: number, length: number) {
        const value = this.mem.read(offset, length);

        Logger.info(`vm.printString ${byteArrayToString(value)}`);

        storeAndNotify(this.notifierBuffer, notifierIndex, 1);
    }

    private printMemHex(notifierIndex: number, offset: number, length: number) {
        const value = this.mem.read(offset, length);
        const hexValue = toHex(value);

        Logger.info(`vm.printMemHex 0x${hexValue}`);

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
            getReturnDataSize: this.getReturnDataSize.bind(this),
            returnDataCopy: this.returnDataCopy.bind(this),
            selfDestruct: () => {},
            getTransactionTimestamp: () => {},
            useGas: this.useGas.bind(this),

            // Debug methods
            print32: this.print32.bind(this),
            print64: this.print64.bind(this),
            printString: this.printString.bind(this),
            printMemHex: this.printMemHex.bind(this),
        }
    }
}

export default Context;
