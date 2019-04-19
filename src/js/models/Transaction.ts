import Ipfs from "../services/wrappers/Ipfs";
import { configuration } from "../Configuration";
import KeyPair from "./KeyPair";
import { getUnsignedTransactionHash, getTransactionId } from "../core/dag/lib/services/TransactionService";
import { applyProofOfWork } from "../services/transaction/ProofOfWork";
import execute from "../core/rvm/execute";
import stringToByteArray from "../utils/stringToByteArray";

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
    value?: number;
    transIndex?: number;
    milestoneIndex?: number;
    branchTransaction?: string;
    trunkTransaction?: string;
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
    value?: number = 0;

    // Timestamp of transaction
    timestamp?: number = 0;

    // Transactions that are attached
    branchTransaction: string = '';
    trunkTransaction: string = '';

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
        this.value = params.value || 0;
        this.transIndex = params.transIndex || 0;
        this.trunkTransaction = params.trunkTransaction;
        this.branchTransaction = params.branchTransaction;
    }

    async execute() {
        try {
            return null;
            const ipfs = Ipfs.getInstance(configuration.ipfs);

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

    async addParents(branchTransaction: Transaction, trunkTransaction: Transaction) {
        if (!branchTransaction || !trunkTransaction) {
            throw new Error('2 transactions should be given');
        }

        this.branchTransaction = branchTransaction.id;
        this.trunkTransaction = trunkTransaction.id;
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
            value: this.value,
            data: this.data,
            nonce: this.nonce,
            transIndex: this.transIndex,
            gasPrice: this.gasPrice,
            gasLimit: this.gasLimit,
            gasUsed: this.gasUsed,
            timestamp: this.timestamp,
            milestoneIndex: this.milestoneIndex,
            trunkTransaction: this.trunkTransaction,
            branchTransaction: this.branchTransaction,
            r: this.r,
            s: this.s,
            v: this.v,
        });
    }

    isGenesis() {
        return this.milestoneIndex === 1;
    }

    static fromRaw(rawTransaction: string): Transaction {
        const transaction: TransactionParams = JSON.parse(rawTransaction);

        // Validate types..
        if (typeof transaction.value !== 'number') {
            throw new TypeError('transaction.value should be a number');
        }

        return new Transaction(transaction);
    }
}

export default Transaction;
