import * as Logger from 'js-logger';
import Transaction from "./Transaction";
import { numberToHex } from "../utils/hexUtils";
import { rlpHash } from "../utils/keccak256";
import { configuration } from "../Configuration";
import { applyProofOfWork, isProofOfWorkValid } from "../services/transaction/ProofOfWork";
import { validateTransaction } from "../core/chain/lib/services/TransactionService";
import { databaseCreate, startDatabase, databaseFind, databaseGetById, createOrUpdate } from "../services/DatabaseService";
import { Results } from "../core/rvm/context";
import Account from './Account';
import BNtype from 'bn.js';
const BN = require('bn.js');

const LATEST_BLOCK_ID = 'latestBlockNumber';


interface BlockParams {
    parent?: string;
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
    coinbase?: string;
    id?: string;
}

class Block {
    parent: string;
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
    coinbase: string;
    id: string;

    constructor(params: BlockParams) {
        this.parent = params.parent;
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
        this.coinbase = params.coinbase || '0x';
    }

    /**
     * Executes all transactions inside the block and saves the output
     *
     * @returns
     * @memberof Block
     */
    async execute(): Promise<Results[]> {
        const results = [];

        for (const [index, transaction] of this.transactions.entries()) {
            const result = await transaction.execute(this);
            this.gasUsed += result.gasUsed;

            results.push(result);
        }

        // And last not but not least add the reward to the address
        // This will be created out of tin air
        const rewardAccount = await Account.findOrCreate(this.coinbase);
        const newRewardAccountBalance = rewardAccount.balance.add(new BN(configuration.block.coinbaseAmount));

        await rewardAccount.setBalance(newRewardAccountBalance);
        await rewardAccount.save();

        return results;
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
    proofOfWork(): void {
        this.nonce = applyProofOfWork(this.getBlockId());
    }

    private generateBlockId() {
        const data = [
            numberToHex(this.number),
            this.parent,
            numberToHex(this.difficulty),
            // TODO: Convert to the actual transactions
            this.transactions.map(tx => tx.id),
            numberToHex(this.timestamp),
            this.stateRoot,
            this.coinbase,
            this.transactionRoot,
            numberToHex(this.gasUsed),
        ];

        this.id = '0x' + rlpHash(data);

        return this.id;
    }

    getBlockId() {
        if (this.id) {
            return this.id;
        }

        // Genesis blocks do not have a timestamp
        if (!this.isGenesis()) {
            this.timestamp = Date.now();
        }

        return this.generateBlockId();
    }

    toString() {
        return this.toRaw();
    }

    toRaw(): string {
        return JSON.stringify({
            id: this.getBlockId(),
            parent: this.parent,
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
            coinbase: this.coinbase,
        });
    }

    /**
     * Validates this block
     *
     * @memberof Block
     */
    async validate() {
        // TODO: Have to check whether the block number already exists so we don't have forks

        if (!this.isGenesis() && !this.parent) {
            throw new Error(`Block ${this.id} should point to a previous block`);
        }

        const previoudId = this.id;
        const blockId = this.generateBlockId();

        if (previoudId !== blockId) {
            throw new Error('Block did not contain all information, id did not match');
        }

        // For effeciency sake, first check the proof of work.
        // Since we don't have to go through all the work if the PoW isn't even valid.
        if (!isProofOfWorkValid(this.id, this.nonce)) {
            throw new Error('Proof of work is not valid');
        }

        // Validate every transaction in the block
        for (const [index, transaction] of this.transactions.entries()) {
            await validateTransaction(transaction);
        }
    }

    /**
     * Saves the block in the database
     *
     * @memberof Block
     */
    async save() {
        try {
            const rawBlock = this.toRaw();

            // We want to save the number of the latest block known to us.
            const latestBlockNumber = await databaseGetById(LATEST_BLOCK_ID);

            if (!latestBlockNumber) {
                await databaseCreate(LATEST_BLOCK_ID, {
                    number: this.number,
                });
            } else if (latestBlockNumber && latestBlockNumber.number < this.number) {
                // The saved block has a higher number so we can save it as our longest chain
                await createOrUpdate(LATEST_BLOCK_ID, {
                    number: this.number,
                });
            }

            await createOrUpdate(this.id, JSON.parse(rawBlock));
        } catch (error) {
            Logger.error(`Saving block ${this.number} failed`, error);
            throw error;
        }
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

    /**
     * Gets a block by the given block number
     *
     * @static
     * @param {number} blockNumber
     * @returns {Promise<Block>}
     * @memberof Block
     */
    static async getByNumber(blockNumber: number): Promise<Block> {
        const result = await databaseFind('number', blockNumber);

        if (!result || !result.docs || !result.docs.length) {
            return null;
        }

        return Block.fromRaw(JSON.stringify(result.docs[0]));
    }

    /**
     * Get latest block
     *
     * @static
     * @returns {Promise<Block>}
     * @memberof Block
     */
    static async getLatest(): Promise<Block> {
        const blockNumber = await databaseGetById(LATEST_BLOCK_ID);

        if (!blockNumber) {
            return Block.getByNumber(1);
        }

        return Block.getByNumber(blockNumber.number);
    }
}

export default Block;
