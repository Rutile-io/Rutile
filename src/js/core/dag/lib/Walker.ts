import { startDatabase } from "../../../services/DatabaseService";
import getBlocksCumulativeWeights from "./services/CumulativeWeightService";
import * as Logger from 'js-logger';
import { getBlockByNumber, getBlockById } from "./services/BlockService";
import Block from "../../../models/Block";

function getRandomInt(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Walks backwards from the last milestone to determine a confirmation rate.
 * It checks the balance of the account and determines if the transaction is possible.
 *
 * @class Walker
 */
class Walker {
    transactionCumulativeWeights: Map<string, number>;

    /**
     * Finds transaction that includes the transactionId as it's parent
     *
     * @param {string} transactionId
     * @returns {Promise<Transaction[]>}
     * @memberof Walker
     */
    async getAttachedBlocks(blockId: string): Promise<Block[]> {
        const db = startDatabase();

        const data = await db.find({
            selector: {
                'parents': {
                    '$in': [blockId],
                }
            }
        });

        return data.docs.map(block => Block.fromRaw(JSON.stringify(block)))
    }

    /**
     * Gets a random weighted transaction from the dag
     *
     * @param {Transaction[]} transactions
     * @returns {Transaction}
     * @memberof Walker
     */
    getRandomWeightedBlock(blocks: Block[]): Block {
        let sumOfWeight = 0;

        blocks.forEach((block) => {
            sumOfWeight += this.transactionCumulativeWeights.get(block.id);
        });

        let randomNum = getRandomInt(0, sumOfWeight);

        const weightedBlock = blocks.find((block) => {
            if (randomNum < this.transactionCumulativeWeights.get(block.id)) {
                return true;
            }

            randomNum -= this.transactionCumulativeWeights.get(block.id);
        });

        if (!weightedBlock) {
            return blocks[0];
        }

        return weightedBlock;
    }

    /**
     * Finds a block tip that we can use to validate.
     *
     * @param {Block} block
     * @returns {Promise<Transaction>}
     * @memberof Walker
     */
    async getBlockTip(block: Block): Promise<Block> {
        const attachedBlocks = await this.getAttachedBlocks(block.id);

        // We found a tip
        if (attachedBlocks.length === 0) {
            return block;
        }

        const nextBlock = this.getRandomWeightedBlock(attachedBlocks);

        return this.getBlockTip(nextBlock);
    }

    /**
     * Finds transactions that can be validated. Will not give duplicates (Unless it's the genesis block)
     *
     * @param {number} blockNumber
     * @param {number} transactionsAmount
     * @returns {Promise<Transaction[]>}
     * @memberof Walker
     */
    async getBlocksToValidate(blockNumber: number, blockParentsAmount: number): Promise<Block[]> {
        let blocksToValidate: Block[] = [];

        // First we have to get the milestone transaction with the given milestoneIndex
        this.transactionCumulativeWeights = await getBlocksCumulativeWeights();
        const milestoneBlock = await getBlockByNumber(blockNumber);

        if (!milestoneBlock) {
            throw new Error(`Block number ${blockNumber} could not be found`);
        }

        // for of loops (required for async loops) only have support for iterables and not ranges
        // this is why we create an empty array of x length and iterate over that
        const blockAmountIterator = new Array(blockParentsAmount);

        for (let [index] of blockAmountIterator.entries()) {
            Logger.debug(`Searching for transaction ${index + 1}/${blockParentsAmount}`);

            const blockTip = await this.getBlockTip(milestoneBlock);
            const alreadyHasTransaction = !!blocksToValidate.find(block => block.id === blockTip.id);

            if (alreadyHasTransaction && !blockTip.isGenesis()) {
                // We can't add the same transaction id, as this would result in a chain rather than a DAG.
                const randomParentBlockId = blockTip.parents[getRandomInt(0, blockTip.parents.length - 1)];
                blocksToValidate.push(await getBlockById(randomParentBlockId));
            } else {
                blocksToValidate.push(blockTip);
            }
        }

        return blocksToValidate;
    }
}

export default Walker;
