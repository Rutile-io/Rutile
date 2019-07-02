import Transaction from "./Transaction";
import { numberToHex } from "../utils/hexUtils";
import { rlpHash } from "../utils/keccak256";
import { configuration } from "../Configuration";
import { applyProofOfWork, isProofOfWorkValid } from "../services/transaction/ProofOfWork";
import { validateTransaction } from "../core/dag/lib/services/TransactionService";
import { databaseCreate } from "../services/DatabaseService";
import { getBlockById } from "../core/dag/lib/services/BlockService";

interface BlockParams {
    parents?: string[];
    outputs?: string[];
    transactions?: Transaction[];
    timestamp?: number;
    difficulty?: number;
    extraData?: string;
    nonce?: number;
    stateRoot?: string;
    transactionRoot?: string;
    receiptsRoot?: string;
    number?: number;
    gasUsed?: number;
    gasLimit?: number;
    id?: string;
}

class Block {
    /**
     * As part of the DAG, we connect blocks to other transactions.
     *
     * @type {string[]}
     * @memberof Block
     */
    parents: string[] = [];
    outputs: string[] = [];
    transactions: Transaction[] = [];
    timestamp: number = 0;
    difficulty: number = configuration.difficulty;
    extraData: string;
    nonce: number;
    stateRoot: string;
    transactionRoot: string;
    receiptsRoot: string;
    number: number = 0;
    gasUsed: number = 0;
    gasLimit: number = 0;
    id: string;

    constructor(params: BlockParams) {
        this.parents = params.parents || [];
        this.outputs = params.outputs || [];
        this.transactions = params.transactions || [];
        this.timestamp = params.timestamp || 0;
        this.difficulty = params.difficulty || configuration.difficulty;
        this.extraData = params.extraData || '0x';
        this.nonce = params.nonce || 0;
        this.stateRoot = params.stateRoot || '0x';
        this.transactionRoot = params.transactionRoot || '0x';
        this.receiptsRoot = params.receiptsRoot || '0x';
        this.number = params.number || 0;
        this.gasUsed = params.gasUsed || 0;
        this.gasLimit = params.gasLimit || 0;
        this.id = params.id || null;
    }

    async execute() {
        let results = [];

        for (const transaction of this.transactions) {
            const result = await transaction.execute();

            results.push(result);
            this.outputs.push(result.outputRoot);
        }

        return results;
    }

    /**
     * Sets the state inputs for the current block
     *
     * @param {string[]} inputRoots Merkle root inputs to execute on
     * @memberof Block
     */
    setInputs(inputRoots: string[]): void {
        if (!this.transactions.length) {
            throw new Error('Inputs should be set when transactions are set');
        }

        inputRoots.forEach((input, index) => {
            this.transactions[index].inputStateRoot = input;
        });
    }

    addParents(blocks: Block[]) {
        if (blocks.length < 2) {
            throw new Error('2 blocks should be given');
        }

        blocks.forEach((block, index) => {
            this.parents.push(block.getBlockId());

            if (this.transactions[index]) {
                this.transactions[index].inputStateRoot = block.outputs[0];
            }
        });
    }

    addTransactions(transactions: Transaction[]) {
        this.transactions.push(...transactions);
    }

    /**
     * Checks if the current block is the genesis block
     *
     * @todo Make sure that the block ids also match..
     * @returns
     * @memberof Block
     */
    isGenesis() {
        return this.number === 1;
    }

    /**
     * Applyies the Proof of Work algorythm to find a nonce that complies to the configuration.
     *
     * @returns
     * @memberof Block
     */
    proofOfWork(isMilestone: boolean = false): void {
        let difficulty = configuration.difficulty;

        if (isMilestone) {
            // TEMP
            difficulty = 6;
        }

        this.nonce = applyProofOfWork(this.getBlockId());
    }

    getBlockId() {
        if (this.id) {
            return this.id;
        }

        // Genesis blocks do not have a timestamp
        if (!this.isGenesis()) {
            this.timestamp = Date.now();
        }

        const data = [
            numberToHex(this.number),
            this.parents,
            // TODO: Convert to the actual transactions
            this.transactions.map(tx => tx.id),
            numberToHex(this.timestamp),
            this.stateRoot,
            this.transactionRoot,
            numberToHex(this.gasUsed),
            this.outputs,
        ];

        this.id = '0x' + rlpHash(data);

        return this.id;
    }

    toString() {
        return this.toRaw();
    }

    toRaw(): string {
        return JSON.stringify({
            id: this.getBlockId(),
            parents: this.parents,
            transactions: this.transactions.map(tx => JSON.parse(tx.toRaw())),
            timestamp: this.timestamp,
            difficulty: this.difficulty,
            extraData: this.extraData,
            nonce: this.nonce,
            stateRoot: this.stateRoot,
            transactionRoot: this.transactionRoot,
            gasUsed: this.gasUsed,
            gasLimit: this.gasLimit,
            number: this.number,
            outputs: this.outputs,
        });
    }

    /**
     * Validates this block
     *
     * @memberof Block
     */
    async validate() {
        if (!this.isGenesis() && (this.parents.length < 2 || this.parents.length > 3)) {
            throw new Error(`Block ${this.id} should validate 2 other transactions`);
        }

        if (!this.transactions.length || this.transactions.length > 1) {
            throw new Error('Block should only have 1 transaction included in them');
        }

        // For effeciency sake, first check the proof of work.
        // Since we don't have to go through all the work if the PoW isn't even valid.
        if (!isProofOfWorkValid(this.id, this.nonce)) {
            throw new Error('Proof of work is not valid');
        }

        for (const [index, transaction] of this.transactions.entries()) {
            // We need to make sure the parents that where used are used as state root
            if (!this.isGenesis()) {
                const parentBlock = await getBlockById(this.parents[index]);

                if (!parentBlock) {
                    throw new Error(`Could not find block ${this.parents[index]}`);
                }

                if (parentBlock.outputs[0] !== transaction.inputStateRoot) {
                    throw new Error('Input does not match the output of the parent blocks');
                }
            }

            await validateTransaction(transaction);
        }
    }

    /**
     * Saves the block in the database
     *
     * @memberof Block
     */
    async save() {
        const rawBlock = this.toRaw();
        await databaseCreate(this.id, JSON.parse(rawBlock));
    }

    static fromRaw(rawBlock: string) {
        const blockParams: BlockParams = JSON.parse(rawBlock);

        // First convert all transactions back to the classes
        const transactions = blockParams.transactions.map(tx => Transaction.fromRaw(JSON.stringify(tx)));
        blockParams.transactions = transactions;

        return new Block(blockParams);
    }
}

export default Block;
