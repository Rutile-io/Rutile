import * as Logger from 'js-logger';
import Transaction from "./Transaction";
import { numberToHex } from "../utils/hexUtils";
import { rlpHash } from "../utils/keccak256";
import { configuration } from "../Configuration";
import { applyProofOfWork, isProofOfWorkValid } from "../services/transaction/ProofOfWork";
import { validateTransaction } from "../core/dag/lib/services/TransactionService";
import { databaseCreate, startDatabase } from "../services/DatabaseService";
import { getBlockById } from "../core/dag/lib/services/BlockService";
import { Results } from "../core/rvm/context";

interface BlockParams {
    parents?: string[];
    inputs?: string[];
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

    /**
     * Merkle root outputs (After execution)
     *
     * @type {string[]}
     * @memberof Block
     */
    outputs: string[] = [];

    /**
     * Input of transaction ids that the block uses as state source
     *
     * @type {string[]}
     * @memberof Block
     */
    inputs: string[] = [];
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
        this.inputs = params.inputs || [];
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

    /**
     * Executes all transactions inside the block and saves the output
     *
     * @returns
     * @memberof Block
     */
    async execute(): Promise<Results[]> {
        if (this.inputs.length !== this.transactions.length) {
            console.log('[] this.block -> ', this);
            throw new Error('(execute) Input size does not match transaction size');
        }

        const results = [];
        const inputTransactions = await Transaction.getByIds(this.inputs);

        for (const [index, transaction] of this.transactions.entries()) {
            const input = inputTransactions.find(tx => tx.id === this.inputs[index]);

            if (input) {
                // transaction.inputStateRoot = input.outputStateRoot;
            } else {
                Logger.debug(`(execute) Could not find transaction ${this.inputs[index]} as input, going with an empty input`);
            }

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
            // this.transactions[index].inputStateRoot = input;
        });
    }

    /**
     * Adds the parent blocks to this block
     *
     * @param {Block[]} blocks
     * @memberof Block
     */
    addParents(blocks: Block[]) {
        if (blocks.length < 2) {
            throw new Error('2 blocks should be given');
        }

        blocks.forEach((block) => {
            this.parents.push(block.getBlockId());
        });
    }

    /**
     * Adds transactions to this block
     *
     * @param {Transaction[]} transactions
     * @memberof Block
     */
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
            // this.stateRoot,
            this.transactionRoot,
            numberToHex(this.gasUsed),
            this.outputs,
            this.inputs,
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
            inputs: this.inputs,
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

        if (!this.isGenesis()) {
            if (!this.transactions.length || this.transactions.length > 1) {
                throw new Error('Block should only have 1 transaction included in them');
            }
        }

        // For effeciency sake, first check the proof of work.
        // Since we don't have to go through all the work if the PoW isn't even valid.
        if (!isProofOfWorkValid(this.id, this.nonce)) {
            throw new Error('Proof of work is not valid');
        }

        // We can't have no input for a transaction
        if (this.inputs.length !== this.transactions.length) {
            throw new Error(`Input length should match the transactions length ${this.inputs.length}!=${this.transactions.length}`);
        }

        // Validate every transaction in the block
        for (const [index, transaction] of this.transactions.entries()) {
            // We need to make sure the parents that where used are used as state root
            if (!this.isGenesis()) {
                const parentBlock = await getBlockById(this.parents[index]);

                if (!parentBlock) {
                    throw new Error(`Could not find block ${this.parents[index]}`);
                }

                // if (parentBlock.outputs[0] !== transaction.inputStateRoot) {
                //     throw new Error('Input does not match the output of the parent blocks');
                // }

                // Also make sure the block output matches the transaction output
                // if (this.outputs[index] !== transaction.outputStateRoot) {
                //     throw new Error('Output in block does not match the outputStateRoot of the transaction');
                // }
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

    /**
     * Converts a raw block string to a block model
     *
     * @static
     * @param {string} rawBlock
     * @returns
     * @memberof Block
     */
    static fromRaw(rawBlock: string) {
        const blockParams: BlockParams = JSON.parse(rawBlock);

        if (!blockParams.transactions || !blockParams.transactions.length) {
            throw new Error('Block without transactions is not allowed');
        }

        // First convert all transactions back to the classes
        const transactions = blockParams.transactions.map(tx => Transaction.fromRaw(JSON.stringify(tx)));
        blockParams.transactions = transactions;

        return new Block(blockParams);
    }

    /**
     * Gets multiple blocks by the given transaction ids
     *
     * @static
     * @param {string[]} transactionIds
     * @returns {Promise<Block[]>}
     * @memberof Block
     */
    static async getByTransactionIds(transactionIds: string[]): Promise<Block[]> {
        const db = await startDatabase();
        const result = await db.query((doc: any, emit: any) => {
            // Make sure the doc is a Block
            if (doc.transactions && doc.transactions.length) {
                // Find the transaction inside the block
                const foundTransaction = doc.transactions.find((t: Transaction) => transactionIds.includes(t.id));

                if (foundTransaction) {
                    // This block contains the given transaction
                    emit(doc.id, doc);
                }
            }
        });

        if (!result || result.total_rows === 0) {
            return [];
        }

        // Convert all objects back to models
        return result.rows.map(row => Block.fromRaw(JSON.stringify(row.value)));
    }

    /**
     * Gets a block using a transaction id
     *
     * @static
     * @param {string} transactionId
     * @returns {Promise<Block>}
     * @memberof Block
     */
    static async getByTransactionId(transactionId: string): Promise<Block> {
        const result = await Block.getByTransactionIds([transactionId]);

        if (!result.length) {
            return null;
        }

        return result[0];
    }
}

export default Block;
