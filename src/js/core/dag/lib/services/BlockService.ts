import { databaseFind, getById, databaseCreate, startDatabase } from "../../../../services/DatabaseService";
import Block from "../../../../models/Block";
import Account from "../../../../models/Account";
import { getTransactionById } from "./TransactionService";
import getRandomInt from "../../../../utils/getRandomInt";
import Transaction from "../../../../models/Transaction";

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
