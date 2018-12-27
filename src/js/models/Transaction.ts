import Ipfs from "../services/wrappers/Ipfs";
import { configuration } from "../Configuration";
import Lamda from "../Lamda";
const createKeccakHash = require('keccak');


interface TransactionParams {
    to: string;
    data?: any[];
}

class Transaction {
    details: {
        // The hash of the transaction (Not by PoW)
        hash?: string;

        // Gas used for function execution
        gasUsed?: number;

        // Tiles willing to pay for transaction
        gasPrice?: number;

        // Gas limit (Don't apply to client execution)
        gasLimit?: number;

        // Signature of transaction done by client
        r: string;
        s: string;
        v: number;

        // The value of tiles transfered
        value?: number;

        // Timestamp of transaction
        timestamp?: number;

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
    }

    // Contains the current state of the application
    state: any = {};

    constructor(params: TransactionParams) {
        this.details = {
            ...this.details,
            ...params,
        }
    }

    fillState(state: any) {
        this.state = state;
    }

    async execute() {
        try {
            const ipfs = Ipfs.getInstance(configuration.ipfs);

            // "to" should represent the wasm function address or the user address.
            const contents = await ipfs.cat(this.details.to);
            const lamda = Lamda.fromCompiledLamdaString(contents);

            const result = await lamda.execute(this.state, this.details.data);

            this.details.gasUsed = result.gasUsed;

            return result;
        } catch (error) {
            console.error('Transaction failed', error);
        }
    }

    async validate() {
        // Validate the hash
    }

    calculateHash() {
        const dataToHash = `${this.details.to}${this.details.from}${this.details.gasUsed}${this.details.nonce}`;
        return createKeccakHash('keccak256').update(dataToHash).digest('hex');
    }

    mine() {
        let transactionHash = '';
        this.details.nonce = 0;

        while (transactionHash.substring(0, configuration.difficulty) !== Array(configuration.difficulty + 1).join('0')) {
            this.details.nonce += 1;
            transactionHash = this.calculateHash();
        }

        console.log('[] this.details.nonce -> ', this.details.nonce);
        return transactionHash;
    }
}

export default Transaction;
