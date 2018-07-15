import EthereumWallet from "./blockchains/Ethereum/EthereumWallet";
import { WalletConstructor } from "./models/Wallet";

const ethers = require('ethers');
const env = process.env.NODE_ENV;

interface Config {
    walletProvider: WalletConstructor,
    provider: any,
    fileDatabaseAddress: string,
    connectionServerUrl: string,
    port: number,
    iceServers: RTCIceServer[],
    isGenesisNode: boolean,
}

const developmentConfig: Config = {
    walletProvider: EthereumWallet,
    provider: new ethers.providers.InfuraProvider(ethers.providers.networks.ropsten),
    fileDatabaseAddress: '0xf050e54d2b50c055c9919a4b856a195221d3db71',
    connectionServerUrl: 'localhost:1337',
    port: 1337,
    iceServers: [
        { urls: 'stun:stun.stunprotocol.org:3478' },
        { urls: 'stun:stun.l.google.com:19302' }
    ],
    isGenesisNode: true,
}

const productionConfig: Config = {
    walletProvider: EthereumWallet,
    provider: new ethers.providers.InfuraProvider(ethers.providers.networks.ropsten),
    fileDatabaseAddress: '0xf050e54d2b50c055c9919a4b856a195221d3db71',
    connectionServerUrl: 'localhost:1337',
    port: 1337,
    iceServers: [
        { urls: 'stun:stun.stunprotocol.org:3478' },
        { urls: 'stun:stun.l.google.com:19302' }
    ],
    isGenesisNode: true,
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
