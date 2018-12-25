import { NodeType } from './models/types/NodeType';
import PeerToPeer from './models/PeerToPeer';
import Lamda from './Lamda';
import Ipfs from './services/wrappers/Ipfs';
import { configuration } from './Configuration';
import Transaction from './models/Transaction';

// These functions should actually be executed on the network. Not locally.

class Rutile {
    private peerToPeer: PeerToPeer;
    private terminal: any;
    public ipfs: Ipfs;

    static get Transaction() {
        return Transaction;
    }

    constructor() {
        this.ipfs = Ipfs.getInstance(configuration.ipfs);
    }

    async start() {
        // Boot up our peer to peer network
        this.peerToPeer = new PeerToPeer();
        await this.peerToPeer.open();
    }

    async deploy(lamda: Lamda): Promise<string> {
        const compiledLamda = await lamda.compile();

        // TODO: Deploy the script to a blockchain.
        const hash = await this.ipfs.add(compiledLamda);

        // Put it inside a blockchain and get the transaction id.
        return hash;
    }

    async execute(scriptAddress: string, args?: string[]): Promise<any> {
        // Fetch script from blockchain and execute the script.
        const contents = await this.ipfs.cat(scriptAddress);
        const lamda = Lamda.fromCompiledLamdaString(contents);
        
        const result = await lamda.execute(args);

        return result;
    }
}

export default Rutile;


