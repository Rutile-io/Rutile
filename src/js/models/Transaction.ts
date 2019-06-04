import * as Logger from 'js-logger';
import Ipfs from "../services/wrappers/Ipfs";
import { configuration } from "../Configuration";
import KeyPair from "./KeyPair";
import { getUnsignedTransactionHash, getTransactionId, getAddressFromTransaction } from "../core/dag/lib/services/TransactionService";
import { applyProofOfWork } from "../services/transaction/ProofOfWork";
import execute from "../core/rvm/execute";
import stringToByteArray from "../utils/stringToByteArray";
import BNtype from 'bn.js';
import { NodeType } from "./interfaces/IConfig";
import Account from "./Account";
import { rlpHash } from "../utils/keccak256";
import { hexStringToString } from "../utils/hexUtils";
import { Results } from '../core/rvm/context';
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
    transIndex?: number;
    milestoneIndex?: number;
    parents?: string[];
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

    // The nonce used to find the PoW hash
    nonce?: number = 0;

    // number of transaction made by the address
    transIndex?: number = 0;

    // The milestone index. Only apply's to milestone creators.
    milestoneIndex?: number = null;

    // To which address to send tokens to.
    // Can also be a function address
    to?: string;

    // data as arguments or a message to send along with the transactions
    data?: string;

    // Parents of the transaction
    parents: string[] = [];

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
        this.milestoneIndex = params.milestoneIndex || null;
        this.timestamp = params.timestamp || 0;
        this.value = params.value ? new BN(params.value, 10) : new BN(0, 10);
        this.transIndex = params.transIndex || 0;
        this.parents = params.parents || [];
    }

    async deployContract(): Promise<Account> {
        if (this.to) {
            throw new Error(`Contract deploys should not have a 'to' property attached to it`);
        }

        const addresses = getAddressFromTransaction(this);

        const contractAddress = '0x' + rlpHash([
            this.data,
            addresses.from,
        ]).slice(24);

        return Account.create(contractAddress, this.data);
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

            const ipfs = Ipfs.getInstance(configuration.ipfs);

            // This is a contract creation because we do not have a receipient
            if (!this.to) {
                Logger.debug('Creating new contract address');
                const contractAccount = await this.deployContract();

                return {
                    exception: 0,
                    exceptionError: null,
                    gasUsed: 0,
                    return: contractAccount.address,
                }
            }

            const account = await Account.findOrCreate(this.to);

            // It's possible that an account does not have any contract attached to it
            // This means we do not have to execute any functions but should just transfer value
            if (!account.codeHash || account.codeHash === '0x00') {
                return null;
            }

            const ipfsHash = hexStringToString(account.codeHash);
            const contents = await ipfs.cat(ipfsHash);
            const wasm = stringToByteArray(contents);

            // Possibly have to save the result in the transaction.
            const executionResults = await execute(this, wasm);
            this.gasUsed = executionResults.gasUsed;

            return executionResults;
        } catch (error) {
            Logger.error('Executing transaction failed ->', error);
            return null;
        }
    }

    async addParents(transactions: Transaction[]) {
        if (transactions.length < 2) {
            throw new Error('2 transactions should be given');
        }

        for (let i = 0; i < transactions.length; i++) {
            this.parents.push(transactions[i].id);
        }
    }

    /**
     * Applyies the Proof of Work algorythm to find a nonce that complies to the configuration.
     *
     * @returns
     * @memberof Transaction
     */
    proofOfWork(): void {
        if (!this.id) {
            throw new Error('Proof of Work requires the transaction to be signed');
        }

        this.nonce = applyProofOfWork(this.id);
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

    toRaw(): string {
        return JSON.stringify({
            id: this.id,
            to: this.to,
            value: this.value.toString(10),
            data: this.data,
            nonce: this.nonce,
            transIndex: this.transIndex,
            gasPrice: this.gasPrice,
            gasLimit: this.gasLimit,
            gasUsed: this.gasUsed,
            timestamp: this.timestamp,
            milestoneIndex: this.milestoneIndex,
            parents: this.parents,
            r: this.r,
            s: this.s,
            v: this.v,
        });
    }

    isGenesis() {
        // TODO: More checks. Such as the id compared to the configuration
        return this.milestoneIndex === 1;
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
}

export default Transaction;
