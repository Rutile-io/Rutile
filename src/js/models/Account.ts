import * as Database from "../services/DatabaseService";
import Transaction from "./Transaction";

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
    alias: string;

    constructor(params: AccountParams) {
        this.address = params.address;
        this.balance = params.balance || 0;
        this.transactionIndex = params.transactionIndex || 0;
        this.codeHash = params.codeHash || '';
        this.storageRoot = params.storageRoot || '';
        this.alias = params.alias || '';
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

            return new Account(data);
        } catch (error) {
            console.error(error);
            return null;
        }
    }

    static async findOrCreate(address: string) {
        const account = await Account.getFromAddress(address);

        if (account) {
            return account;
        }

        const newAccount = new Account({
            address,
        });

        await newAccount.save();

        return newAccount;
    }
}

export default Account;
