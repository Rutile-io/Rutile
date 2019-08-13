import isNodeJs from './isNodeJs';
import * as Logger from 'js-logger';

let node: any = null;

/**
 * Starts the database
 *
 * @export
 */
export async function startIpfsClient() {
    return new Promise(async (resolve, reject) => {
        if (isNodeJs()) {
            try {
                await startIpfsDaemon();
                resolve();
              } catch (error) {
                console.error('Node failed to start!', error)
                reject(error);
              }
        } else {
            const IPFS = require('ipfs-mini');
            node = new IPFS({ host: 'localhost', port: 4002, protocol: 'https' });
        }
    });
}

function startIpfsDaemon() {
    return new Promise((resolve, reject) => {
        const IpfsFactory = __non_webpack_require__('ipfsd-ctl');

        IpfsFactory.create({ type: 'go' }).spawn({
            start:false,
            defaultAddrs: true,
        }, function (err: any, ipfsd: any) {
            if (err) {
                return reject(err);
            }

            ipfsd.start((err: any) => {
                if (err) {
                    Logger.error('Ipfs could not start: ' + err);
                    return reject(err);
                }

                Logger.info('Ipfs endpoint is running')

                resolve();
            })
        })
    });
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
