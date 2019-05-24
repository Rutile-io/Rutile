import Ipfs from "../services/wrappers/Ipfs";
import { configuration } from "../Configuration";
import KeyPair from "./KeyPair";
import { getUnsignedTransactionHash, getTransactionId } from "../core/dag/lib/services/TransactionService";
import { applyProofOfWork } from "../services/transaction/ProofOfWork";
import execute from "../core/rvm/execute";
import stringToByteArray from "../utils/stringToByteArray";
import BNtype from 'bn.js';
import { NodeType } from "./interfaces/IConfig";
import Account from "./Account";
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

    // The weight of this transaction + all weight of transactions
    // that directly or indirectly confirms this transaction
    cumulativeWeight: number = 1;

    // The transaction own weight. Currently is fixed to 1.
    weight: number = 1;

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

    async execute() {
        try {
            // non full nodes do not need to execute the function
            if (configuration.nodeType !== NodeType.FULL) {
                return null;
            }

            const ipfs = Ipfs.getInstance(configuration.ipfs);
            const account = await Account.findOrCreate(this.to);

            // It's possible that an account does not have any contract attached to it
            // This means we do not have to execute any functions
            if (!account.codeHash) {
                return null;
            }

            // "to" should represent the wasm function address or the user address.
            const contents = await ipfs.cat(this.to);
            const wasm = stringToByteArray(contents);

            // Make sure validations can set their time.
            if (!this.timestamp) {
                this.timestamp = Date.now();
            }

            // Possibly have to save the result in the transaction.
            const executionResults = await execute(this, wasm);
            this.gasUsed = executionResults.gasUsed;

            return executionResults;
        } catch (error) {
            console.error('Executing transaction failed', error);
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
