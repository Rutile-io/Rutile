import Dag from "../Dag";
import Network from "../../network/Network";
import { NetworkMessageEvent } from "../../network/lib/types/Events";
import Transaction from "../../../models/Transaction";
import { Results } from "../../rvm/context";

class NetworkController {
    dag: Dag;
    network: Network;

    constructor(dag: Dag, network: Network) {
        this.dag = dag;
        this.network = network;
        this.network.on('message', this.onNetworkMessage.bind(this));
    }

    /**
     * Broadcasts a transaction to the connected peers
     *
     * @param {Transaction} transaction
     * @memberof NetworkController
     */
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

    broadcastSendTransactionResultRequest(transactionId: string): Promise<Results> {
        return new Promise((resolve) => {
            const message = {
                type: 'GET_TRANSACTION_RESULT',
                value: {
                    transactionId,
                },
            };

            this.network.broadcast(JSON.stringify(message));
            let eventId: any = null;

            eventId = this.network.on('message', (event: NetworkMessageEvent) => {
                const data = JSON.parse(event.data.toString());

                if (data.type === 'TRANSACTION_RESULT') {
                    if (!data.value) {
                        return;
                    }

                    if (data.value.id === transactionId) {
                        this.network.remove(eventId);
                        resolve(data.value.results);
                    }
                }
            })
        });
    }

    broadcastSynchroniseRequest(number: number) {
        const message = {
            type: 'SYNC_FROM_MILESTONE',
            value: {
                number,
            },
        };

        this.network.broadcast(JSON.stringify(message));
    }

    private onNetworkMessage(event: NetworkMessageEvent) {
        const data = JSON.parse(event.data.toString());

        if (data.type === 'TRANSACTION') {
            const transaction = Transaction.fromRaw(data.value);

            this.dag.addTransaction(transaction, event.peerId);
        } else if (data.type === 'SYNC_FROM_MILESTONE') {
            // A node sent us a request to synchronise our database.
            this.dag.synchroniseTo(data.value.number, event.peerId);
        } else if (data.type === 'TRANSACTION_SYNC') {
            const transaction = Transaction.fromRaw(data.value);
            this.dag.onTransactionSyncMessage(transaction);
        } else if (data.type === 'GET_TRANSACTION_RESULT') {
            let eventId: any = null;
            // Making sure the peer id does not get garbage collected
            const peerId = event.peerId;

            // TODO: For now we assume it hasn't fired yet..
            eventId = this.dag.on('transactionsExecuteResult', (event: any) => {
                const resultPair = event.transactionResults.find((tx: any) => tx.id === data.value.transactionId);
                const message = {
                    type: 'TRANSACTION_RESULT',
                    value: resultPair,
                }

                this.network.sendDataToPeer(peerId, JSON.stringify(message));
                this.dag.remove(eventId);
            })
        }
    }
}

export default NetworkController;
