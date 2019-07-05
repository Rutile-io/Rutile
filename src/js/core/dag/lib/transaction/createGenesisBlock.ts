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

    // RUT amount creation
    Object.keys(configuration.genesis.alloc).forEach((address) => {
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

    // We have to create an account for some internal contracts
    // This way we can save the merkle root
    for (const internalContract of INTERNAL_CONTRACTS) {
        await Account.findOrCreate(internalContract);
    }

    // Validators creation
    Object.keys(configuration.genesis.stakes).forEach((address) => {
        const data = '0x00000001' + address.slice(2);

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
    });

    await block.execute();

    block.proofOfWork();

    GENESIS_BLOCK_ID = block.id;

    console.log('[] block -> ', block);

    return block;
}
