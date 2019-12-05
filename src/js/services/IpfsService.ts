import isNodeJs from './isNodeJs';
import Logger = require('js-logger');

let node: any = null;

/**
 * Start a IPFS Client
 *
 * @export
 */
export async function startIpfsClient() {
    return startIpfsDaemon();
}

/**
 * Starts a IPFS Daemon up
 *
 */
async function startIpfsDaemon() {
    const IpfsFactory = __non_webpack_require__('ipfsd-ctl');
    const ipfs = IpfsFactory.create({ type: 'go' });

    const ipfsConfig = {
        // start: true,
        // init: true,
        repoPath: './ipfs_repo',
        disposable: false,
        defaultAddrs: true,
    }

    // In production we want to keep our contracts and files.
    if (process.env.NODE_ENV === 'production') {
        ipfsConfig.disposable = false;
    }

    const ipfsSpawnedNode = await ipfs.spawn(ipfsConfig);
    await ipfsSpawnedNode.init();
    await ipfsSpawnedNode.start();

    Logger.info(`📦 API located at ${ipfsSpawnedNode.api.apiHost}:${ipfsSpawnedNode.api.apiPort}`);
    Logger.info(`📦 Gateway located at ${ipfsSpawnedNode.api.gatewayHost}:${ipfsSpawnedNode.api.gatewayPort}`);

    return ipfsSpawnedNode;
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
