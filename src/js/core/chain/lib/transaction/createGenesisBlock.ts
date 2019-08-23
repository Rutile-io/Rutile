import Transaction from "../../../../models/Transaction";
import { configuration } from "../../../../Configuration";
import Account from "../../../../models/Account";
import Block from "../../../../models/Block";

export default async function createGenesisBlock(): Promise<Block> {
    const allTransactions: Transaction[] = [];

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

        allocTransaction.sign();
        allocTransaction.proofOfWork();
        allTransactions.push(allocTransaction);
    }

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

        transaction.sign();
        transaction.proofOfWork();
        allTransactions.push(transaction);
    }

    // We have to create an account for some internal contracts
    // This way we can save the merkle root
    // for (const internalContract of internalAddressTransactionIds) {
    //     await Account.create(internalContract[0], '', internalContract[1]);
    // }

    // And now for the milestone transaction that connects all transactions together
    const block = new Block({
        number: 1,
        timestamp: 0,
        gasLimit: 80000000000,
    });

    block.addTransactions(allTransactions);
    block.proofOfWork();
    await block.execute();


    return block;
}
