import Transaction from '../../models/Transaction';
import getConfig from '../../Configuration';
import { Wallet } from '../../models/Wallet';

const ethers = require('ethers');

const WALLET_LOCATION = 'wallet_storage';
const providers = ethers.providers;

class EthereumWallet implements Wallet {
    ethersWalletInstance: any = null;

    constructor(privateKey: string) {
        const provider = getConfig('provider');

        this.ethersWalletInstance = new ethers.Wallet(privateKey, provider);
    }

    static getFromStorage(): EthereumWallet {
        const privateKey = localStorage.getItem(WALLET_LOCATION);

        if (!privateKey) {
            return EthereumWallet.create();
        } 

        return new EthereumWallet(privateKey);
    }

    static create(): EthereumWallet {
        const ethersWallet = ethers.Wallet.createRandom();
        
        localStorage.setItem(WALLET_LOCATION, ethersWallet.privateKey);

        return new EthereumWallet(ethersWallet.privateKey);
    }

    async getBalance(): Promise<string> {
        const balance = await this.ethersWalletInstance.getBalance();

        return balance;
    }

    async sign(transaction: Transaction) {
        
    }
}

export default EthereumWallet;
