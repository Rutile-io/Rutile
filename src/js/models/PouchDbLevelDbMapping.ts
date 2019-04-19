import PouchDb from 'pouchdb';

type Callback = (error: any, result?: any) => void;

class PouchDbLevelDbMapping {
    pouchDb: PouchDB.Database;

    constructor(pouchDb: PouchDB.Database) {
        this.pouchDb = pouchDb;
    }

    get(key: Buffer, encoding: any, callback: Callback) {
        this.pouchDb.get(key.toString('hex')).then((doc: any) => {
            callback(null, Buffer.from(doc.value));
        }, (error) => {
            callback(error, null);
        });
    }

    put(key: Buffer, val: Buffer, encoding: any, callback: Callback) {
        const value = {
            _id: key.toString('hex'),
            value: val,
        };

        this.get(key, null, (err, v) => {
            if (v) {
                callback(err);
                return;
            }

            this.pouchDb.put(value).then((doc) => {
                callback(null, doc);
            }, (error) => {
                callback(error);
            });
        })
    }

    del(key: Buffer, encoding: any, callback: Callback) {
        this.pouchDb.remove({
            _id: key.toString('hex'),
            _rev: null,
        }).then(() => {
            callback(null, null)
        }, (error) => {
            callback(error, null);
        })
    }

    batch(opStack: any[], encoding: any, callback: Callback) {
        const batch = opStack.map((op) => {
            if (op.type === 'put') {
                return {
                    _id: op.key.toString('hex'),
                    value: op.value,
                };
            }
        });

        this.pouchDb.bulkDocs(batch).then(() => {
            callback(null, null);
        }, (error) => {
            console.error('[Batch] error -> ', error);
            callback(error, null)
        });
    }
}

export default PouchDbLevelDbMapping;
