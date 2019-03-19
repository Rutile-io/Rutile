import isNodeJs from "./services/isNodeJs";
import IConfig from "./models/interfaces/IConfig";
import getArguments from "./utils/getArguments";

const uuid = require('uuid/v4');
const ethers = require('ethers');

const NODE_ID = `${uuid()}-${uuid()}-${uuid()}`;

const config: IConfig = {
    nodeId: NODE_ID,
    provider: new ethers.providers.InfuraProvider(ethers.providers.networks.ropsten),
    fileDatabaseAddress: '0xf050e54d2b50c055c9919a4b856a195221d3db71',
    connectionServerUrl: 'localhost:1337',
    nodesListUrl: 'http://localhost:8903/',
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
    couchdbUrl: 'http://127.0.0.1:5984/',
    databaseName: 'db_rutile',
    genesis: {
        transaction: {
            // Address is a test address.
            to: '0x6655feed4d214c261e0a6b554395596f1f1476a77d999560e5a8df9b8a1a3515',
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

/**
 * Applys arguments passed in the console
 *
 * @export
 */
export function applyArgv() {
    const args = getArguments(process.argv);

    Object.keys(args).forEach((key) => {
        config[key] = args[key];
    });
}
