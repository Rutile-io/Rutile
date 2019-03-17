import Ipfs from "../services/wrappers/Ipfs";
import { configuration } from "../Configuration";
import Lamda from "../Lamda";
import KeyPair from "./KeyPair";
import Account from "./Account";
import sortObjKeysAlphabetically from "../utils/sortObjKeysAlphabetically";
import { getUnsignedTransactionHash, getTransactionId } from "../services/TransactionService";
import { applyProofOfWork, isProofOfWorkValid } from "../services/transaction/ProofOfWork";
const createKeccakHash = require('keccak');

interface TransactionParams {
    to: string;
    data?: any[];
    gasLimit?: number;
    gasPrice?: number;
    id?: string;
    nonce?: number;
    r?: string;
    s?: string;
    v?: number;
    timestamp?: number;
    value?: number;
    transIndex?: number;
    parents?: string[];
    milestoneIndex?: number;
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

    // Id's of transactions that are validated
    parents: string[];

    // The nonce used to find the PoW hash
    nonce?: number = 0;

    // number of transaction made by the address
    transIndex?: number = 0;

    // The milestone index. Only apply's to milestone creators.
    milestoneIndex?: number = null;

    // To which address to send tokens to.
    // Can also be a function address
    to?: string;

    // From which address the tokens came
    // When empty this means new tokens are in circulation (Milestone)
    from?: string;

    // data as arguments or a message to send along with the transactions
    data?: any[];

    constructor(params: TransactionParams) {
        this.data = params.data;
        this.to = params.to;
        this.gasLimit = params.gasLimit || 0;
        this.gasPrice = params.gasPrice || 0;
        this.id = params.id;
        this.nonce = params.nonce || 0;
        this.r = params.r;
        this.s = params.s;
        this.v = params.v;
        this.milestoneIndex = params.milestoneIndex || null;
        this.timestamp = params.timestamp || 0;
        this.value = params.value || 0;
        this.transIndex = params.transIndex || 0;
        this.parents = params.parents || [];
    }

    async execute() {
        try {
            const ipfs = Ipfs.getInstance(configuration.ipfs);

            // "to" should represent the wasm function address or the user address.
            const contents = await ipfs.cat(this.to);
            const lamda = Lamda.fromCompiledLamdaString(contents);

            // Possibly have to save the result in the transaction.
            const result = await lamda.execute({}, this.data);

            this.gasUsed = result.gasUsed;

            // Make sure validations can set their time.
            if (!this.timestamp) {
                this.timestamp = Date.now();
            }

            return result;
        } catch (error) {
            console.error('Executing transaction failed', error);
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
            timestamp: this.timestamp,
            milestoneIndex: this.milestoneIndex,
            parents: this.parents,
            r: this.r,
            s: this.s,
            v: this.v,
        });
    }

    static fromRaw(rawTransaction: string): Transaction {
        const transaction: TransactionParams = JSON.parse(rawTransaction);

        return new Transaction(transaction);
    }
}

export default Transaction;
