import Transaction from "../../../../models/Transaction";
import { configuration } from "../../../../Configuration";
import Block from "../../../../models/Block";

export default async function createGenesisBlock() {
    const block = new Block({
        number: 1,
    });

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

    await block.execute();

    block.proofOfWork();

    return block;
}
