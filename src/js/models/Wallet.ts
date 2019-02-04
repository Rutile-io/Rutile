import { randomBytes } from 'crypto';
import * as ethers from 'ethers';
import KeyPair from './KeyPair';
import Account from './Account';

const WALLET_STORAGE_KEY = 'r_wallet';

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

    constructor(privateKey: string) {
        this.privateKey = privateKey;
        this.keyPair = new KeyPair(privateKey);
    }

    async getAccountInfo() {
        this.account = await Account.findOrCreate(KeyPair.computeAddress(this.keyPair.publicKey));
        return this.account;
    }

    saveToLocalStorage() {
        if (!localStorage) {
            throw new Error('Local storage must be available');
        }

        localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(this));
    }

    static createRandom() {
        const randomWallet = ethers.Wallet.createRandom();

        const privateKey = randomWallet.privateKey.substring(2);
        return new Wallet(privateKey);
    }

    static fromStorage(): Wallet {
        if (!localStorage) {
            throw new Error('Local storage must be available');
        }

        const wallet = localStorage.getItem(WALLET_STORAGE_KEY);


        if (wallet) {
            const walletParsed = JSON.parse(wallet);
            return new Wallet(walletParsed.privateKey);
        }

        return null;
    }
}

export default Wallet;
