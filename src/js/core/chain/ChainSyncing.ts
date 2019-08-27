import * as Logger from 'js-logger';
import NetworkController from "./controller/NetworkController";
import Block from "../../models/Block";
import createGenesisBlock from "./lib/transaction/createGenesisBlock";

const GENESIS_MILESTONE = 1;

class ChainSyncing {
    networkController: NetworkController;
    synchronisePointerBlock: Block;
    latestNetworkBlock: Block;
    blockPool: Block[];
    synchroniseResolve: (value: any) => void;

    constructor(networkController: NetworkController) {
        this.blockPool = [];
        this.networkController = networkController;
    }

    /**
     * Requesting synchronisation from other nodes
     *
     * @memberof ChainSyncing
     */
    synchronise(): Promise<Block> {
        return new Promise(async (resolve) => {
            this.synchroniseResolve = resolve;

            let genesisBlock = await Block.getByNumber(GENESIS_MILESTONE);

            if (!genesisBlock) {
                genesisBlock = await createGenesisBlock();
                await genesisBlock.save();

                this.synchronisePointerBlock = genesisBlock;
            } else {
                this.synchronisePointerBlock = await Block.getLatest();
            }

            Logger.info(`🚀 Last block was ${this.synchronisePointerBlock.number}, syncing from that point.`);

            if (!this.networkController.hasConnectedPeers()) {
                Logger.info(`🚀 Synchronisation could not be done due to no connected peers. Starting at ${this.synchronisePointerBlock.number}`);
                this.synchroniseResolve(this.synchronisePointerBlock);
                return;
            }

            // Find the highest milestone we currently have and ask a node to get data up to the next milestone.
            this.networkController.broadcastSynchroniseRequest(this.synchronisePointerBlock.number);
        });
    }

    /**
     * Processes all blocks that where sent to us
     *
     * @private
     * @returns {Promise<void>}
     * @memberof ChainSyncing
     */
    private async processBlockPool(): Promise<void> {
        const nextBlockNumber = this.synchronisePointerBlock.number + 1;
        let blockPoolIndex: number = null;

        // Find the next number in the block pool
        const nextBlock = this.blockPool.find((block, index) => {
            if (block.number === nextBlockNumber) {
                blockPoolIndex = index;
                return true;
            }

            return false;
        });

        // Couldn't find it sadly, we wait for the next call
        if (!nextBlock) {
            return;
        }

        // Make sure it's an actual contiuation on our chain
        if (nextBlock.parent !== this.synchronisePointerBlock.id) {
            Logger.warn(`Faulty block #${nextBlock.number} received, number continued but parent did not match`);
            this.blockPool.splice(blockPoolIndex, 1);
            return;
        }

        // All seems ok we will now validate and execute the block
        await nextBlock.validate();
        await nextBlock.execute();
        await nextBlock.save();

        // Move our pointer to this block
        this.synchronisePointerBlock = nextBlock;

        if (this.latestNetworkBlock) {
            if (this.synchronisePointerBlock.id === this.latestNetworkBlock.id) {
                Logger.info(`🚀 Synchronisation complete. Now at ${this.synchronisePointerBlock.number}`);
                this.synchroniseResolve(this.synchronisePointerBlock);
                return;
            }
        }

        // Continue the cycle
        return this.processBlockPool();
    }

    async onBlockSyncMessage(block: Block, fromSyncing: boolean = true) {
        try {
            const nextBlockNumber = this.synchronisePointerBlock.number + 1;

            // We got this block from the network itself
            if (!fromSyncing) {
                this.latestNetworkBlock = block;
            }

            // We found the next block that we should continue on
            if (block.number === nextBlockNumber) {
                this.blockPool.push(block);
                await this.processBlockPool();
                return;
            }

            // The block is much lower than our pointer
            // we can skip it all together.
            if (block.number < this.synchronisePointerBlock.number) {
                return;
            }

            // This block is not the one we currently need,
            // but maybe we need it later..
            this.blockPool.push(block);
        } catch (error) {
            Logger.error(`Block ${block.number} was considerd not valid, aborting.`, error);
            console.log(block);
        }
    }

    async complete(lastBlock: Block) {
        if (lastBlock.number === this.synchronisePointerBlock.number) {
            Logger.info(`🚀 Synchronisation complete. Now at ${this.synchronisePointerBlock.number}`);
            this.synchroniseResolve(lastBlock);
            return;
        }

        this.latestNetworkBlock = lastBlock;
        this.processBlockPool();
    }
}

export default ChainSyncing;
