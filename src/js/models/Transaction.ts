import Ipfs from "../services/wrappers/Ipfs";
import { configuration } from "../Configuration";
import Lamda from "../Lamda";

interface TransactionParams {
    lamdaAddress: string;
}

class Transaction<T> {
    details: {
        // Filled only when function has been deployed.
        lamdaAddress?: string;

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
        nonce?: string;

        // number of transaction made by the address
        transNum?: number;

        // To which address to send tokens to.
        // Can also be a function address
        to?: string;

        // data as arguments or a message to send along with the transactions
        data?: string;
    }

    constructor(params: TransactionParams) {
        this.details = {
            ...this.details,
            ...params,
        }
    }

    async execute() {
        try {
            const ipfs = Ipfs.getInstance(configuration.ipfs);
            const contents = await ipfs.cat(this.details.lamdaAddress);
            const lamda = Lamda.fromCompiledLamdaString(contents);

            const result = await lamda.execute();

            this.details.gasUsed = result.gasUsed;

            return result;
        } catch (error) {
            console.error('Transaction failed', error);
        }
    }

    calculateHash() {

    }

    proofOfWork() {

    }
}

export default Transaction;
