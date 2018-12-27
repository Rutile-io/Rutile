import { randomBytes } from 'crypto';
import * as ethers from 'ethers';
import KeyPair from './KeyPair';

/**
 * Currently we replace our own wallet implementation with the one from Ethereum
 * This makes currently development easyer and focus more on the transaction part.
 *
 * @class Wallet
 */
class Wallet {
    privateKey: string;
    keyPair: KeyPair;

    constructor(privateKey: string) {
        this.privateKey = privateKey;
        this.keyPair = new KeyPair(privateKey);
    }

    static createRandom() {
        const privateKey = ethers.Wallet.createRandom().privateKey;
        return new Wallet(privateKey);
    }
}

export default Wallet;
