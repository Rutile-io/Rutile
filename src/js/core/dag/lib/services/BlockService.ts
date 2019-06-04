import { databaseFind, getById, databaseCreate } from "../../../../services/DatabaseService";
import Block from "../../../../models/Block";

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
