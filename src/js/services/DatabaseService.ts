import * as Logger from 'js-logger';
import * as MemoryStream from 'memorystream';
import { Duplex } from 'stream';
import Transaction from '../models/Transaction';
import isNodeJs from './isNodeJs';
import { configuration } from '../Configuration';
import PouchDbLevelDbMapping from '../models/PouchDbLevelDbMapping';
const ReplicationStream = require('pouchdb-replication-stream');

let pouchDb: PouchDB.Database = null;

/**
 * Starts the database
 *
 * @export
 */
export async function startDatabase(): Promise<PouchDB.Database> {
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
                };
            }

            pouchDb.put(newData, {
                force: true,
            })
        }
    } catch (error) {
        Logger.error(`createOrUpdate failed, data given id/${id}:value/${JSON.stringify(obj)}:document${JSON.stringify(document)} ->`, error);
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

export async function databaseGetById(id: string): Promise<any> {
    return getById(id);
}

/**
 * Removes an item from the database
 *
 * @export
 * @param {string} id
 * @returns
 */
export async function databaseRemove(id: string): Promise<boolean> {
    try {
        const doc = await getById(id);
        await pouchDb.remove(doc);
        return true;
    } catch (error) {
        Logger.error(error);
        return false;
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
export async function getDatabaseLevelDbMapping(): Promise<PouchDbLevelDbMapping> {
    const db = await startDatabase();
    return new PouchDbLevelDbMapping(db);
}

export async function synchroniseDatabase(src: string) {
    // // TODO: Figure out if we want to live update..
    // const replication = PouchDB.replicate(src, databaseTarget);

    // replication.on('complete', () => {
    //     console.log('Sync complete');
    // })
}
