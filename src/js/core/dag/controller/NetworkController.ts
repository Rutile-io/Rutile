import Dag from "../Dag";
import Network from "../../network/Network";
import { NetworkMessageEvent } from "../../network/lib/types/Events";
import Transaction from "../../../models/Transaction";
import Block from "../../../models/Block";

class NetworkController {
    dag: Dag;
    network: Network;

    constructor(dag: Dag, network: Network) {
        this.dag = dag;
        this.network = network;
        this.network.on('message', this.onNetworkMessage.bind(this));
    }

    /**
     * Broadcasts a block to the connected peers
     *
     * @param {Block} block
     * @memberof NetworkController
     */
    broadcastBlock(block: Block) {
        this.network.broadcastBlock(block);
    }

    /**
     * responds to a transaction sync request.
     *
     * @param {Transaction} transaction
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

        if (data.type === 'BLOCK') {
            const block = Block.fromRaw(data.value);

            this.dag.addBlock(block, event.peerId);
        } else if (data.type === 'SYNC_FROM_MILESTONE') {
            // A node sent us a request to synchronise our database.
            this.dag.synchroniseTo(data.value.number, event.peerId);
        } else if (data.type === 'BLOCK_SYNC') {
            const block = Block.fromRaw(data.value);
            this.dag.onBlockSyncMessage(block);
        }
    }
}

export default NetworkController;
