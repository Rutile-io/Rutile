import Transaction from "../../../../models/Transaction";
import { configuration } from "../../../../Configuration";
import Block from "../../../../models/Block";
import { INTERNAL_CONTRACTS } from "../../../../services/getInternalContract";
import Account from "../../../../models/Account";

let GENESIS_BLOCK_ID = '';

export async function getGenesisBlockId() {
    if (!GENESIS_BLOCK_ID) {
        await createGenesisBlock();
    }

    return GENESIS_BLOCK_ID;
}

export default async function createGenesisBlock() {
    const block = new Block({
        number: 1,
    });

    console.log('Genesis creation woop!');

    // RUT amount creation
    Object.keys(configuration.genesis.alloc).forEach((address) => {
        block.inputs.push('0x');

        const allocTransaction = new Transaction({
            to: address,
            value: configuration.genesis.alloc[address].balance,
            timestamp: 0,
            gasLimit: 0,
            gasPrice: 0,
            nonce: 0,
            data: '0x0000000000000000000000000000000000000000000000000000000000000000',
            r: '0x0000000000000000000000000000000000000000000000000000000000000000',
            s: '0x0000000000000000000000000000000000000000000000000000000000000000',
            v: 1,
        });

        allocTransaction.sign();

        block.addTransactions([allocTransaction]);
    });

    const internalAddressTransactionIds = new Map<string, string>();

    // Validators creation
    Object.keys(configuration.genesis.stakes).forEach((address) => {
        const data = '0x00000001' + address.slice(2);

        block.inputs.push('0x');

        const transaction = new Transaction({
            to: '0x0200000000000000000000000000000000000000',
            value: configuration.genesis.stakes[address].value,
            timestamp: 0,
            gasLimit: 0,
            gasPrice: 0,
            nonce: 0,
            data,
            r: '0x0000000000000000000000000000000000000000000000000000000000000000',
            s: '0x0000000000000000000000000000000000000000000000000000000000000000',
            v: 1,
        });

        transaction.sign();
        block.addTransactions([transaction]);

        internalAddressTransactionIds.set(transaction.to, transaction.id);
    });

    await block.execute();

    block.proofOfWork();

    GENESIS_BLOCK_ID = block.id;

     // We have to create an account for some internal contracts
    // This way we can save the merkle root
    for (const internalContract of internalAddressTransactionIds) {
        await Account.create(internalContract[0], '', internalContract[1]);
    }

    return block;
}
