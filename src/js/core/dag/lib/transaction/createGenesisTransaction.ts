import Transaction from "../../../../models/Transaction";
import { configuration } from "../../../../Configuration";
import Account from "../../../../models/Account";

export default async function createGenesisTransaction(): Promise<Transaction> {
    let previousTransaction: Transaction = null;
    const allGenesisTransactions: Transaction[] = [];

    // Creation of all RUT tokens
    for (const address of Object.keys(configuration.genesis.alloc)) {
        const allocTransaction = new Transaction({
            to: address,
            value: configuration.genesis.alloc[address].balance,
            timestamp: 0,
            gasLimit: 0,
            gasPrice: 0,
            transIndex: 0,
            data: '0x0000000000000000000000000000000000000000000000000000000000000000',
            r: '0x0000000000000000000000000000000000000000000000000000000000000000',
            s: '0x0000000000000000000000000000000000000000000000000000000000000000',
            v: 1,
        });

        // Making sure we attach the transaction to something
        if (previousTransaction) {
            allocTransaction.parents = [
                previousTransaction.id,
                previousTransaction.id,
            ];
        }

        await allocTransaction.execute();
        allocTransaction.sign();
        allocTransaction.proofOfWork();
        previousTransaction = allocTransaction;

        await allocTransaction.save();
        allGenesisTransactions.push(allocTransaction);
    }

    const internalAddressTransactionIds = new Map<string, string>();

    // Validators creation
    for (const address of Object.keys(configuration.genesis.stakes)) {
        const data = '0x00000001' + address.slice(2);

        const transaction = new Transaction({
            to: '0x0200000000000000000000000000000000000000',
            value: configuration.genesis.stakes[address].value,
            timestamp: 0,
            gasLimit: 0,
            gasPrice: 0,
            transIndex: 0,
            data,
            r: '0x0000000000000000000000000000000000000000000000000000000000000000',
            s: '0x0000000000000000000000000000000000000000000000000000000000000000',
            v: 1,
        });

        // Making sure we attach the transaction to something
        if (previousTransaction) {
            transaction.parents = [
                previousTransaction.id,
                previousTransaction.id,
            ];
        }

        await transaction.execute();
        transaction.sign();
        transaction.proofOfWork();
        previousTransaction = transaction;

        internalAddressTransactionIds.set(transaction.to, transaction.id);
        await transaction.save();
        allGenesisTransactions.push(transaction);
    }

    // We have to create an account for some internal contracts
    // This way we can save the merkle root
    for (const internalContract of internalAddressTransactionIds) {
        await Account.create(internalContract[0], '', internalContract[1]);
    }

    // And now for the milestone transaction that connects all transactions together
    const milestoneTransaction = new Transaction({
        milestoneIndex: 1,
        to: null,
        timestamp: 0,
        gasLimit: 0,
        gasPrice: 0,
        transIndex: 0,
        data: '0x0000000000000000000000000000000000000000000000000000000000000000',
        r: '0x0000000000000000000000000000000000000000000000000000000000000000',
        s: '0x0000000000000000000000000000000000000000000000000000000000000000',
        v: 1,
    });

    milestoneTransaction.addParents(allGenesisTransactions);
    milestoneTransaction.sign();
    milestoneTransaction.proofOfWork();

    return milestoneTransaction;
}
