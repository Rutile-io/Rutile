const IPFS = require('ipfs-mini');

export interface IpfsConfig {
    host: string,
    port: number,
    protocol: string,
}

let ipfsInstance: Ipfs = null;

class Ipfs {
    ipfsInstance: any = null;

    constructor(config: IpfsConfig) {
        this.ipfsInstance = new IPFS(config);
    }

    static getInstance(config: IpfsConfig): Ipfs {
        ipfsInstance = ipfsInstance || new Ipfs(config);
        return ipfsInstance;
    }

    add(content: string): Promise<string> {
        return new Promise((resolve, reject) => {
            this.ipfsInstance.add(content, (error: any, result: string) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve(result);
            });
        });
    }

    cat(pathOrHash: string) : Promise<string> {
        return new Promise((resolve, reject) => {
            this.ipfsInstance.cat(pathOrHash, (error: any, result: string) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve(result);
            });
        });
    }
}

export default Ipfs;