import { IpfsConfig } from "./services/wrappers/Ipfs";

const uuid = require('uuid/v4');
const ethers = require('ethers');

const NODE_ID = `${uuid()}-${uuid()}-${uuid()}`;

interface Config {
    genesis: boolean,
    nodeId: string,
    provider: any,
    fileDatabaseAddress: string,
    connectionServerUrl: string,
    nodesListUrl: string,
    port: number,
    iceServers: RTCIceServer[],
    isGenesisNode: boolean,
    maximumNodes: number,
    maximumNodeAskConnectTime: number,
    timeoutBeforeCleanup: number,
    ipfs: IpfsConfig,
    difficulty: number,
}

const config: Config = {
    genesis: false,
    nodeId: NODE_ID,
    provider: new ethers.providers.InfuraProvider(ethers.providers.networks.ropsten),
    fileDatabaseAddress: '0xf050e54d2b50c055c9919a4b856a195221d3db71',
    connectionServerUrl: 'localhost:1337',
    nodesListUrl: 'http://localhost:1234/RutileNodes.json',
    port: 1337,
    iceServers: [
        { urls: 'stun:stun.stunprotocol.org:3478' },
        { urls: 'stun:stun.l.google.com:19302' }
    ],
    isGenesisNode: true,
    maximumNodes: 1,
    maximumNodeAskConnectTime: 3000,
    timeoutBeforeCleanup: 30000,
    ipfs: {
        host: 'ipfs.infura.io',
        port: 5001,
        protocol: 'https',
    },
    difficulty: 3,
}

export const configuration = config;

export default function getConfig(key: string): any {
    return config[key];
}

export function setConfig(key: string, value: any) {
    config[key] = value;
}
