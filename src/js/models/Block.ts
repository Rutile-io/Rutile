import * as Logger from 'js-logger';
import Transaction from "./Transaction";
import { numberToHex } from "../utils/hexUtils";
import { rlpHash } from "../utils/keccak256";
import { configuration } from "../Configuration";
import { applyProofOfWork, isProofOfWorkValid } from "../services/transaction/ProofOfWork";
import { validateTransaction, getAddressFromTransaction } from "../core/chain/lib/services/TransactionService";
import { databaseCreate, startDatabase, databaseFind, databaseGetById, createOrUpdate, getDatabaseLevelDbMapping } from "../services/DatabaseService";
import { Results } from "../core/rvm/context";
import Account from './Account';
import BNtype from 'bn.js';
import MerkleTree from './MerkleTree';
import GlobalState from './GlobalState';
import { VM_ERROR } from '../core/rvm/lib/exceptions';
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
    parentBlock: Block;

    transactions: Transaction[] = [];
    timestamp: number = 0;
    difficulty: number = configuration.difficulty;
    extraData: string;
    nonce: number;

    stateRoot: string;

    transactionMerkleTree: MerkleTree;
    transactionRoot: string;

    receiptsMerkleTree: MerkleTree;
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
        this.stateRoot = params.stateRoot || null;
        this.transactionRoot = params.transactionRoot || null;
        this.receiptsRoot = params.receiptsRoot || null;
        this.number = params.number || 0;
        this.gasUsed = params.gasUsed || 0;
        this.gasLimit = params.gasLimit || 0;
        this.id = params.id || null;
        this.coinbase = params.coinbase || null;
    }

    /**
     * Executes all transactions inside the block and saves the output
     *
     * @returns
     * @memberof Block
     */
    async execute(): Promise<Results[]> {
        const results: Results[] = [];

        // The starting point of our global state
        let globalStateStorage: GlobalState = null;

        if (this.isGenesis()) {
            // Starting from no state root since we are genesis
            globalStateStorage = await GlobalState.create(null);
        } else {
            // Creating a continuation on the previous state root
            const parentBlock = await Block.getById(this.parent);
            globalStateStorage = await GlobalState.create(parentBlock.stateRoot);
        }

        for (const transaction of this.transactions) {
            // Execute the transaction (transfer value/execute in VM)
            const transactionExecuteResult = await transaction.execute(this, globalStateStorage);
            this.gasUsed += transactionExecuteResult.result.gasUsed;

            // WHEN EVERYHING LOOKS OK CHECKPOINT BEFORE USING THE NEXT GLOBAL STATE
            // ALSO SET THE GLOBAL STATE TO THE let ABOVE!!!!!!!!!!!!!!!!!!!!!!!!!!!
            if (transactionExecuteResult.result.exceptionError !== VM_ERROR.REVERT)  {
                // Update our current view of the global state
                globalStateStorage = transactionExecuteResult.globalState;

                // Now update the toAccount with the latest storage root
                if (transaction.to) {
                    const toAccount = await globalStateStorage.findOrCreateAccount(transaction.to);
                    toAccount.storageRoot = transactionExecuteResult.result.outputRoot;
                    await globalStateStorage.update(toAccount);
                }
            }

            // Update the account nonces, so no double spending is possible
            // The "to" account should not be updated since it's not a sender
            if (!this.isGenesis()) {
                // We want the transaction to manipulate the given accounts
                const addresses = getAddressFromTransaction(transaction);
                const fromAccount = await globalStateStorage.findOrCreateAccount(addresses.from);

                fromAccount.nonce = fromAccount.nonce.add(new BN(1));
                await globalStateStorage.update(fromAccount);
            }

            results.push(transactionExecuteResult.result);
        }

        // And last not but not least add the reward to the address
        // This will be created out of tin air
        if (this.coinbase) {
            const rewardAccount = await globalStateStorage.findOrCreateAccount(this.coinbase);
            const newRewardAccountBalance = rewardAccount.balance.add(new BN(configuration.block.coinbaseAmount));

            rewardAccount.balance = newRewardAccountBalance;
            await globalStateStorage.update(rewardAccount);
        }

        // Update the global state root of the blockchain
        this.stateRoot = await globalStateStorage.getMerkleRoot();

        return results;
    }

    /**
     * Adds transactions to this block
     *
     * @param {Transaction[]} transactions
     * @memberof Block
     */
    async addTransactions(transactions: Transaction[]): Promise<void> {
        if (!this.transactionMerkleTree) {
            const database = await getDatabaseLevelDbMapping();
            this.transactionMerkleTree = new MerkleTree(database, this.transactionRoot);
        }

        for (const transaction of transactions) {
            if (!transaction) {
                throw new Error('Empty transaction added');
            }

            await this.transactionMerkleTree.put(Buffer.from(transaction.id), transaction.toBuffer(true));
        }

        this.transactions.push(...transactions);
        this.transactionRoot = await this.transactionMerkleTree.getMerkleRoot();
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
        if (!this.isGenesis() && !this.timestamp) {
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
    async validateAndExecute(): Promise<void> {
        // TODO: Have to check whether the block number already exists so we don't have forks
        if (!this.isGenesis() && !this.parent) {
            throw new Error(`Block ${this.id} should point to a previous block`);
        }

        // Make sure it's a continuation on te previous block
        if (!this.isGenesis()) {
            const previousBlock = await Block.getByNumber(this.number - 1);

            if (!previousBlock) {
                throw new Error(`Block number ${this.number - 1} could not be found, please get it first`);
            }

            if (this.parent !== previousBlock.id) {
                throw new Error(`Block numer ${this.number} is not a continuation on ${previousBlock.number}`);
            }
        }

        // For effeciency sake, first check the proof of work.
        // Since we don't have to go through all the work if the PoW isn't even valid.
        if (!isProofOfWorkValid(this.id, this.nonce)) {
            throw new Error(`Proof of work is not valid on block ${this.number} ${this.id}`);
        }

        // Validate every transaction in the block
        for (const transaction of this.transactions) {
            await validateTransaction(transaction);
        }

        // Now check if everything is the same when we execute the block
        const block = new Block({
            coinbase: this.coinbase,
            difficulty: this.difficulty,
            extraData: this.extraData,
            gasLimit: this.gasLimit,
            nonce: this.nonce,
            number: this.number,
            parent: this.parent,
            timestamp: this.timestamp,
        });

        await block.addTransactions(this.transactions);

        // Now execute the block to get to the same point
        await block.execute();

        if (block.getBlockId() !== this.id) {
            throw new Error(`Block ${this.number} copy did not have the same id as the original`);
        }

        if (!isProofOfWorkValid(block.getBlockId(), block.nonce)) {
            throw new Error('Proof of work is not valid after creating a copy');
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
    static fromRaw(rawBlock: string): Block {
        if (!rawBlock) {
            throw new Error('Raw block parameter is required');
        }

        const blockParams: BlockParams = JSON.parse(rawBlock);
        const block = new Block(blockParams);


        block.transactions = block.transactions.map(tx => Transaction.fromRaw(JSON.stringify(tx)));

        return block;
    }

    /**
     * Gets a block by it's ID
     *
     * @static
     * @param {string} id
     * @returns {Promise<Block>}
     * @memberof Block
     */
    static async getById(id: string): Promise<Block> {
        const rawBlock = await databaseGetById(id);

        if (!rawBlock) {
            return null;
        }

        return Block.fromRaw(JSON.stringify(rawBlock));
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

    static async getByTransactionId(transactionId: string): Promise<Block> {
        const db = await startDatabase();
        const result = await db.query((doc: any, emit: any) => {
            if (doc.transactions && doc.transactions.length) {
                const transaction = doc.transactions.find((tx: Transaction) => transactionId === tx.id);

                if (transaction) {
                    emit(doc.id, doc);
                }
            }
        });

        if (!result || result.total_rows === 0) {
            return null;
        }

        return Block.fromRaw(JSON.stringify(result.rows[0].value));
    }
}

export default Block;
