import { IpfsConfig } from "../../services/wrappers/Ipfs";
import Transaction from "../Transaction";

interface GenesisConfig {
    transaction: {
        to: string;
        id: string;
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
    provider: any,
    fileDatabaseAddress: string,
    connectionServerUrl: string,
    nodesListUrl: string,
    port: number,
    iceServers: RTCIceServer[],
    maximumNodes: number,
    maximumNodeAskConnectTime: number,
    timeoutBeforeCleanup: number,
    ipfs: IpfsConfig,
    difficulty: number,
    genesis: GenesisConfig,
}

export default IConfig;
