import { IpfsConfig } from "../../services/wrappers/Ipfs";
import Transaction from "../Transaction";

interface GenesisConfig {
    transaction: {
        to: string;
        timestamp: number;
        value: number;
    };
    config: {
        /**
         * This is a value that is constant in the Rutile public network
         * but can be edited to create test networks/private networks.
         *
         * @type {string}
         */
        nonce: string;
    }
}

interface IConfig {
    nodeId: string,
    connectionServerUrl: string,
    nodesListUrl: string,
    port: number,
    iceServers: RTCIceServer[],
    maximumNodes: number,
    maximumNodeAskConnectTime: number,
    timeoutBeforeCleanup: number,
    ipfs: IpfsConfig,
    databaseName: string,
    difficulty: number,
    genesis: GenesisConfig,
}

export default IConfig;
