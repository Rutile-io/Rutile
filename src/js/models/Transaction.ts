import * as Logger from 'js-logger';
import * as RLP from 'rlp';
import KeyPair from "./KeyPair";
import { getTransactionId, validateTransaction } from "../core/chain/lib/services/TransactionService";
import execute from "../core/rvm/execute";
import BNtype from 'bn.js';
import { Results } from '../core/rvm/context';
import createCallMessage from '../services/createCallMessage';
import { hexStringToByte } from '../core/rvm/utils/hexUtils';
import getInternalContract from '../services/getInternalContract';
import { startDatabase, createOrUpdate } from '../services/DatabaseService';
import { applyProofOfWork } from '../services/transaction/ProofOfWork';
import { transferTransactionValue, deployContract, getContractBinary } from '../core/chain/lib/services/TransactionExecutionService';
import Block from './Block';
import GlobalState from './GlobalState';
import { numberToHex, hexStringToBuffer } from '../utils/hexUtils';
import { configuration } from '../Configuration';
import keccak256 from '../utils/keccak256';

const BN = require('bn.js');

export interface TransactionExecuteResult {
    result: Results;
    globalState: GlobalState;
}

export interface TransactionParams {
    to: string;
    data?: string;
    gasLimit?: number;
    gasPrice?: number;
    gasUsed?: number;
    id?: string;
    nonce?: BNtype;
    r?: string;
    s?: string;
    v?: number;
    timestamp?: number;
    value?: number | string | BNtype;
    referencedMilestonIndex?: number;
    transIndex?: number;
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

    // Proof of work nonce of transaction
    nonce?: BNtype;

    transIndex?: number = 0;

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
        this.nonce = params.nonce || new BN(0);
        this.r = params.r;
        this.s = params.s;
        this.v = params.v;
        this.timestamp = params.timestamp || 0;
        this.value = params.value ? new BN(params.value, 10) : new BN(0, 10);
    }

    public hash(includeSignature = true) {
        const encodeTx = this.toBuffer(includeSignature);
        const hash = keccak256(encodeTx);

        if (includeSignature) {
            this.id = '0x' + hash;
        }

        return hash;
    }

    /**
     * Executes the transaction
     *
     * @param {Block} block Which block the transaction is part of
     * @returns {Promise<Results>}
     * @memberof Transaction
     */
    public async execute(block: Block, globalState: GlobalState): Promise<TransactionExecuteResult> {
        try {
            // This is a contract creation because we do not have a receipient
            if (!this.to) {
                const createdContractAccount = await deployContract(this);

                return {
                    result: {
                        exception: 0,
                        exceptionError: null,
                        gasUsed: this.gasUsed,
                        returnHex: createdContractAccount.address,
                        return: hexStringToByte(createdContractAccount.address),
                        outputRoot: createdContractAccount.storageRoot,
                        createdAddress: true,
                    },
                    globalState,
                };
            }

            // Transfer the RUT value
            // The function just manipulates the balance portion of the account
            globalState = await transferTransactionValue(this, globalState);

            const toAccount = await globalState.findOrCreateAccount(this.to);
            const internalContract = getInternalContract(toAccount.address);
            const callMessage = await createCallMessage(this);

            // We are calling an internal JS contract
            if (internalContract) {
                const executionResults = await internalContract.execute(callMessage, globalState, this);
                this.gasUsed += executionResults.gasUsed;

                return {
                    result: executionResults,
                    globalState,
                };
            }

            const contractBinary = await getContractBinary(toAccount);

            // No binary found, so we should treat this just as a value transfer
            if (!contractBinary) {
                return {
                    result: {
                        exception: 0,
                        exceptionError: null,
                        gasUsed: this.gasUsed,
                        outputRoot: toAccount.storageRoot,
                        return: new Uint8Array(),
                        returnHex: '0x',
                        createdAddress: false,
                    },
                    globalState,
                };
            }

            // Possibly have to save the result in the transaction.
            const executionResults = await execute({
                callMessage,
                globalState,
                bin: contractBinary,
            });

            this.gasUsed += executionResults.gasUsed;

            return {
                result: executionResults,
                globalState,
            };
        } catch (error) {
            Logger.error('Executing transaction failed: ', error);
            throw error;
        }
    }

    sign(keyPair?: KeyPair) {
        if (!this.timestamp && !this.isGenesis()) {
            this.timestamp = Date.now();
        }

        const transactionDataHash = this.hash(false);

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

    /**
     * Checks whether the current transaction is part of the milestone chain
     *
     * @returns {Promise<boolean>}
     * @memberof Transaction
     */
    async isMilestone(): Promise<boolean> {
        return true;
    }

    toRaw(): string {
        this.hash(true);

        const data = JSON.stringify({
            id: this.id,
            to: this.to,
            value: this.value.toString(10),
            data: this.data,
            nonce: '0x' + this.nonce.toString('hex'),
            gasPrice: this.gasPrice,
            gasLimit: this.gasLimit,
            gasUsed: this.gasUsed,
            timestamp: this.timestamp,
            r: this.r,
            s: this.s,
            v: this.v,
            transIndex: this.transIndex,
        });

        return data;
    }

    toBuffer(includeSignature: boolean = true): Buffer {
        const data = [
            this.nonce.isZero() ? hexStringToBuffer('0x') : this.nonce.toBuffer(),
            this.gasPrice !== 0 ? hexStringToBuffer(numberToHex(this.gasPrice)): hexStringToBuffer('0x'),
            Buffer.from(this.gasLimit.toString(16), 'hex'),
            hexStringToBuffer(this.to),
            this.value.isZero() ? hexStringToBuffer('0x') : this.value.toBuffer(),
            hexStringToBuffer(this.data),
        ];

        if (includeSignature) {
            data.push(
                hexStringToBuffer(this.r),
                hexStringToBuffer(this.s),
                hexStringToBuffer(numberToHex(this.v)),
            );
        }

        data.push(hexStringToBuffer(numberToHex(configuration.genesis.config.chainId)));
        data.push(Buffer.from(''));
        data.push(Buffer.from(''));

        // return RLP.encode(data);
        return RLP.encode(data);
    }

    static fromBuffer(rawBufferData: Buffer): Transaction {
        const decodedData: any = RLP.decode(rawBufferData);
        const data: Buffer[] = decodedData;

        const transaction = new Transaction({
            nonce: new BN(data[0]),
            gasPrice: parseInt('0x' + data[1].toString('hex')),
            gasLimit: parseInt('0x' + data[2].toString('hex')),
            to: '0x' + data[3].toString('hex'),
            value: new BN(data[4]),
            data: '0x' + data[5].toString('hex'),
            r: '0x' + data[7].toString('hex'),
            v: parseInt('0x' + data[6].toString('hex')),
            s: '0x' + data[8].toString('hex'),
        });

        transaction.hash(true);

        return transaction;
    }

    /**
     * Validates the transaction
     *
     * @param {boolean} [noExecution=false]
     * @returns
     * @memberof Transaction
     */
    async validate() {
        return validateTransaction(this);
    }

    /**
     * Saves the transaction to the database (updates it if it already exists)
     *
     * @memberof Transaction
     */
    async save() {
        const rawTransaction = this.toRaw();
        await createOrUpdate(this.id, JSON.parse(rawTransaction));
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
        if (!rawTransaction) {
            throw new Error('fromRaw cannot be called without a parsable string');
        }

        const transaction: TransactionParams = JSON.parse(rawTransaction);

        // @ts-ignore
        transaction.nonce = transaction.nonce.replace('0x', '');
        transaction.nonce = new BN(transaction.nonce, 'hex');

        // TODO: Validate more types..
        if (typeof transaction.value !== 'string') {
            throw new TypeError('transaction.value should be a string');
        }

        return new Transaction(transaction);
    }

    /**
     * Gets a transaction by it's Id
     *
     * @static
     * @param {string} id
     * @returns {Promise<Transaction>}
     * @memberof Transaction
     */
    static async getById(id: string): Promise<Transaction> {
        if (!id) {
            throw new Error('getById cannot be called with undefined as given parameter');
        }

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
        if (ids.includes(undefined)) {
            throw new Error('getByIds cannot be called with undefined as given parameter');
        }

        const db = await startDatabase();
        const result = await db.query((doc: any, emit: any) => {
            if (doc.transactions && doc.transactions.length) {
                const transaction = doc.transactions.find((tx: Transaction) => ids.includes(tx.id));

                if (transaction) {
                    emit(transaction.id, transaction);
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
