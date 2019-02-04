import EventHandler from '../services/EventHandler';
import { PEER_TO_PEER_ON_PEER_DATA } from '../core/events';
import { PeerDataMessage } from './PeerToPeer';
import Transaction from './Transaction';

class Dag {
    eventHandler: EventHandler;

    constructor(eventHandler: EventHandler) {
        this.eventHandler = eventHandler;
        this.eventHandler.on(PEER_TO_PEER_ON_PEER_DATA, this.onPeerData.bind(this));
    }

    async onPeerData(message: PeerDataMessage) {
        try {
            if (message.data.type === 'TRANSACTION') {
                const transaction = Transaction.fromRaw(message.data.value);

                // Throws an error when transaction is not valid
                // and disposes the transaction
                await Transaction.validate(transaction);

                console.log('transaction is valid! Sick, lets add it to the database');
            }
        } catch (error) {
            console.error(error);
        }
    }

    /**
     * Sync should only be done on startup
     * It asks a different node in it's pool to get the DAG.
     *
     * @memberof Dag
     */
    sync() {

    }
}

export default Dag;
