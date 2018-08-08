import EthereumWallet from "./blockchains/Ethereum/EthereumWallet";
import { WalletConstructor } from "./models/Wallet";
const uuid = require('uuid/v4');

const ethers = require('ethers');
const env = process.env.NODE_ENV;

const NODE_ID = `${uuid()}-${uuid()}-${uuid()}`;

interface Config {
    nodeId: string,
    walletProvider: WalletConstructor,
    provider: any,
    fileDatabaseAddress: string,
    connectionServerUrl: string,
    port: number,
    iceServers: RTCIceServer[],
    isGenesisNode: boolean,
    maximumNodes: number,
    maximumNodeAskConnectTime: number,
    timeoutBeforeCleanup: number,
}

const developmentConfig: Config = {
    nodeId: NODE_ID,
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
    maximumNodes: 8,
    maximumNodeAskConnectTime: 3000,
    timeoutBeforeCleanup: 30000,
}

const productionConfig: Config = {
    nodeId: NODE_ID,
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
    maximumNodes: 8,
    maximumNodeAskConnectTime: 3000,
    timeoutBeforeCleanup: 30000,
}

const config = {
    development: developmentConfig,
    production: productionConfig,
}

let envConfig: Config = config['production'];

if (env) {
    envConfig = config[env];
}

export const configuration = envConfig;

console.log('[Config] configuration.nodeId -> ', configuration.nodeId);

export default function getConfig(key: string): any {
    if (!env) {
        return config['production'][key];
    }

    return config[env][key];
}