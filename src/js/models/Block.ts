import sha256 from 'crypto-js/sha256';
import Transaction from './Transaction';

class Block {
    previousHash: string;
    timestamp: number;
    transactions: Transaction[];
    hash: string;
    nonce: number;

    constructor(timestamp: number, transactions: Transaction[], previousHash = '') {
        this.previousHash = previousHash;
    }

    calculateHash() {
        return sha256(this.previousHash + this.timestamp + JSON.stringify(this.transactions) + this.nonce).toString();
    }

    mineBlock(difficulty: number) {
        while(this.hash.substring(0, difficulty) !== Array(difficulty + 1).join('0')) {
            this.nonce += 1;
            this.hash = this.calculateHash();
        }

        console.log('Block mined -> ', this.hash);
    }
}

export default Block;
