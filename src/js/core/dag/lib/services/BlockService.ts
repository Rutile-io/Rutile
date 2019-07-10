import { databaseFind, getById, databaseCreate, startDatabase } from "../../../../services/DatabaseService";
import Block from "../../../../models/Block";
import Account from "../../../../models/Account";
import { getTransactionById } from "./TransactionService";
import getRandomInt from "../../../../utils/getRandomInt";

/**
 * Finds the block that created the given address, only applys to smart contracts
 *
 * @export
 * @param {string} toAddress
 * @returns {Promise<Block[]>}
 */
export async function getAccountCreationBlock(toAddress: string): Promise<Block> {
    const account = await Account.getFromAddress(toAddress);

    console.log('[GetAcc] account -> ', account);

    if (!account) {
        return null;
    }

    // In the begining there was no transactionId for deployment.
    if (account.creationTransactionId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
        return getBlockByNumber(1);
    }

    return Block.getByTransactionId(account.creationTransactionId);
}

/**
 * Gets a random weighted block from the array
 *
 * @export
 * @param {Block[]} blocks
 * @param {Map<string, number>} cummulativeWeights
 * @returns {Block}
 */
export function getRandomWeightedBlock(blocks: Block[], cummulativeWeights: Map<string, number>): Block {
    let sumOfWeight = 0;

    blocks.forEach((block) => {
        sumOfWeight += cummulativeWeights.get(block.id);
    });

    let randomNum = getRandomInt(0, sumOfWeight);

    const weightedBlock = blocks.find((block) => {
        if (randomNum < cummulativeWeights.get(block.id)) {
            return true;
        }

        randomNum -= cummulativeWeights.get(block.id);
    });

    if (!weightedBlock) {
        return blocks[0];
    }

    return weightedBlock;
}

/**
 * Finds a block tip that can act as the state input
 *
 * @export
 * @param {Block} startBlock
 * @param {Map<string, number>} cummulativeWeights
 * @returns {Promise<Block>}
 */
export async function getStateInputBlockTip(startBlock: Block, cummulativeWeights: Map<string, number>): Promise<Block> {
    if (!startBlock) {
        throw new Error('Start block is required');
    }

    const db = await startDatabase()
    const data = await db.find({
        selector: {
            'parents': {
                '$in': [startBlock.id],
            }
        }
    });

    const parentBlocks = data.docs.map(b => Block.fromRaw(JSON.stringify(b)));

    // We found our tip
    if (!parentBlocks.length) {
        return startBlock;
    }

    // We need a weighted choice between these blocks..
    const nextBlock = getRandomWeightedBlock(parentBlocks, cummulativeWeights);

    return getStateInputBlockTip(nextBlock, cummulativeWeights);
}


/**
 * Searches the database for a block with the given number
 *
 * @export
 * @param {number} number
 * @returns
 */
export async function getBlockByNumber(number: number) {
    const result = await databaseFind('number', number);

    if (!result || !result.docs.length) {
        return null;
    }

    return Block.fromRaw(JSON.stringify(result.docs[0]));
}

/**
 * Retrieves a block with the given id number
 *
 * @export
 * @param {string} id
 * @returns {Promise<Block>}
 */
export async function getBlockById(id: string): Promise<Block> {
    try {
        const result = await getById(id);

        if (!result) {
            return null;
        }

        const transaction = Block.fromRaw(JSON.stringify(result));

        return transaction;
    } catch (error) {
        console.error('getBlockById: ', error);
        return null;
    }
}

/**
 * Currently only saves blocks to the database
 * TODO: Modifies account states.
 *
 * @export
 * @param {Block} block
 */
export async function applyBlock(block: Block) {
    await saveBlock(block);
}

export async function saveBlock(block: Block) {
    const rawBlock = block.toRaw();
    await databaseCreate(block.id, JSON.parse(rawBlock));
}
