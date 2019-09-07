import MerkleTree from '../../models/MerkleTree';
import { getDatabaseLevelDbMapping } from '../../services/DatabaseService';
import BNType from 'bn.js';

export interface IpfsFileObject {
    hash: String;
    value: BNType;
    hosts: Host[];
}

export interface Host {
    address: String;
}

const IPFS_KEY = 'ipfs-'
/**
 * Controller for the IPFS implementation
 *
 * @class IpfsController
 */
class IpfsController {
    merkleTree: MerkleTree;
    async init(inputRoot: string) {
        const database = await getDatabaseLevelDbMapping();

        if (inputRoot && inputRoot !== '0x' && inputRoot.length !== 66) {
            throw new Error('input root is not 32 bytes long');
        }

        if (!inputRoot || inputRoot === '0x') {
            inputRoot = null;
        }


        // Merkle tree should probabbly have the input sorted out..
        this.merkleTree = new MerkleTree(database, inputRoot);
    }

    async addFile(ipfsHash: String, address: String, valueDeposited: BNType){
        const host: Host = {
            address: address
        }

        const ipfsFile: IpfsFileObject = {
            hash: ipfsHash,
            value: valueDeposited,
            hosts: [host]
        };

        let buffer = Buffer.from(JSON.stringify(ipfsFile));
        await this.merkleTree.put(IPFS_KEY + ipfsHash, buffer);
    }

    async addHost(ipfsHash: String, address: String){

        let fileBuffer: Buffer = await this.merkleTree.get(`${IPFS_KEY}${ipfsHash}`);
        if(!fileBuffer){
            // TODO ipfs file not found
        }

        const file: IpfsFileObject = JSON.parse(fileBuffer.toString());
        let host = {
            address: address
        }
        file.hosts.push(host);

        let buffer = Buffer.from(JSON.stringify(file));
        await this.merkleTree.put(IPFS_KEY + ipfsHash, buffer);
    }
}

export default IpfsController;
