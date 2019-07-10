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
        let inputRootBuffer = Buffer.from(inputRoot, 'hex')
        const database = await getDatabaseLevelDbMapping();

        if (!inputRootBuffer.length) {
            inputRootBuffer = null;
        }

        // Merkle tree should probabbly have the input sorted out..
        this.merkleTree = new MerkleTree(database, inputRootBuffer);

        let length = await this.merkleTree.get('length');

        if (!length) {
            const zeroLength = numberToHex(0);
            length = hexStringToBuffer(zeroLength);

            await this.merkleTree.put('length', length);
        }

        this.length = parseInt(toHex(length), 16);
        console.log('[] this.length -> ', this.length);
    }

    async addSlot(address: string, valueDespoited: BNType) {
        const slot: Slot = {
            address,
            deposited: valueDespoited,
            type: 'SLOT',
        };

        this.length = this.length + 1;
        const lengthHex = numberToHex(this.length);
        const lengthBuffer = hexStringToBuffer(lengthHex);

        await this.merkleTree.put('length', lengthBuffer);
        const buffer = Buffer.from(JSON.stringify(slot));

        await this.merkleTree.put(this.length.toString(), buffer);
    }
}

export default MilestoneSlots;
