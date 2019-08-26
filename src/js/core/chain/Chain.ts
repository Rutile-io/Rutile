import Network from "../network/Network";
import NetworkController from "./controller/NetworkController";
import KeyPair from "../../models/KeyPair";
import { configuration } from "../../Configuration";
import EventHandler from "../network/lib/EventHandler";
import Ipfs from "../../services/wrappers/Ipfs";
import { databaseGetAll } from "../../services/DatabaseService";
import * as Logger from 'js-logger';
import Transaction from "../../models/Transaction";
import createGenesisBlock from "./lib/transaction/createGenesisBlock";
import { Results } from "../rvm/context";
import { NodeType } from "../../models/interfaces/IConfig";
import Block from "../../models/Block";
import Account from "../../models/Account";
import Wallet from "../../models/Wallet";
import sleep from "../../utils/sleep";
import BNtype from 'bn.js';
import TransactionPool from "./TransactionPool";
import ChainSyncing from "./ChainSyncing";

const GENESIS_MILESTONE = 1;
const MILESTONE_CONTRACT = '0x0200000000000000000000000000000000000000';

class Chain extends EventHandler {
    networkController: NetworkController;
    ipfs: Ipfs;
    transactionPool: TransactionPool;
    chainSyncing: ChainSyncing;
    blockPool: Block[] = [];
    nextValidatorAddress: string;
    currentBlock: Block;
    isSyncing: boolean = false;

    constructor(network: Network) {
        super();

        this.networkController = new NetworkController(this, network);
        this.chainSyncing = new ChainSyncing(this.networkController);
        this.transactionPool = new TransactionPool(this);
        this.ipfs = Ipfs.getInstance(configuration.ipfs);
    }

    /**
     * Validated and adds the transaction to the database
     *
     * @param {Transaction} transaction
     * @memberof Dag
     */
    async addTransaction(transaction: Transaction, fromPeerId: string) {
        try {
            // Make sure we are not storing duplicates.
            const isTransactionInPool = this.transactionPool.isInPool(transaction.id);

            if (isTransactionInPool) {
                Logger.debug(`Transaction ${transaction.id} already received`);
                return;
            }

            Logger.debug(`Received transaction ${transaction.id}, validating..`);
            await transaction.validate();

            // Send the transaction to the rest of the nodes.
            Logger.debug(`Transaction is valid, rebroadcasting it`);
            this.networkController.network.broadcastTransaction(transaction, [fromPeerId]);

            // Add to the pool so we can use it later on
            this.transactionPool.add(transaction);

            // Let the rest of the application know it's valid.
            this.trigger('transactionAdded', {
                transaction,
            });
        } catch (error) {
            Logger.warn('Transaction with id', transaction.id, 'failed', error);
        }
    }

    async addBlock(block: Block, fromPeerId: string) {
        try {
            // When syncing we should let the new blocks be processed by the Chain syncer
            if (this.isSyncing) {
                this.chainSyncing.onBlockSyncMessage(block, false);
                return;
            }

            await block.validate();
            this.networkController.broadcastBlock(block, [fromPeerId]);

            await block.execute();
            await block.save();

            Logger.info(`📥 Block round completed, received block ${block.number} with ${block.transactions.length} transactions(s)`);

            this.trigger('blockAdded', {
                block: block,
            })
        } catch (error) {
            Logger.warn(`Block with number ${block.number} failed`, error);
        }
    }

    /**
     * Submits a transaction to the dag (From a user perspective)
     *
     * @param {Transaction} transaction
     * @param {KeyPair} keyPair
     * @memberof Dag
     */
    submitTransaction(transaction: Transaction, keyPair: KeyPair, depth: number = 0): Promise<Results> {
        return new Promise(async (resolve) => {
            Logger.debug(`Submitting transaction`);
            transaction.sign(keyPair);

            Logger.debug(`Applying PoW to transaction ${transaction.id}`);
            transaction.proofOfWork();

            // Make sure all is ok with our Transaction before sending it off
            Logger.debug(`Re-validating transaction before sending ${transaction.id}`);
            await transaction.validate();

            // Apply the transaction to our local node
            this.networkController.broadcastTransaction(transaction);

            // Make sure we add it ourself
            this.transactionPool.add(transaction);

            // Let the rest of the application know it's valid.
            this.trigger('transactionAdded', {
                transaction,
            });

            // Clients cannot execute transactions themselfs, so we use a node for the results
            if (configuration.nodeType === NodeType.CLIENT) {
                const result = await this.networkController.broadcastSendTransactionResultRequest(transaction.id);
                return resolve(result);
            }

            this.on('transactionsExecuteResult', (event: any) => {
                const resultPair = event.transactionResults.find((tx: any) => tx.id === transaction.id);

                if (!resultPair) {
                    return;
                }

                resolve(resultPair.results);
            })
        });
    }

    /**
     * Synchronises to a peer
     *
     * @param {number} beginMilestoneIndex
     * @param {string} peerId
     * @memberof Dag
     */
    async synchroniseTo(blockNumber: number, peerId: string) {
        Logger.debug(`🚀 Synchronising to peer ${peerId} starting from block #${blockNumber}`);

        const currentLatestBlock = await Block.getLatest();
        const blockNumbersToGet = [];

        for (let index = blockNumber; index < currentLatestBlock.number; index++) {
            blockNumbersToGet.push(index);
        }

        let lastBlock: Block = currentLatestBlock;

        for (const blockNum of blockNumbersToGet) {
            lastBlock = await Block.getByNumber(blockNum);
            this.networkController.sendBlockSyncString(lastBlock.toRaw(), peerId);
        }

        this.networkController.sendBlockSyncComplete(lastBlock, peerId);
    }

    async nextBlockRound() {
        // We are asking the internal PoS contract to get the next block validator
        const wallet = new Wallet(configuration.privateKey);
        wallet.getAccountInfo();
        const transaction = new Transaction({
            to: MILESTONE_CONTRACT,
            data: '0x00000002',
        });

        transaction.sign(wallet.keyPair);

        // We give the current block as the context since we do not actually save the results
        const result = await transaction.execute(this.currentBlock);
        this.nextValidatorAddress = result.returnHex;

        if (result.returnHex === wallet.address) {
            this.createNextBlock();
        }
    }

    async createNextBlock() {
        const block = new Block({
            parent: this.currentBlock.id,
            number: this.currentBlock.number + 1,
            gasLimit: this.currentBlock.gasLimit,
            coinbase: configuration.block.coinbaseAddress,
        });

        while(this.transactionPool.hasTransactions()) {
            block.addTransactions([this.transactionPool.pop()]);
        }

        await block.execute();
        const blockTimeDelta = Date.now() - this.currentBlock.timestamp;

        // The block is overdue, submit it fast
        if (blockTimeDelta < configuration.block.blockTime) {
            const nextBlockTimeDelta = configuration.block.blockTime - blockTimeDelta;
            await sleep(nextBlockTimeDelta);
        }

        block.proofOfWork();
        this.networkController.broadcastBlock(block);
        await block.save();
        Logger.info(`⛏ Block round complete, created block ${block.number} with ${block.transactions.length} transaction(s)`);

        this.currentBlock = block;
        this.nextBlockRound();
    }

    /**
     * Synchronises between nodes to get the latest transaction information
     * It should not represent the Account state.
     *
     * @memberof Dag
     */
    async synchronise() {
        this.isSyncing = true;
        this.currentBlock = await this.chainSyncing.synchronise();
        Logger.info(`🚀 Synchronisation complete. Now at ${this.currentBlock.number}`);
        this.isSyncing = false;
        this.nextBlockRound();
    }

    async onBlockSyncMessage(block: Block) {
        this.chainSyncing.onBlockSyncMessage(block);
    }
}

export default Chain;
