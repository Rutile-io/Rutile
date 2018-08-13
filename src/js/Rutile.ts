import { NodeType } from './models/types/NodeType';
import PeerToPeer from './models/PeerToPeer';
import Executable from './Executable';

class Rutile {
    peerToPeer: PeerToPeer;

    constructor(nodeType: NodeType) {
        // Boot up our peer to peer network
        this.peerToPeer = new PeerToPeer();
        this.peerToPeer.open();
    }

    async deployScript(script: Executable) {
        // Deploy the script to a blockchain.
    }

    async executeScript(scriptAddress: string) {
        // Fetch script from blockchain and execute the script.
    }
}