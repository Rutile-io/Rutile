import BNType from 'bn.js';
import MerkleTree from '../../../models/MerkleTree';
import { getDatabaseLevelDbMapping } from '../../../services/DatabaseService';
import Transaction from '../../../models/Transaction';
import { numberToHex, hexStringToBuffer } from '../../../utils/hexUtils';
import { toHex, createZerosArray } from '../../rvm/utils/hexUtils';
import * as Logger from 'js-logger';
const BN = require('bn.js');

export interface Slot {
    // The address of the node
    address: string;

    // Used so we can slash and possibly return the amount
    deposited: BNType;

    // Just an identifier
    type: 'SLOT',
}

const SLOT_KEY = 'slot-';

class MilestoneSlots {
    merkleTree: MerkleTree;
    transaction: Transaction;
    length: number;
    validatorSetLength: number;

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

        let length = await this.merkleTree.get(`${SLOT_KEY}length`);

        if (!length) {
            const zeroLength = numberToHex(0);
            length = hexStringToBuffer(zeroLength);

            await this.merkleTree.put(`${SLOT_KEY}length`, length);
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
        const lengthHex = numberToHex(this.length);
        const lengthBuffer = hexStringToBuffer(lengthHex);

        await this.merkleTree.put(`${SLOT_KEY}length`, lengthBuffer);
        const buffer = Buffer.from(JSON.stringify(slot));

        await this.merkleTree.put(SLOT_KEY + this.length.toString(), buffer);
    }

    async getSlot(index: number): Promise<Slot> {
        const buffer: Buffer = await this.merkleTree.get(`${SLOT_KEY}${index}`);

        if (!buffer) {
            Logger.warn(`Consensus: No nodes found, did you configure the genesis with nodes?`);

            return {
                address: '0x0000000000000000000000000000000000000000',
                deposited: new BN(0),
                type: 'SLOT',
            };
        }

        const slot: Slot = JSON.parse(buffer.toString());
        return slot;
    }
}

export default MilestoneSlots;
