import Transaction from '../models/Transaction';
import isNodeJs from './isNodeJs';

let PouchDB: PouchDB.Static = null;

if (isNodeJs()) {
    PouchDB = __non_webpack_require__('pouchdb');
    PouchDB.plugin(__non_webpack_require__('pouchdb-find'))
} else {
    PouchDB = require('pouchdb').default;
    PouchDB.plugin(require('pouchdb-find'));
}

const database = new PouchDB('db_rutile', {
    revs_limit: 1,
});


export async function saveTransaction(transaction: Transaction) {
    const rawTransaction = JSON.parse(transaction.toRaw());
    const data = {
        ...rawTransaction,
        _id: rawTransaction.id,
    }

    await database.put(data);
}

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

export async function getById(id: string) {
    try {
        const doc = await database.get(id);
        return doc;
    } catch (error) {
        return null;
    }
}
