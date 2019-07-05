import IConfig, { NodeType } from "./models/interfaces/IConfig";
import getArguments from "./utils/getArguments";

const uuid = require('uuid/v4');

const NODE_ID = `${uuid()}-${uuid()}-${uuid()}`;

const config: IConfig = {
    nodeId: NODE_ID,
    nodeType: NodeType.FULL,
    // nodesListUrl: 'http://localhost:8903/',
    nodesListUrl: 'http://localhost:9001/examples/network-file/RutileNodes.json',
    maximumNodes: 5,
    vmUrl: './build/vm.js',
    port: 1337,

    // Private key is used for milestone generation.
    privateKey: '10DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DE',
    iceServers: [
        { urls: 'stun:stun.stunprotocol.org:3478' },
        { urls: 'stun:stun.l.google.com:19302' }
    ],
    // ipfs: {
    //     host: 'ipfs.infura.io',
    //     port: 5001,
    //     protocol: 'https',
    // },

    ipfs: {
        host: '127.0.0.1',
        port: 5001,
        protocol: 'http',
    },
    difficulty: 3,
    databaseName: 'db_rutile',
    genesis: {
        alloc: {
            '0x53ae893e4b22d707943299a8d0c844df0e3d5557': {
                balance: '150000000000000000000000000',
            },
        },

        // Make sure the stakes and alloc are balanced. Any tokens that are set in stakes are minted with
        // the total supply. So if i minted 150000 in the alloc part and added a address at stake for 64
        // then my total supply would be 150064.
        stakes: {
            '0x53ae893e4b22d707943299a8d0c844df0e3d5557': {
                value: '32',
            },
        },

        // transaction: {
        //     // Address is a test address.
        //     to: '0x53ae893e4b22d707943299a8d0c844df0e3d5557',
        //     timestamp: 0,
        //     value: '150000000000000000000000000',
        // },
        config: {
            chainId: 1,
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
