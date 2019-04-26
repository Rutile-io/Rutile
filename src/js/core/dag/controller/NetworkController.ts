import Dag from "../dag";
import Network from "../../network/Network";
import { NetworkMessageEvent } from "../../network/lib/types/Events";
import Transaction from "../../../models/Transaction";

class NetworkController {
    dag: Dag;
    network: Network;

    constructor(dag: Dag, network: Network) {
        this.dag = dag;
        this.network = network;

        this.network.on('message', this.onNetworkMessage.bind(this));
    }

    broadcastTransaction(transaction: Transaction) {
        this.network.broadcastTransaction(transaction);
    }

    /**
     * responds to a transaction sync request.
     *
     * @param {Transaction} transaction
     * @param {string} peerId
     * @memberof NetworkController
     */
    sendTransactionSyncString(transaction: string | Buffer, peerId: string) {
        const message = JSON.stringify({
            type: 'TRANSACTION_SYNC',
            value: transaction,
        });

        this.network.sendDataToPeer(peerId, message);
    }

    broadcastSynchroniseRequest(milestoneIndex: number) {
        const message = {
            type: 'SYNC_FROM_MILESTONE',
            value: {
                milestoneIndex,
            },
        };

        this.network.broadcast(JSON.stringify(message));
    }

    private onNetworkMessage(event: NetworkMessageEvent) {
        const data = JSON.parse(event.data.toString());

        if (data.type === 'TRANSACTION') {
            const transaction = Transaction.fromRaw(data.value);
            this.dag.addTransaction(transaction);
        } else if (data.type === 'SYNC_FROM_MILESTONE') {
            // A node sent us a request to synchronise our database.
            this.dag.synchroniseTo(data.value.milestoneIndex, event.peerId);
        } else if (data.type === 'TRANSACTION_SYNC') {
            const transaction = Transaction.fromRaw(data.value);
            this.dag.onTransactionSyncMessage(transaction);
        }
    }
}

export default NetworkController;
