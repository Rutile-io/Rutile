import BNType from 'bn.js';
import MerkleTree from '../../../models/MerkleTree';
import { getDatabaseLevelDbMapping } from '../../../services/DatabaseService';
import Transaction from '../../../models/Transaction';
import { numberToHex, hexStringToBuffer } from '../../../utils/hexUtils';
import { toHex, createZerosArray } from '../../rvm/utils/hexUtils';
import { rlpHash } from '../../../utils/keccak256';

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
    transaction: Transaction;
    length: number;

    constructor(transaction: Transaction) {
        this.transaction = transaction;
    }

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

        let length = await this.merkleTree.get('length');

        if (!length) {
            const zeroLength = numberToHex(0);
            length = hexStringToBuffer(zeroLength);

            await this.merkleTree.put('length', length);
        }

        this.length = parseInt(toHex(length), 16);
    }

    async addSlot(address: string, valueDespoited: BNType) {
        const slot: Slot = {
            address,
            deposited: valueDespoited,
            type: 'SLOT',
        };

        this.length = this.length + 1;
        console.log('[AddSlot] this.length -> ', this.length);
        const lengthHex = numberToHex(this.length);
        const lengthBuffer = hexStringToBuffer(lengthHex);

        await this.merkleTree.put('length', lengthBuffer);
        const buffer = Buffer.from(JSON.stringify(slot));

        await this.merkleTree.put(this.length.toString(), buffer);
    }
}

export default MilestoneSlots;
