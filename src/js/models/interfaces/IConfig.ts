import { IpfsConfig } from "../../services/wrappers/Ipfs";

enum NodeType {
    FULL = 'FULL',
    LIGHT = 'LIGHT',
};

export {
    NodeType
};

interface GenesisConfig {
    // transaction: {
    //     to: string;
    //     timestamp: number;
    //     value: string;
    // };

    alloc: {
        [address: string]: {
            balance: string;
        };
    };

    config: {
        /**
         * This is a value that is constant in the Rutile public network
         * but can be edited to create test networks/private networks.
         *
         * @type {string}
         */
        chainId: number;
    };
}

interface IConfig {
    nodeId: string;
    nodeType: NodeType;
    vmUrl: string;
    nodesListUrl: string;
    port: number;
    iceServers: RTCIceServer[];
    ipfs: IpfsConfig;
    databaseName: string;
    difficulty: number;
    genesis: GenesisConfig;
    privateKey: string;
    maximumNodes: number;
}

export default IConfig;
