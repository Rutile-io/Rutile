import Transaction from "./Transaction";
import { numberToHex } from "../utils/hexUtils";
import { rlpHash } from "../utils/keccak256";
import { configuration } from "../Configuration";
import { applyProofOfWork, isProofOfWorkValid } from "../services/transaction/ProofOfWork";
import { validateTransaction } from "../core/dag/lib/services/TransactionService";
import { databaseCreate } from "../services/DatabaseService";

interface BlockParams {
    parents?: string[];
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
            results.push(await transaction.execute());
        }

        return results;
    }

    addParents(blocks: Block[]) {
        if (blocks.length < 2) {
            throw new Error('2 blocks should be given');
        }

        blocks.forEach(block => this.parents.push(block.getBlockId()));
    }

    addTransactions(transactions: Transaction[]) {
        this.transactions.push(...transactions);
    }

    isGenesis() {
        return this.number === 1;
    }

    /**
     * Applyies the Proof of Work algorythm to find a nonce that complies to the configuration.
     *
     * @returns
     * @memberof Block
     */
    proofOfWork(): void {
        this.nonce = applyProofOfWork(this.getBlockId());
    }

    getBlockId() {
        const data = [
            numberToHex(this.number),
            this.parents,
            // TODO: Convert to the actual transactions
            this.transactions.map(() => '0x000000'),
            numberToHex(this.timestamp),
            this.difficulty,
            this.stateRoot,
            this.transactionRoot,
            numberToHex(this.gasUsed),
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
        });
    }

    async validate() {
        if (!this.isGenesis() && (this.parents.length < 2 || this.parents.length > 2)) {
            throw new Error(`Block ${this.id} should validate 2 other transactions.`);
        }

        // For effeciency sake, first check the proof of work.
        // Since we don't have to go through all the work if the PoW isn't even valid.
        if (!isProofOfWorkValid(this.id, this.nonce)) {
            throw new Error('Proof of work is not valid');
        }

        for (const transaction of this.transactions) {
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
