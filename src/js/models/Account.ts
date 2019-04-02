import * as Database from "../services/DatabaseService";
import Transaction from "./Transaction";
import MerkleTree from "./MerkleTree";
import keccak256 from "../utils/keccak256";
import hexZeroPad from "../utils/hexZeroPad";
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

    constructor(params: AccountParams) {
        this.address = params.address;
        this.balance = params.balance || 0;
        this.transactionIndex = params.transactionIndex || 0;
        this.codeHash = params.codeHash || '';
        this.storageRoot = params.storageRoot;
        this.alias = params.alias || '';
        this.storage = new MerkleTree(Database.startDatabase(), this.storageRoot);
    }

    /**
     * Maps all data from storage to the account
     *
     * @memberof Account
     */
    async fill() {
        const storageData = await this.storage.fill();
        const hexBalance = '0x' + toHex(storageData.get('balance'));
        const hexTransactionIndex = '0x' + toHex(storageData.get('transactionIndex'));

        this.address = '0x' + toHex(storageData.get('address'));
        this.balance = parseInt(hexBalance, 16);
        this.transactionIndex = parseInt(hexTransactionIndex, 16);

        this.storage.flushCache();
    }

    async setBalance(balance: number) {
        const buffer = hexStringToBuffer(numberToHex(balance));
        await this.storage.put('balance', buffer);

        this.storageRoot = await this.storage.getMerkleRoot();
    }

    async setTransactionIndex(index: number) {
        const buffer = hexStringToBuffer(numberToHex(index));
        await this.storage.put('transactionIndex', buffer);

        this.storageRoot = await this.storage.getMerkleRoot();
    }

    /**
     * Validates if the transaction is possible (balance wise)
     *
     * @param {Transaction} transaction
     * @memberof Account
     */
    validateTransaction(transaction: Transaction) {
        if (transaction.transIndex === this.transactionIndex) {
            throw new Error('Transaction index should not be the same as the previous transaction index');
        }

        if (transaction.transIndex < this.transactionIndex) {
            throw new Error('Transaction index should not be lower than the previous transaction index');
        }

        const expectedNewTransactionIndex = this.transactionIndex + 1;

        if (expectedNewTransactionIndex !== transaction.transIndex) {
            throw new Error('Missed previous transaction, either out of sync or corrupted transaction');
        }

        const newBalance = this.balance - transaction.value;

        if (newBalance < 0) {
            throw new Error('Insuffecient balance');
        }

        return true;
    }

    async applyTransaction(transaction: Transaction) {
        if (!this.validateTransaction(transaction)) {
            return;
        }

        // Update our from our account
        const newBalance = this.balance - transaction.value;
        this.balance = newBalance;
        this.transactionIndex = transaction.transIndex;

        // Update the account where the tokens are sent to
        const toAccount = await Account.findOrCreate(transaction.to);
        toAccount.balance = toAccount.balance + transaction.value;

        // TODO: For a lamda address we should update the state of the address
        // TODO: Also include the transaction as part of a merkle tree

        // Save our changes
        await Promise.all([this.save(), toAccount.save()]);
    }

    async save() {
        await Database.createOrUpdate(this.address, JSON.stringify({
            address: this.address,
            balance: this.balance,
            transactionIndex: this.transactionIndex,
            codeHash: this.codeHash,
            storageRoot: this.storageRoot,
        }));
    }

    static async getFromAddress(address: string): Promise<Account> {
        try {
            const data: any = await Database.getById(address);

            if (!data) {
                return null;
            }

            return new Account(JSON.parse(data));
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
        const merkleTree = new MerkleTree(Database.startDatabase());
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
