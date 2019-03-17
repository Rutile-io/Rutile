import Transaction from '../../models/Transaction';
import { configuration } from '../../Configuration';

export default function createGenesisTransaction() {
    const transaction = new Transaction({
        ...configuration.genesis.transaction,
        gasLimit: 0,
        gasPrice: 0,
        transIndex: 0,
        data: [],
        r: '0000000000000000000000000000000000000000000000000000000000000000',
        s: '0000000000000000000000000000000000000000000000000000000000000000',
        v: 1,
        milestoneIndex: 1,
    });

    // We need to "sign" the transaction to retrieve our ID.
    transaction.sign();
    transaction.proofOfWork();

    console.log('[Genesis] transaction -> ', transaction);

    return transaction;
}
