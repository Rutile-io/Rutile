import KeyPair from './KeyPair';
import Account from './Account';

/**
 * Currently we replace our own wallet implementation with the one from Ethereum
 * This makes currently development easyer and focus more on the transaction part.
 *
 * @class Wallet
 */
class Wallet {
    privateKey: string;
    keyPair: KeyPair;
    account: Account;
    address: string;

    /**
     * Creates an instance of Wallet.
     *
     * @param {string} privateKey
     * @memberof Wallet
     */
    constructor(privateKey: string) {
        this.privateKey = privateKey;
        this.keyPair = new KeyPair(privateKey);
        this.address = KeyPair.computeAddress(this.keyPair.publicKey);
    }
}

export default Wallet;
