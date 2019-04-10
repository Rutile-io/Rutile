import PeerToPeer from './models/PeerToPeer';
import Ipfs from './services/wrappers/Ipfs';
import { configuration } from './Configuration';
import Transaction from './models/Transaction';
import Dag from './models/Dag';
import EventHandler from './services/EventHandler';
import KeyPair from './models/KeyPair';
import Account from './models/Account';
import byteArrayToString from './utils/byteArrayToString';

// These functions should actually be executed on the network. Not locally.

class Rutile {
    private peerToPeer: PeerToPeer;
    private terminal: any;
    public ipfs: Ipfs;
    public dag: Dag;
    public eventHandler: EventHandler;

    static get Transaction() {
        return Transaction;
    }

    static get KeyPair() {
        return KeyPair;
    }

    static get Account() {
        return Account;
    }

    constructor() {
        this.ipfs = Ipfs.getInstance(configuration.ipfs);
        this.eventHandler = new EventHandler();
    }

    async start() {
        try {
            // Boot up our peer to peer network
            this.peerToPeer = new PeerToPeer(this.eventHandler);
            await this.peerToPeer.open();
        } catch (error) {
            console.error('Could not connect to peers: ', error);
        }

        this.dag = new Dag(this.eventHandler, this.peerToPeer);
    }

    async deploy(wasm: Uint8Array): Promise<string> {
        return this.ipfs.add(byteArrayToString(wasm));
    }

    async sendTransaction(transaction: Transaction) {
        this.peerToPeer.broadcastTransaction(transaction);
    }
}

export default Rutile;


