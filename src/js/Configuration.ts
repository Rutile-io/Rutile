import isNodeJs from "./services/isNodeJs";
import IConfig from "./models/interfaces/IConfig";
import getArguments from "./utils/getArguments";

const uuid = require('uuid/v4');
const ethers = require('ethers');

const NODE_ID = `${uuid()}-${uuid()}-${uuid()}`;

const config: IConfig = {
    nodeId: NODE_ID,
    connectionServerUrl: 'localhost:1337',
    nodesListUrl: 'http://localhost:8903/',
    vmUrl: './build/vm.js',
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
