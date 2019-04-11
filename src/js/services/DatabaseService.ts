import Transaction from '../models/Transaction';
import isNodeJs from './isNodeJs';
import { configuration } from '../Configuration';
import levelup, { LevelUp } from 'levelup';

let levelDb: LevelUp = null;


/**
 * Starts the database
 *
 * @export
 */
export function startDatabase() {
    if (levelDb) {
        return levelDb;
    }

    let lvlDown: any = null;

    // For nodejs we use the standard file db
    // and for browsers we use indexedDB
    if (isNodeJs()) {
        const leveldown = __non_webpack_require__('leveldown');
        lvlDown = leveldown(`./${configuration.databaseName}`);
    } else {
        const leveljs = require('level-js');
        lvlDown = leveljs(configuration.databaseName);
    }

    levelDb = levelup(lvlDown);

    return levelDb;
}

/**
 * Saves a transaction in the database
 *
 * @export
 * @param {Transaction} transaction
 */
export async function saveTransaction(transaction: Transaction) {
    const rawTransaction = JSON.parse(transaction.toRaw());

    await databaseCreate(transaction.id, rawTransaction);
}

export async function databaseCreate(id: string, obj: Buffer | string) {
    return levelDb.put(id, obj);
}

/**
 * Creates or updates an entry in the database
 *
 * @export
 * @param {string} id
 * @param {*} obj
 */
export async function createOrUpdate(id: string, obj: Buffer | string) {
    await databaseCreate(id, obj);
}

/**
 * Get a document from the database
 *
 * @export
 * @param {string} id
 * @returns
 */
export async function getById(id: string): Promise<any> {
    try {
        const val = await levelDb.get(id);

        return val;
    } catch (error) {
        return null;
    }
}

export async function synchroniseDatabase(src: string) {
    // // TODO: Figure out if we want to live update..
    // const replication = PouchDB.replicate(src, databaseTarget);

    // replication.on('complete', () => {
    //     console.log('Sync complete');
    // })
}
