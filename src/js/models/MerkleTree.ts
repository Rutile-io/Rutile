import { LevelUp } from "levelup";
import PouchDbLevelDbMapping from "./PouchDbLevelDbMapping";
import { getDatabaseLevelDbMapping } from "../services/DatabaseService";

const Trie = require('merkle-patricia-tree');

class MerkleTree {
    public trie: any;
    private cache: Map<string | Buffer, Uint8Array | Buffer>;
    private storagePromises: Array<Promise<any>>;

    static get Trie(): any {
        return Trie;
    }

    constructor(db: PouchDbLevelDbMapping, root?: string | Buffer) {
        this.trie = new Trie(db, root);
        this.cache = new Map();
        this.storagePromises = [];
    }

    /**
     * Puts the data in cache so it can be accessed synchronously
     * It does however puts it in the database async.
     *
     * @param {(string | Buffer)} key
     * @param {(string | Buffer)} value
     * @memberof MerkleTree
     */
    putSync(key: string | Buffer, value: Uint8Array) {
        this.cache.set(key, value);
        this.put(key, value);
    }

    /**
     * Puts the key value pair inside the database
     * Changing the merkle root
     *
     * @param {(string | Buffer)} key
     * @param {(string | Buffer)} value
     * @returns
     * @memberof MerkleTree
     */
    async put(key: string | Buffer | Uint8Array, value: Uint8Array) {
        let valueArr = Array.from(value);

        const promise = new Promise((resolve, reject) => {
            this.trie.put(key, valueArr, (err: any) => {
                if (err) return reject(err);
                resolve();
            });
        });

        this.storagePromises.push(promise);

        return promise;
    }

    /**
     * Gets data synchronously from the cache.
     *
     * @param {(string | Buffer)} key
     * @returns
     * @memberof MerkleTree
     */
    getSync(key: string | Buffer) {
        return this.cache.get(key);
    }

    /**
     * Asynchronously gets data from the database
     *
     * @param {(string | Buffer)} key
     * @returns
     * @memberof MerkleTree
     */
    async get(key: string | Buffer): Promise<any> {
        return new Promise((resolve, reject) => {
            this.trie.get(key, (err: any, value: Buffer | Uint8Array) => {
                if (err) return reject(err);

                resolve(value);
            });
        });
    }

    /**
     * Reverts the changes made to the merkle tree
     *
     * @returns
     * @memberof MerkleTree
     */
    async revert() {
        return new Promise((resolve, reject) => {
            this.trie.revert((err: any, result: any) => {
                if (err) return reject();

                resolve(result);
            });
        });
    }

    /**
     * Finishes all promises and gets the merkle root.
     *
     * @returns {Promise<string>}
     * @memberof MerkleTree
     */
    async getMerkleRoot(): Promise<string> {
        await Promise.all(this.storagePromises);

        return '0x' + this.trie.root.toString('hex');
    }


    /**
     * Fills the cache based on the merkle root
     * This is currently needed for WASM execution on JavaScript.
     *
     * @returns
     * @memberof MerkleTree
     */
    async fill(): Promise<any> {
        return new Promise((resolve) => {
            this.createReadStream().on('data', (data: any) => {
                this.cache.set(data.key, data.value);
            }).on('end', () => {
                resolve(this.cache);
            })
        });
    }

    flushCache() {
        this.cache = new Map();
    }

    createReadStream() {
        return this.trie.createReadStream();
    }
}

export default MerkleTree;

/**
 * Creates an instance of MerkleTree
 *
 * @export
 * @param {string} [root]
 * @returns
 */
export async function createMerkleTree(root?: string) {
    const db = await getDatabaseLevelDbMapping();
    return new MerkleTree(db, root);
}
