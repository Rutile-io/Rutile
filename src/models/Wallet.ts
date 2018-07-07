import Transaction from './Transaction';
const keypair = require('keypair');

class Wallet {
    address: string;
    publicKey: string;
    privateKey?: string;

    constructor(address) {

    }

    static getWallet(): Wallet {

    }

    static createWallet(): Wallet {
        const keyPair = keypair();

    }

    static signTransaction(transaction: Transaction) {

    }
}

export default Wallet;
