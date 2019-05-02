import { IpfsConfig } from "../../services/wrappers/Ipfs";
import Transaction from "../Transaction";

interface GenesisConfig {
    transaction: {
        to: string;
        timestamp: number;
        value: number;
    };

    alloc: {
        [address: string]: {
            balance: string;
        }
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
    nodeId: string,
    vmUrl: string,
    nodesListUrl: string,
    port: number,
    iceServers: RTCIceServer[],
    ipfs: IpfsConfig,
    databaseName: string,
    difficulty: number,
    genesis: GenesisConfig,
}

export default IConfig;
