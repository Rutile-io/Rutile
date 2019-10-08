import IConfig, { NodeType } from "./models/interfaces/IConfig";
import getArguments from "./utils/getArguments";

const uuid = require('uuid/v4');

const NODE_ID = `${uuid()}-${uuid()}-${uuid()}`;

let configuration: IConfig = {
    nodeId: NODE_ID,
    nodeType: NodeType.FULL,
    // nodesListUrl: 'http://localhost:8903/',
    nodesListUrl: 'http://localhost:9001/examples/network-file/RutileNodes.json',
    maximumNodes: 5,
    vmUrl: './build/vm.js',
    port: 1337,

    // Private key is used for milestone generation.
    privateKey: 'C0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DE',
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
    block: {
        // The limit of gas inside a block
        blockGasLimit: 8000000,

        // The amount of time in ms that it takes before the next block round begins
        blockTime: 10000,

        // The beneficiary address for block rewards
        coinbaseAddress: '0x53ae893e4b22d707943299a8d0c844df0e3d5557',

        // The amount of reward per block.
        // NOTE: if you change this the blockchain creates a fork from other configuration
        // resulting in a different chain being created
        coinbaseAmount: '1000000000000000000',
    },
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
                value: '32000000000000000000',
            },
        },

        config: {
            // The chain unique identification, use this to create your own blockchain
            chainId: 868,
        }
    }
}

export { configuration };

export default function getConfig(key: string): any {
    return configuration[key];
}

export function setConfig(configOptions: IConfig) {
    configuration = {
        ...configuration,
        ...configOptions,
    };
}

/**
 * Applys arguments passed in the console
 *
 * @export
 */
export function applyArgv() {
    const args = getArguments(process.argv);

    Object.keys(args).forEach((key) => {
        configuration[key] = args[key];
    });
}
