import * as Logger from 'js-logger';
import Ipfs from "../services/wrappers/Ipfs";
import { configuration } from "../Configuration";
import KeyPair from "./KeyPair";
import { getUnsignedTransactionHash, getTransactionId, getAddressFromTransaction } from "../core/dag/lib/services/TransactionService";
import execute from "../core/rvm/execute";
import BNtype from 'bn.js';
import { NodeType } from "./interfaces/IConfig";
import Account from "./Account";
import { rlpHash } from "../utils/keccak256";
import { Results } from '../core/rvm/context';
import getSystemContract from '../services/getSystemContract';
import createCallMessage from '../services/createCallMessage';
import { hexStringToByte } from '../core/rvm/utils/hexUtils';
import getInternalContract from '../services/getInternalContract';
import { startDatabase } from '../services/DatabaseService';
const BN = require('bn.js');

interface TransactionParams {
    to: string;
    data?: string;
    gasLimit?: number;
    gasPrice?: number;
    gasUsed?: number;
    id?: string;
    nonce?: number;
    r?: string;
    s?: string;
    v?: number;
    timestamp?: number;
    value?: number | string | BNtype;
    outputStateRoot?: string;
    inputStateRoot?: string;
}

class Transaction {
    // The hash of the transaction (Not by PoW)
    id?: string;

    // Gas used for function execution
    gasUsed: number = 0;

    // Tiles willing to pay for transaction
    // Only applies to a client asking to execute a function
    gasPrice: number = 0;

    // Gas limit (Don't apply to client execution)
    gasLimit?: number = 0;

    // Signature of transaction done by client
    r: string;
    s: string;
    v: number;

    // The value of tiles transfered
    value?: BNtype;

    // Timestamp of transaction
    timestamp?: number = 0;

    // number of transaction made by the address
    nonce?: number = 0;

    // The root of the state after execution
    outputStateRoot: string;

    // The root of the state before execution
    inputStateRoot: string;

    // To which address to send tokens to.
    // Can also be a function address
    to?: string;

    // data as arguments or a message to send along with the transactions
    data?: string;

    constructor(params: TransactionParams) {
        this.data = params.data;
        this.to = params.to;
        this.gasLimit = params.gasLimit || 0;
        this.gasPrice = params.gasPrice || 0;
        this.gasUsed = params.gasUsed || 0;
        this.id = params.id;
        this.nonce = params.nonce || 0;
        this.r = params.r;
        this.s = params.s;
        this.v = params.v;
        this.timestamp = params.timestamp || 0;
        this.value = params.value ? new BN(params.value, 10) : new BN(0, 10);
        this.outputStateRoot = params.outputStateRoot || '0x';
        this.inputStateRoot = params.inputStateRoot || '0x';
    }

    async deployContract(): Promise<Account> {
        if (this.to) {
            throw new Error(`Contract deploys should not have a 'to' property attached to it`);
        }

        const addresses = getAddressFromTransaction(this);

        const contractAddress = '0x' + rlpHash([
            this.data,
            this.id,
            addresses.from,
        ]).slice(24);

        return Account.create(contractAddress, this.data, this.id);
    }

    async execute(): Promise<Results> {
        try {
            // Make sure validations can set their time.
            // if (!this.timestamp && !this.isGenesis()) {
            //     this.timestamp = Date.now();
            // }
            // non full nodes do not need to execute the function
            if (configuration.nodeType !== NodeType.FULL) {
                return null;
            }

            // This is a contract creation because we do not have a receipient
            if (!this.to) {
                // Logger.debug('Creating new contract address');
                const contractAccount = await this.deployContract();

                return {
                    exception: 0,
                    exceptionError: null,
                    gasUsed: 0,
                    returnHex: contractAccount.address,
                    return: hexStringToByte(contractAccount.address),
                    outputRoot: contractAccount.storageRoot,
                }
            }

            // It's possible that we are just calling a system contract
            let wasm: Uint8Array = getSystemContract(this.to);

            // The address is not a system contract
            if (!wasm) {
                // Check if the address is a internal contract
                const internalContract = getInternalContract(this.to);

                if (internalContract) {
                    const callMessage = createCallMessage(this);
                    const executionResults = await internalContract.execute(callMessage, this);

                    this.gasUsed = executionResults.gasUsed;
                    this.outputStateRoot = executionResults.outputRoot;

                    return executionResults;
                }

                // The contract is not internal either.. So it's either a deployed contract or a normal address
                const account = await Account.findOrCreate(this.to);

                // It's possible that an account does not have any contract attached to it
                // This means we do not have to execute any functions but should just transfer value
                if (!account.codeHash || account.codeHash === '0x00') {
                    return {
                        exception: 0,
                        exceptionError: null,
                        gasUsed: 0,
                        returnHex: '0x',
                        return: new Uint8Array(0),
                        outputRoot: '0x',
                    }
                }

            }

            const callMessage = createCallMessage(this);

            // Possibly have to save the result in the transaction.
            const executionResults = await execute(callMessage);

            this.gasUsed = executionResults.gasUsed;
            this.outputStateRoot = executionResults.outputRoot;

            return executionResults;
        } catch (error) {
            Logger.error('Executing transaction failed: ', error);
            throw error;
        }
    }

    sign(keyPair?: KeyPair) {
        if (!this.timestamp && !this.isGenesis()) {
            this.timestamp = Date.now();
        }

        const transactionDataHash = getUnsignedTransactionHash(this);

        if (keyPair) {
            // Sign the transaction to get the transaction id.
            const signature = keyPair.sign(transactionDataHash);

            this.r = signature.r;
            this.v = signature.v;
            this.s = signature.s;
        } else if (!this.r || !this.s || !this.v) {
            // The r,s,v param is available when we are validating a transaction.
            throw new Error('No keypair or signatue given');
        }

        this.id = getTransactionId(this);
    }

    /**
     * Returns true for transactions that were genesis transactions.
     *
     * @returns
     * @memberof Transaction
     */
    isGenesis() {
        return this.s === '0x0000000000000000000000000000000000000000000000000000000000000000';
    }

    toRaw(): string {
        return JSON.stringify({
            id: this.id,
            to: this.to,
            value: this.value.toString(10),
            data: this.data,
            nonce: this.nonce,
            gasPrice: this.gasPrice,
            gasLimit: this.gasLimit,
            gasUsed: this.gasUsed,
            timestamp: this.timestamp,
            r: this.r,
            s: this.s,
            v: this.v,
            inputStateRoot: this.inputStateRoot,
            outputStateRoot: this.outputStateRoot,
        });
    }

    /**
     * Converts a string version of the transaction to a model
     * Also validates the properties to make sure that the model complies
     *
     * @static
     * @param {string} rawTransaction
     * @returns {Transaction}
     * @memberof Transaction
     */
    static fromRaw(rawTransaction: string): Transaction {
        const transaction: TransactionParams = JSON.parse(rawTransaction);

        // TODO: Validate more types..
        if (typeof transaction.value !== 'string') {
            throw new TypeError('transaction.value should be a string');
        }

        return new Transaction(transaction);
    }

    /**
     * Gets a transaction from a block by it's Id
     *
     * @static
     * @param {string} id
     * @returns {Promise<Transaction>}
     * @memberof Transaction
     */
    static async getById(id: string): Promise<Transaction> {
        const result = await Transaction.getByIds([id]);

        if (!result.length) {
            return null;
        }

        return result[0];
    }

    /**
     * Gets multiple transactions by using their Id
     *
     * @static
     * @param {string[]} ids
     * @returns {Promise<Transaction[]>}
     * @memberof Transaction
     */
    static async getByIds(ids: string[]): Promise<Transaction[]> {
        const db = await startDatabase();
        const result = await db.query((doc: any, emit: any) => {
            // Make sure the doc is a Block
            if (doc.transactions && doc.transactions.length) {
                // Find the transaction inside the block
                const foundTransaction = doc.transactions.find((t: Transaction) => ids.includes(t.id));

                if (foundTransaction) {
                    emit(foundTransaction.id, foundTransaction);
                }
            }
        });

        if (!result || result.total_rows === 0) {
            return [];
        }

        // Convert all objects back to models
        return result.rows.map(row => Transaction.fromRaw(JSON.stringify(row.value)));
    }
}

export default Transaction;
