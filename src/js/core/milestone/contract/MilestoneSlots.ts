import BNType from 'bn.js';
import MerkleTree from '../../../models/MerkleTree';
import { getDatabaseLevelDbMapping } from '../../../services/DatabaseService';

export interface Slot {
    // The address of the node
    address: string;

    // Used so we can slash and possibly return the amount
    deposited: BNType;

    // Just an identifier
    type: 'SLOT',
}

class MilestoneSlots {
    merkleTree: MerkleTree;

    async init() {
        const database = getDatabaseLevelDbMapping();

        // Merkle tree should probabbly have the input sorted out..
        this.merkleTree = new MerkleTree(database);
    }

    addSlot(address: string, valueDespoited: BNType) {
        this.merkleTree.put('');

        const slot: Slot = {
            address,
            deposited: valueDespoited,
            type: 'SLOT',
        };


    }
}

export default MilestoneSlots;
