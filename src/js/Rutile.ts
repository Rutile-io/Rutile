import PeerController from './core/network/controller/PeerController';
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
    private peerController: PeerController;
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

    get Ipfs(){
        return this.ipfs;
    }

    constructor() {
        this.ipfs = Ipfs.getInstance(configuration.ipfs);
        this.eventHandler = new EventHandler();
    }

    async start() {
        try {
            // Boot up our peer to peer network
            this.peerController = new PeerController();
            await this.peerController.open();
        } catch (error) {
            console.error('Could not connect to peers: ', error);
        }

        this.dag = new Dag(this.eventHandler, this.peerController);
    }

    async deploy(wasm: Uint8Array): Promise<string> {
        return this.ipfs.add(byteArrayToString(wasm));
    }

    async sendTransaction(transaction: Transaction) {
        this.peerController.broadcastTransaction(transaction);
    }
}

export default Rutile;


