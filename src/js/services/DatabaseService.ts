import Transaction from '../models/Transaction';
import isNodeJs from './isNodeJs';
import { configuration } from '../Configuration';

let PouchDB: PouchDB.Static = null;
let database: PouchDB.Database = null;
let databaseTarget: string = null;

/**
 * Starts the database
 *
 * @export
 */
export function startDatabase() {
    if (database) {
        throw new Error('Database has already been started');
    }

    // The biggest difference in node and the browser is that
    // node doesn't have a IndexDB pre-installed
    // This is why we need to configure it differently.
    if (isNodeJs()) {
        PouchDB = __non_webpack_require__('pouchdb');
        PouchDB.plugin(__non_webpack_require__('pouchdb-find'))
        databaseTarget = `${configuration.couchdbUrl}/${configuration.databaseName}`;
    } else {
        PouchDB = require('pouchdb').default;
        PouchDB.plugin(require('pouchdb-find'));
        databaseTarget = configuration.databaseName;
    }

    database = new PouchDB(databaseTarget, {
        revs_limit: 1,
    });
}

/**
 * Saves a transaction in the database
 *
 * @export
 * @param {Transaction} transaction
 */
export async function saveTransaction(transaction: Transaction) {
    const rawTransaction = JSON.parse(transaction.toRaw());
    const data = {
        ...rawTransaction,
        _id: rawTransaction.id,
    }

    await database.put(data);
}

/**
 * Creates or updates an entry in the database
 *
 * @export
 * @param {string} id
 * @param {*} obj
 */
export async function createOrUpdate(id: string, obj: any) {
    const data = {
        ...obj,
        _id: id,
    };

    const doc = await getById(id);

    if (!doc) {
        await database.put(data);
    } else {
        const newData = {
            ...data,
            _rev: doc._rev,
        }

        await database.put(newData, {
            force: true,
        });
    }
}

/**
 * Get a document from the database
 *
 * @export
 * @param {string} id
 * @returns
 */
export async function getById(id: string) {
    try {
        const doc = await database.get(id);
        return doc;
    } catch (error) {
        return null;
    }
}

export async function synchroniseDatabase(src: string) {
    // TODO: Figure out if we want to live update..
    const replication = PouchDB.replicate(src, databaseTarget);

    replication.on('complete', () => {

    })
}
