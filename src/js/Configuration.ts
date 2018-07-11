import EthereumWallet from "./blockchains/Ethereum/EthereumWallet";
import { WalletConstructor } from "./models/Wallet";

const ethers = require('ethers');
const env = process.env.NODE_ENV;

interface Config {
    walletProvider: WalletConstructor,
    provider: any,
    fileDatabaseAddress: string,
}

const developmentConfig: Config = {
    walletProvider: EthereumWallet,
    provider: new ethers.providers.InfuraProvider(ethers.providers.networks.ropsten),
    fileDatabaseAddress: '0xf050e54d2b50c055c9919a4b856a195221d3db71',
}

const productionConfig: Config = {
    walletProvider: EthereumWallet,
    provider: new ethers.providers.InfuraProvider(ethers.providers.networks.ropsten),
    fileDatabaseAddress: '0xf050e54d2b50c055c9919a4b856a195221d3db71',
}

const config = {
    development: developmentConfig,
    production: productionConfig,
}

export default function getConfig(key: string): any {
    if (!env) {
        return config['production'][key];
    }

    return config[env][key];
}