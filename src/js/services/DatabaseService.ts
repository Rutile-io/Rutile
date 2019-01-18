import Transaction from '../models/Transaction';
import isNodeJs from './isNodeJs';

let PouchDB: PouchDB.Static = null;

if (isNodeJs()) {
    PouchDB = __non_webpack_require__('pouchdb');
} else {
    PouchDB = require('pouchdb').default;
}

const database = new PouchDB('db_rutile');

export async function saveTransaction(transaction: Transaction) {
    const rawTransaction = JSON.parse(transaction.toRaw());
    const data = {
        ...rawTransaction,
        _id: rawTransaction.id,
    }

    await database.put(data);
}

export async function create(id: string, obj: any) {
    const data = {
        ...obj,
        _id: id,
    };

    await database.put(data);
}

export async function getById(id: string) {
    return database.get(id);
}
