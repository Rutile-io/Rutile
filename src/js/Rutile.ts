import { NodeType } from './models/types/NodeType';
import PeerToPeer from './models/PeerToPeer';
import Lamda from './Lamda';
import Ipfs from './services/wrappers/Ipfs';
import { configuration } from './Configuration';
import Transaction from './models/Transaction';
import Dag from './models/Dag';
import EventHandler from './services/EventHandler';

// These functions should actually be executed on the network. Not locally.

class Rutile {
    private peerToPeer: PeerToPeer;
    private terminal: any;
    public ipfs: Ipfs;
    public dag: Dag;
    public eventHandler: EventHandler;

    static get Lamda() {
        return Lamda;
    }

    static get Transaction() {
        return Transaction;
    }

    constructor() {
        this.ipfs = Ipfs.getInstance(configuration.ipfs);
        this.eventHandler = new EventHandler();
    }

    async start() {
        // Boot up our peer to peer network
        this.peerToPeer = new PeerToPeer(this.eventHandler);
        await this.peerToPeer.open();
        this.dag = new Dag(this.eventHandler);
    }

    async deploy(lamda: Lamda): Promise<string> {
        const compiledLamda = await lamda.compile();

        // TODO: Deploy the script to a blockchain.
        const hash = await this.ipfs.add(compiledLamda);

        // Put it inside a blockchain and get the transaction id.
        return hash;
    }

    async sendTransaction(transaction: Transaction) {
        this.peerToPeer.broadcastTransaction(transaction);
    }
}

export default Rutile;


