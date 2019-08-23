import * as Database from "../services/DatabaseService";
import Transaction from "./Transaction";
import MerkleTree from "./MerkleTree";
import { toHex } from "../core/rvm/utils/hexUtils";
import { numberToHex, hexStringToBuffer } from "../utils/hexUtils";
import BNtype from 'bn.js';
const BN = require('bn.js');

interface AccountParams {
    address: string;
    storageRoot: string;
}

class Account {
    address: string = '';
    balance: BNtype;
    transactionIndex: number = 0;
    codeHash: string;
    storageRoot: string;
    storage: MerkleTree;
    alias: string;
    isFilled: boolean;
    creationTransactionId: string;

    constructor(params: AccountParams) {
        this.storageRoot = params.storageRoot;
        this.address = params.address;
    }

    /**
     * Maps all data from storage to the account
     *
     * @memberof Account
     */
    async fill() {
        if (this.isFilled) {
            return;
        }

        const dbMapping = await Database.getDatabaseLevelDbMapping();
        this.storage = new MerkleTree(dbMapping, this.storageRoot);

        const storageData = await this.storage.fill();

        const balance = storageData.get('balance') || [0];
        const transactionIndex = storageData.get('transactionIndex') || [0];
        const address = storageData.get('address') || [0];
        const codeHash = storageData.get('codeHash') || [0];
        const creationTransactionId = storageData.get('creationTransactionId') || [0];

        const hexTransactionIndex = '0x' + toHex(transactionIndex);

        this.address = '0x' + toHex(address);
        this.balance = new BN(balance);
        this.transactionIndex = parseInt(hexTransactionIndex, 16);
        this.codeHash = '0x' + toHex(codeHash);
        this.creationTransactionId = '0x' + toHex(creationTransactionId);

        this.isFilled = true;

        this.storage.flushCache();
    }

    async setBalance(balance: BNtype) {
        if (!BN.isBN(balance)) {
            throw new TypeError('balance should be a number');
        }

        await this.storage.put('balance', balance.toArrayLike(Buffer));
        this.storageRoot = await this.storage.getMerkleRoot();
    }

    async setTransactionIndex(index: number) {
        const buffer = hexStringToBuffer(numberToHex(index));
        await this.storage.put('transactionIndex', buffer);
        this.storageRoot = await this.storage.getMerkleRoot();
    }

    async save() {
        await Database.createOrUpdate(this.address, {
            storageRoot: this.storageRoot,
        });
    }

    static async getFromAddress(address: string): Promise<Account> {
        try {
            const data: any = await Database.getById(address);

            if (!data) {
                return null;
            }

            const account = new Account(data);
            await account.fill();

            return account;
        } catch (error) {
            console.error(error);
            return null;
        }
    }

    static async findOrCreate(address: string, codeHash?: string, creationTransactionId?: string) {
        const account = await Account.getFromAddress(address);

        if (account) {
            await account.fill();
            return account;
        }

        return Account.create(address, codeHash, creationTransactionId);
    }

    /**
     * Creates an account
     *
     * @static
     * @param {string} address The address of the new account
     * @param {string} [codeHash] The IPFS Hash if available (Location of the code)
     * @param {string} [transactionId] The transaction id where the contract was created
     * @returns
     * @memberof Account
     */
    static async create(address: string, codeHash?: string, creationTransactionId?: string): Promise<Account> {
        const dbMapping = await Database.getDatabaseLevelDbMapping();
        const merkleTree = new MerkleTree(dbMapping);
        const zeroBuffer = hexStringToBuffer('0x00');

        await merkleTree.put('address', hexStringToBuffer(address));
        await merkleTree.put('balance', zeroBuffer);
        await merkleTree.put('transactionIndex', zeroBuffer);
        await merkleTree.put('creationTransactionId', hexStringToBuffer(creationTransactionId));

        if (codeHash) {
            if (!creationTransactionId) {
                throw new Error('Contract creations should have a transaction id attached to it');
            }

            await merkleTree.put('codeHash', hexStringToBuffer(codeHash));
        }

        const storageRoot = await merkleTree.getMerkleRoot();

        const newAccount = new Account({
            address: address,
            storageRoot,
        });

        await newAccount.save();

        return newAccount;
    }
}

export default Account;
