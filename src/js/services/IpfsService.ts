import isNodeJs from './isNodeJs';
import * as Logger from 'js-logger';

let node: any = null;

/**
 * Start a IPFS Client
 *
 * @export
 */
export async function startIpfsClient() {
    if (isNodeJs()) {
        await startIpfsDaemon();
    } else {
        const IPFS = require('ipfs-mini');
        node = new IPFS({ host: 'localhost', port: 4002, protocol: 'https' });
    }
}

/**
 * Starts a IPFS Daemon up
 *
 */
async function startIpfsDaemon() {
    const IpfsFactory = __non_webpack_require__('ipfsd-ctl');
    const ipfs = IpfsFactory.create({ type: 'go' });
    const ipfsSpawnedNode = await ipfs.spawn({
        start: false,
        defaultAddrs: true,
    });

    await ipfsSpawnedNode.start();
}

export async function addFileFromPath(){
    return new Promise(() => {
        if (isNodeJs()) {
            try {
                console.log('Starting file upload...');
                node.addFromFs('/home/jurgen/test-upload', (err:any, result:any) => {
                    if (err) { throw err }
                    console.log(result)
                  })
              } catch (error) {
                console.error('Failed to add file!', error)
              }
        } else {
            // IPFS-mini addfilefrompath
            // node.add()
        }
    });
}
