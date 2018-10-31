const IPFS = require('ipfs-mini');

export interface IpfsConfig {
    host: string,
    port: number,
    protocol: string,
}

class Ipfs {
    ipfsInstance: any = null;

    constructor(config: IpfsConfig) {
        this.ipfsInstance = new IPFS(config);
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