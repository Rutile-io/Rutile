import Network from "../network/Network";
import NetworkController from "./controller/NetworkController";
import Transaction from "../../models/Transaction";
import KeyPair from "../../models/KeyPair";
import { getMilestoneTransaction, validateTransaction, applyTransaction, saveTransaction, getTransactionById } from "./lib/services/TransactionService";
import { configuration } from "../../Configuration";
import Walker from "./lib/Walker";
import createGenesisBlock from "./lib/transaction/createGenesisBlock";
import EventHandler from "../network/lib/EventHandler";
import Ipfs from "../../services/wrappers/Ipfs";
import { databaseGetAll, databaseRemove } from "../../services/DatabaseService";
import { isProofOfWorkValid } from "../../services/transaction/ProofOfWork";
import * as Logger from 'js-logger';
import TipValidator from "./lib/TipValidator";
import Block from "../../models/Block";
import { getBlockByNumber, applyBlock, getBlockById, saveBlock } from "./lib/services/BlockService";
import Snapshot from "./lib/Snapshot";

const GENESIS_MILESTONE = 1;
const TRANSACTION_AMOUNT_TO_VALIDATE = 2;

class Dag extends EventHandler {
    networkController: NetworkController;
    walker: Walker;
    ipfs: Ipfs;
    tipValidator: TipValidator;

    constructor(network: Network) {
        super();

        this.networkController = new NetworkController(this, network);
        this.walker = new Walker();
        this.ipfs = Ipfs.getInstance(configuration.ipfs);
        this.tipValidator = new TipValidator();
    }

    /**
     * Validated and adds the transaction to the database
     *
     * @param {Transaction} transaction
     * @memberof Dag
     */
    async addBlock(block: Block, fromPeerId: string) {
        try {
            // Make sure we are not storing duplicates.
            const isBlockInDatabase = !!(await getBlockById(block.id));

            if (isBlockInDatabase) {
                Logger.debug(`Block ${block.id} already received`);
                return;
            }

            Logger.debug(`Received block ${block.id}`);

            // Send the transaction to the rest of the nodes.
            this.networkController.network.broadcastBlock(block, [fromPeerId]);

            await block.validate();
            await applyBlock(block);

            // Let the rest of the application know it's valid.
            this.trigger('blockAdded', {
                block,
            });
        } catch (error) {
            Logger.warn('Block with id', block.id, 'failed', error);
        }
    }

    async getAccountBalance(address: string) {
        const walkedBlocks = await this.walker.getBlocksToValidate(1, 1);
        const balances = await this.tipValidator.generateAccountBalances(walkedBlocks[0].id);

        return balances;
    }

    /**
     * Submits a block to the dag (From a user perspective)
     *
     * @param {Block} block
     * @param {KeyPair} keyPair
     * @memberof Dag
     */
    async submitBlock(block: Block, depth: number = 0) {
        // We have tried searching 10 times for a tip but couldn't find a valid one
        // user should submit it on a later time..
        if (depth > 5) {
            throw new Error(`Could not find valid block tip after ${depth} tries`);
        }

        // Find blocks using the random weighted walk
        const parentBlocks = await this.walker.getBlocksToValidate(1, TRANSACTION_AMOUNT_TO_VALIDATE);

        // Validate these blocks by searching for a path that allows the user to spend this amount.
        const invalidBlock = await this.tipValidator.validateBlockBalances(parentBlocks);

        // One of the tips is considered invalid and should not be used
        // We retry to submit our block to a different tip
        if (invalidBlock) {
            depth += 1;

            Logger.debug(`Block ${invalidBlock.id} was not considered valid and will be deleted`);
            await databaseRemove(invalidBlock.id);

            // Now retry our tip selection without the bad block in the way
            await this.submitBlock(block, depth);
            return;
        }

        // We need to find a block that has the output we want to continue on.
        // This is usually considerd as the latest block that interacted with that system.
        // TODO: Currently only 1 transaction is supported per block
        if (block.transactions[0].to) {
            const parentInputBlock = await this.walker.getLatestBlockForAddress(block.transactions[0].to);

            if (parentInputBlock) {
                parentBlocks.unshift(parentInputBlock);

                // set the inputs block output as our new input
                const outputRoot = parentInputBlock.outputs[0];
                block.setInputs([outputRoot]);
            }
        }

        Logger.debug(`Attaching to ${parentBlocks.map(b => b.id)}`);
        await block.addParents(parentBlocks);

        // transaction.sign(keyPair);
        Logger.debug(`Executing block ${block.id}`);
        const results = await block.execute();

        Logger.debug(`Applying PoW to block ${block.getBlockId()}`);
        block.proofOfWork();

        // Make sure all is ok with our Block before sending it off
        Logger.debug(`Re-validating block before sending ${block.id}`);
        await block.validate();

        Logger.debug(`Applying block ${block.id}`);
        await applyBlock(block);

        // Apply the transaction to our local node
        this.networkController.broadcastBlock(block);

        // Let the rest of the application know it's valid.
        this.trigger('blockAdded', {
            block,
        });

        return results;
    }

    /**
     * Synchronises to a peer
     *
     * @param {number} beginMilestoneIndex
     * @param {string} peerId
     * @memberof Dag
     */
    async synchroniseTo(number: number, peerId: string) {
        Logger.debug(`Synchronising to peer ${peerId} starting from block #${number}`);

        // TODO: Synchronise from the beginMilestoneIndex instead of sending all.
        const stream = databaseGetAll({
            selector: {
                timestamp: {
                    $gte: 0,
                }
            }
        });

        stream.on('data', (chunk: Buffer) => {
            this.networkController.sendBlockSyncString(chunk.toString(), peerId);
        })
        // this.networkController.sendTransaction();
    }

    /**
     * Takes a snapshot of the current state of the DAG, pruining it's data
     *
     * @param {number} blockNumber
     * @memberof Dag
     */
    async takeSnapshot(blockNumber: number) {
        const block = await getBlockByNumber(blockNumber);

        if (!block) {
            throw new Error(`Block ${blockNumber} does not exist, snapshot aborted.`);
        }

        const snapshot = await Snapshot.takeSnapshot(block.id);
    }

    /**
     * Synchronises between nodes to get the latest transaction information
     * It should not represent the Account state.
     *
     * @memberof Dag
     */
    async synchronise() {
        let genesisBlock = await getBlockByNumber(GENESIS_MILESTONE);

        if (!genesisBlock) {
            genesisBlock = await createGenesisBlock();
            await genesisBlock.save();
        }

        // Make sure we have a peer that can accept the request
        this.networkController.network.one('peerConnected', () => {
            // Find the highest milestone we currently have and ask a node to get data up to the next milestone.
            Logger.info('Requesting synchronisation');
            this.networkController.broadcastSynchroniseRequest(0);
        });
    }

    async onBlockSyncMessage(block: Block) {
        try {
            // TODO: Check more than only the PoW.
            if (!isProofOfWorkValid(block.id, block.nonce)) {
                console.error(`Block ${block.id} is invalid. Not adding.`);
                return;
            }

            await saveBlock(block);
        } catch (error) {

        }
    }
}

export default Dag;
