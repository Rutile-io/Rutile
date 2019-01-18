import Ipfs from "../services/wrappers/Ipfs";
import { configuration } from "../Configuration";
import Lamda from "../Lamda";
import KeyPair from "./KeyPair";
import Account from "./Account";
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
    nonce?: number = 0;

    // number of transaction made by the address
    transIndex?: number;

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
        this.nonce = params.nonce || 0;
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

            // Possibly have to save the result in the transaction.
            const result = await lamda.execute(this.state, this.data);

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
        while (!this.isProofOfWorkValid()) {
            this.nonce += 1;
        }

        this.proofOfWorkHash = this.calculateHash();

        return this.proofOfWorkHash;
    }

    sign(keyPair?: KeyPair) {
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

        const transactionIdData = JSON.stringify({
            hash: transactionDataHash,
            r: this.r,
            v: this.v,
            s: this.s,
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
            transIndex: this.transIndex,
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

    static async validate(transaction: Transaction) {
        // For effeciency sake, first check the proof of work.
        // Since we don't have to go through all the work if the transaction isn't even valid.
        if (!transaction.isProofOfWorkValid()) {
            throw new Error('Proof of Work is not valid');
        }

        const dataToHash = JSON.stringify({
            data: transaction.data,
            to: transaction.to,
            value: transaction.value,
            gasPrice: transaction.gasPrice,
            gasLimit: transaction.gasLimit,
            timestamp: transaction.timestamp,
            trunkTransaction: transaction.trunkTransaction,
            branchTransaction: transaction.branchTransaction,
        });

        const transactionDataHash: string = createKeccakHash('keccak256').update(dataToHash).digest('hex');

        // First we need to find the account that is associated with the transaction
        // Making sure we bind the correct user to it.
        const pubKey = KeyPair.recoverAddress(transactionDataHash, {
            r: transaction.r,
            s: transaction.s,
            v: transaction.v,
        });

        const account = await Account.findOrCreate(pubKey);

        // Make sure that balance updates are possible
        account.validateTransaction(transaction);

        // Now make a copy of the transaction so we can validate it ourself.
        const transactionCopy = new Transaction({
            to: transaction.to,
            data: transaction.data,
            r: transaction.r,
            s: transaction.s,
            v: transaction.v,
            timestamp: transaction.timestamp,
            nonce: transaction.nonce,
        });

        // Execute to get to the same point as the
        await transactionCopy.execute();

        // "Sign" the transaction, since we are taking the signatures from the created transaction
        transactionCopy.sign();

        // Check the Proof of Work again to make sure all the work adds up.
        if (!transactionCopy.isProofOfWorkValid()) {
            throw new Error('Proof of Work after execution is not valid');
        }

        await account.applyTransaction(transaction);

        return true;
    }
}

export default Transaction;
