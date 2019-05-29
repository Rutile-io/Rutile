import Transaction from '../../models/Transaction';
import { configuration } from '../../Configuration';

export default async function createGenesisTransaction() {
    const transaction = new Transaction({
        ...configuration.genesis.transaction,
        gasLimit: 0,
        gasPrice: 0,
        transIndex: 0,
        data: '0000000000000000000000000000000000000000000000000000000000000000',
        r: '0000000000000000000000000000000000000000000000000000000000000000',
        s: '0000000000000000000000000000000000000000000000000000000000000000',
        v: 1,
        milestoneIndex: 1,
    });

    await transaction.execute();

    // We need to "sign" the transaction to retrieve our ID.
    transaction.sign();
    transaction.proofOfWork();

    return transaction;
}
