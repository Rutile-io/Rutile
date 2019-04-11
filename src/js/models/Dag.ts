import EventHandler from '../services/EventHandler';
import { PEER_TO_PEER_ON_PEER_DATA } from '../core/events';
import PeerController, { PeerDataMessage } from '../core/network/controller/PeerController';
import Transaction from './Transaction';
import { validateTransaction, applyTransaction, getTransactionById } from '../services/TransactionService';
import createGenesisTransaction from '../services/transaction/createGenesisTransaction';

class Dag {
    eventHandler: EventHandler;
    peerController: PeerController;

    constructor(eventHandler: EventHandler, peerController: PeerController) {
        this.peerController = peerController;
        this.eventHandler = eventHandler;
        this.eventHandler.on(PEER_TO_PEER_ON_PEER_DATA, this.onPeerData.bind(this));

        this.sync();
    }

    async onPeerData(message: PeerDataMessage) {
        try {
            if (message.data.type === 'TRANSACTION') {
                const transaction = Transaction.fromRaw(message.data.value);

                // Throws an error when transaction is not valid
                // and disposes the transaction
                await validateTransaction(transaction);

                console.log('transaction is valid! Sick, lets add it to the database');
            }
        } catch (error) {
            console.error('Transaction validation failed: ', error);
        }
    }

    /**
     * Sync should only be done on startup
     * It asks a different node in it's pool to get the latest DAG.
     * This is a temp implementation. The real implementation should not use couchDB.
     *
     * @memberof Dag
     */
    async sync() {
        try {
            const genesisTransaction = createGenesisTransaction();
            const isTransactionInDatabase = !!await getTransactionById(genesisTransaction.id);

            // We should not apply twice the genesis milestone
            if (!isTransactionInDatabase) {
                await applyTransaction(genesisTransaction);
            }
        } catch (error) {
            console.error('Oh noes -> ', error);
        }
    }
}

export default Dag;
