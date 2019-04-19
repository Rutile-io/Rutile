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

    onNetworkMessage(event: NetworkMessageEvent) {
        const data = JSON.parse(event.data.toString());

        if (data.type === 'TRANSACTION') {
            const transaction = Transaction.fromRaw(data.value);
            this.dag.addTransaction(transaction);
        }
    }
}

export default NetworkController;
