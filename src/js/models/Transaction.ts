import Ipfs from "../services/wrappers/Ipfs";
import { configuration } from "../Configuration";
import Lamda from "../Lamda";
import KeyPair from "./KeyPair";
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

    // Transaction hash
    trunkTransaction?: string;

    // Transaction hash
    branchTransaction?: string;

    // The nonce used to find the PoW hash
    nonce?: number;

    // number of transaction made by the address
    transNum?: number;

    // To which address to send tokens to.
    // Can also be a function address
    to?: string;

    // From which address the tokens came
    // When empty this means new tokens are in circulation (Milestone)
    from?: string;

    // data as arguments or a message to send along with the transactions
    data?: any[];

    // Contains the current state of the application
    state: any = {};

    // The hash calculated by proof of work
    proofOfWorkHash: string;

    constructor(params: TransactionParams) {
        this.data = params.data;
        this.to = params.to;
        this.gasLimit = params.gasLimit || 0;
        this.gasPrice = params.gasPrice || 0;
        this.id = params.id;
        this.nonce = params.nonce;
        this.r = params.r;
        this.s = params.s;
        this.v = params.v;
        this.timestamp = params.timestamp || 0;
        this.value = params.value || 0;
    }

    fillState(state: any) {
        this.state = state;
    }

    async execute() {
        try {
            const ipfs = Ipfs.getInstance(configuration.ipfs);

            // "to" should represent the wasm function address or the user address.
            const contents = await ipfs.cat(this.to);
            const lamda = Lamda.fromCompiledLamdaString(contents);

            const result = await lamda.execute(this.state, this.data);

            this.gasUsed = result.gasUsed;
            this.timestamp = Date.now();

            return result;
        } catch (error) {
            console.error('Executing transaction failed', error);
        }
    }

    /**
     * Checks if Proof of Work is valid.
     *
     * @returns {boolean}
     * @memberof Transaction
     */
    isProofOfWorkValid(): boolean {
        // Validate the hash
        const transactionHash = this.calculateHash();

        if (transactionHash.substring(0, configuration.difficulty) !== Array(configuration.difficulty + 1).join('0')) {
            return false;
        }

        console.log('[] transactionHash -> ', transactionHash);

        return true;
    }

    /**
     * Calculates the hash for Proof of Work.
     *
     * @returns {string}
     * @memberof Transaction
     */
    calculateHash(): string {
        if (!this.id) {
            throw new Error('Cannot calculate hash if transaction has not been signed');
        }

        return createKeccakHash('keccak256').update(`${this.id}${this.nonce}`).digest('hex');
    }

    /**
     * Applyies the Proof of Work algorythm to find a nonce that complies to the configuration.
     *
     * @returns
     * @memberof Transaction
     */
    proofOfWork() {
        let transactionHash = '';
        this.nonce = 0;

        while (!this.isProofOfWorkValid()) {
            this.nonce += 1;
            transactionHash = this.calculateHash();
        }

        this.proofOfWorkHash = transactionHash;

        return transactionHash;
    }

    sign(keyPair: KeyPair) {
        const dataToHash = JSON.stringify({
            data: this.data,
            to: this.to,
            value: this.value,
            gasPrice: this.gasPrice,
            gasLimit: this.gasLimit,
            timestamp: this.timestamp,
            trunkTransaction: this.trunkTransaction,
            branchTransaction: this.branchTransaction,
        });

        const transactionDataHash: string = createKeccakHash('keccak256').update(dataToHash).digest('hex');

        // Sign the transaction to get the transaction id.
        const signature = keyPair.sign(transactionDataHash);

        this.r = signature.r;
        this.v = signature.v;
        this.s = signature.s;

        const transactionIdData = JSON.stringify({
            hash: transactionDataHash,
            r: signature.r,
            v: signature.v,
            s: signature.s,
        });

        const transactionId: string = createKeccakHash('keccak256').update(transactionIdData).digest('hex');

        this.id = transactionId;
    }

    toRaw(): string {
        return JSON.stringify({
            id: this.id,
            to: this.to,
            value: this.value,
            data: this.data,
            nonce: this.nonce,
            transNum: this.transNum,
            gasPrice: this.gasPrice,
            gasLimit: this.gasLimit,
            timestamp: this.timestamp,
            trunkTransaction: this.trunkTransaction,
            branchTransaction: this.branchTransaction,
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
