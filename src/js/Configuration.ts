import isNodeJs from "./services/isNodeJs";
import IConfig from "./models/interfaces/IConfig";

const uuid = require('uuid/v4');
const ethers = require('ethers');

const NODE_ID = `${uuid()}-${uuid()}-${uuid()}`;

const config: IConfig = {
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
    maximumNodes: 1,
    maximumNodeAskConnectTime: 3000,
    timeoutBeforeCleanup: 30000,
    ipfs: {
        host: 'ipfs.infura.io',
        port: 5001,
        protocol: 'https',
    },
    difficulty: 3,
    genesis: {
        transaction: {
            // Address is a test address.
            to: '$046655feed4d214c261e0a6b554395596f1f1476a77d999560e5a8df9b8a1a3515217e88dd05e938efdd71b2cce322bf01da96cd42087b236e8f5043157a9c068e',
            id: '00000000000000000000000000000000',
            timestamp: 0,
            value: 150000000,
        },
        config: {
            nonce: 'rutile-public-network',
        }
    }
}

// For testing purposes..

if (!isNodeJs()) {
    config.nodesListUrl = 'http://localhost:9001/examples/network-file/RutileNodes.json';
}

export const configuration = config;

export default function getConfig(key: string): any {
    return config[key];
}

export function setConfig(key: string, value: any) {
    config[key] = value;
}
