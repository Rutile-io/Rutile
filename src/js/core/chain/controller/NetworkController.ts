import Chain from "../Chain";
import Network from "../../network/Network";
import { NetworkMessageEvent } from "../../network/lib/types/Events";
import Transaction from "../../../models/Transaction";
import { Results } from "../../rvm/context";
import Block from "../../../models/Block";


class NetworkController {
    dag: Chain;
    network: Network;

    constructor(dag: Chain, network: Network) {
        this.dag = dag;
        this.network = network;
        this.network.on('message', this.onNetworkMessage.bind(this));
    }

    hasConnectedPeers() {
        return this.network.isOnline();
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

    broadcastBlock(block: Block, skipPeerIds?: string[]) {
        const message = JSON.stringify({
            type: 'BLOCK',
            value: block.toRaw(),
        });

        this.network.broadcast(message, skipPeerIds);
    }

    /**
     * Responds to a block sync request.
     *
     * @param {string | Buffer} transaction
     * @param {string} peerId
     * @memberof NetworkController
     */
    sendBlockSyncString(block: string | Buffer, peerId: string) {
        const message = JSON.stringify({
            type: 'BLOCK_SYNC',
            value: block,
        });

        this.network.sendDataToPeer(peerId, message);
    }

    sendBlockSyncComplete(lastBlock: Block, peerId: string) {
        const message = JSON.stringify({
            type: 'BLOCK_SYNC_COMPLETE',
            value: lastBlock.toRaw(),
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
        } else if (data.type === 'BLOCK') {
            const block = Block.fromRaw(data.value);
            this.dag.addBlock(block, event.peerId);
        } else if (data.type === 'SYNC_FROM_MILESTONE') {
            // A node sent us a request to synchronise our database.
            this.dag.synchroniseTo(data.value.number, event.peerId);
        } else if (data.type === 'BLOCK_SYNC') {
            const block = Block.fromRaw(data.value);
            this.dag.onBlockSyncMessage(block);
        } else if (data.type === 'BLOCK_SYNC_COMPLETE') {
            const block = Block.fromRaw(data.value);
            this.dag.chainSyncing.complete(block);
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
