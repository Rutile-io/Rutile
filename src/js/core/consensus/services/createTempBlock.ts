import Wallet from "../../../models/Wallet";
import { configuration } from "../../../Configuration";
import Block from "../../../models/Block";
import Transaction from "../../../models/Transaction";

export default async function createTempBlock(currentBlock: Block, transactions: Transaction[]): Promise<Block> {
    const wallet = new Wallet(configuration.privateKey);
    const block = new Block({
        stateRoot: currentBlock.stateRoot,
        number: currentBlock.number + 1,
        parent: currentBlock.id,
    });

    transactions.forEach((tx) => {
        tx.sign(wallet.keyPair);
    });

    await block.addTransactions(transactions);

    return block;
}
