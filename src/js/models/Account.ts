import * as Database from "../services/DatabaseService";
import Transaction from "./Transaction";
import MerkleTree from "./MerkleTree";
import { toHex } from "../core/rvm/utils/hexUtils";
import { numberToHex, hexStringToBuffer } from "../utils/hexUtils";

interface AccountParams {
    address: string;
    balance?: number;
    transactionIndex?: number;
    codeHash?: string;
    storageRoot?: string;
    alias?: string;
}

class Account {
    address: string = '';
    balance: number = 0;
    transactionIndex: number = 0;
    codeHash: string;
    storageRoot: string;
    storage: MerkleTree;
    alias: string;
    isFilled: boolean;

    constructor(params: AccountParams) {
        this.address = params.address;
        this.balance = params.balance || 0;
        this.transactionIndex = params.transactionIndex || 0;
        this.codeHash = params.codeHash || '';
        this.storageRoot = params.storageRoot;
        this.alias = params.alias || '';
        this.storage = new MerkleTree(Database.getDatabaseLevelDbMapping(), this.storageRoot);
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

        const storageData = await this.storage.fill();

        const balance = storageData.get('balance') || [0];
        const transactionIndex = storageData.get('transactionIndex') || [0];
        const address = storageData.get('address') || [0];

        const hexBalance = '0x' + toHex(balance);
        const hexTransactionIndex = '0x' + toHex(transactionIndex);

        this.address = '0x' + toHex(address);
        this.balance = parseInt(hexBalance, 16);
        this.transactionIndex = parseInt(hexTransactionIndex, 16);

        this.isFilled = true;

        this.storage.flushCache();
    }

    async setBalance(balance: number) {
        if (typeof balance !== 'number') {
            throw new TypeError('balance should be a number');
        }

        const buffer = hexStringToBuffer(numberToHex(balance));
        await this.storage.put('balance', buffer);

        this.storageRoot = await this.storage.getMerkleRoot();
    }

    async setTransactionIndex(index: number) {
        const buffer = hexStringToBuffer(numberToHex(index));
        await this.storage.put('transactionIndex', buffer);

        this.storageRoot = await this.storage.getMerkleRoot();
    }

    async save() {
        await Database.createOrUpdate(this.address, {
            address: this.address,
            balance: this.balance,
            transactionIndex: this.transactionIndex,
            codeHash: this.codeHash,
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

    static async findOrCreate(address: string) {
        const account = await Account.getFromAddress(address);

        if (account) {
            await account.fill();
            return account;
        }

        return Account.create(address);
    }

    static async create(address: string) {
        const merkleTree = new MerkleTree(Database.getDatabaseLevelDbMapping());
        const zeroBuffer = hexStringToBuffer('0x00');

        await merkleTree.put('address', hexStringToBuffer(address));
        await merkleTree.put('balance', zeroBuffer);
        await merkleTree.put('transactionIndex', zeroBuffer);

        const storageRoot = await merkleTree.getMerkleRoot();

        const newAccount = new Account({
            address,
            storageRoot,
        });

        await newAccount.save();

        return newAccount;
    }
}

export default Account;
