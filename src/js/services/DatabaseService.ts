import Transaction from '../models/Transaction';
import isNodeJs from './isNodeJs';
import { configuration } from '../Configuration';
import PouchDbLevelDbMapping from '../models/PouchDbLevelDbMapping';
import * as MemoryStream from 'memorystream';
import { Duplex } from 'stream';
const ReplicationStream = require('pouchdb-replication-stream');

let pouchDb: PouchDB.Database = null;

/**
 * Starts the database
 *
 * @export
 */
export function startDatabase(): PouchDB.Database {
    if (pouchDb) {
        return pouchDb;
    }

    let PouchDb: PouchDB.Static = null;

    // For nodejs we use the standard file db
    // and for browsers we use indexedDB
    if (isNodeJs()) {
        PouchDb = __non_webpack_require__('pouchdb');
        PouchDb.plugin(__non_webpack_require__('pouchdb-find'))
    } else {
        PouchDb = require('pouchdb').default;
        PouchDb.plugin(require('pouchdb-find').default);
    }

    PouchDb.plugin(ReplicationStream.plugin);
    // @ts-ignore
    PouchDb.adapter('writableStream', ReplicationStream.adapters.writableStream);


    pouchDb = new PouchDb(configuration.databaseName, {
        revs_limit: 1,
    });

    return pouchDb;
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

export async function databaseCreate(id: string | Buffer, obj: Buffer | string | Object) {
    try {
        let document: any = {
            _id: Buffer.isBuffer(id) ? id.toString('hex') : id,
        }

        if (Buffer.isBuffer(obj) || typeof obj === 'string') {
            document.value = obj;
        } else {
            document = {
                ...document,
                ...obj,
            }
        }

        return pouchDb.put(document);
    } catch (error) {
        console.error('[databaseCreate] error -> ', error);
    }
}

/**
 * Creates or updates an entry in the database
 *
 * @export
 * @param {string} id
 * @param {*} obj
 */
export async function createOrUpdate(id: string, obj: Buffer | string | Object) {
    let document = null;

    try {
        document = await getById(id);

        if (!document) {
            await databaseCreate(id, obj);
        } else {
            let newData = {
                ...document,
            };

            if (Buffer.isBuffer(obj) || typeof obj === 'string') {
                newData.value = obj;
            } else {
                newData = {
                    ...newData,
                    ...obj,
                }
            }

            pouchDb.put(newData, {
                force: true,
            })
        }
    } catch (error) {
        console.error('[createOrUpdate] -> ', error);
    }
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
        const val = await pouchDb.get(id);

        return val;
    } catch (error) {
        return null;
    }
}

async function databaseGetAllByPagination(query: any, stream: Duplex, limit: number = 10, skip: number = 0) {
    const result = await pouchDb.find({
        ...query,
        limit,
        skip,
    });

    result.docs.forEach((doc) => {
        stream.write(JSON.stringify(doc));
    });

    // Continue we probably didn't hit the end.
    if (result.docs.length === 10) {
        await databaseGetAllByPagination(query, stream, limit, skip + limit);
    } else {
        // We completed the query.
        stream.end();
    }
}

export function databaseGetAll(query: any): Duplex {
    try {
        const memStream = new MemoryStream();
        databaseGetAllByPagination(query, memStream, 10, 0);
        return memStream;
    } catch(error) {
        console.error('[databaseFind] ->', error);
        return null;
    }
}

export async function databaseFind(propertyKey: string, propertyValue: any) {
    try {
        const result = await pouchDb.find({
            selector: {
                [propertyKey]: propertyValue,
            }
        });

        return result;
    } catch (error) {
        console.error('[databaseFind] ->', error);
        return null;
    }
}

/**
 * Creates a mimick of the LevelDB api in order to be used with libraries that require
 * Leveldb.
 *
 * @export
 * @returns
 */
export function getDatabaseLevelDbMapping(): PouchDbLevelDbMapping {
    const db = startDatabase();
    return new PouchDbLevelDbMapping(db);
}

export async function synchroniseDatabase(src: string) {
    // // TODO: Figure out if we want to live update..
    // const replication = PouchDB.replicate(src, databaseTarget);

    // replication.on('complete', () => {
    //     console.log('Sync complete');
    // })
}
