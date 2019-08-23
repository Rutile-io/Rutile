import Transaction from "../../../../models/Transaction";
import Account from "../../../../models/Account";
import { getAddressFromTransaction } from "./TransactionService";
import Block from "../../../../models/Block";

/**
 * Transfers the value from one address to the next
 * Does no checking if the transaction index is correct
 * Call Transaction.validate() for that
 *
 * @export
 * @param {Transaction} transaction
 */
export async function transferTransactionValue(transaction: Transaction, block: Block): Promise<void> {
    // Zero transaction don't need to be transfered
    if (transaction.value.isZero()) {
        return;
    }

    const addresses = getAddressFromTransaction(transaction);

    if (!addresses.to) {
        throw new Error('Cannot transfer value to a non existing address');
    }

    if (!addresses.from && !block.isGenesis()) {
        throw new Error('Could not recover from address');
    }

    // The genesis block creates tokens out of tin air
    if (!block.isGenesis()) {
        const fromAccount = await Account.findOrCreate(addresses.from);
        const newFromAccountBalance = fromAccount.balance.sub(transaction.value);
        await fromAccount.setBalance(newFromAccountBalance);
        await fromAccount.save();

        if (newFromAccountBalance.isNeg()) {
            throw new Error('"From account" spent tokens it doesn\'t have');
        }
    }

    const toAccount = await Account.findOrCreate(addresses.to);
    const newToAccountBalance = toAccount.balance.add(transaction.value);

    await toAccount.setBalance(newToAccountBalance);
    await toAccount.save();
}
