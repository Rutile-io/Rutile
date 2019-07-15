import isNodeJs from './isNodeJs';
import { configuration } from '../Configuration';
import { promises } from 'fs';
import { resolve } from 'url';
let node:any = null;

/**
 * Starts the database
 *
 * @export
 */
export async function startIpfsClient() {
    return new Promise(function(resolve, reject) {
        if (isNodeJs()) {
            try {
                startIpfsDaemon();
                resolve();
              } catch (error) {
                console.error('Node failed to start!', error)
                reject();
              }
        } else {
            const IPFS = require('ipfs-mini');
            node = new IPFS({ host: 'localhost', port: 4002, protocol: 'https' });
        }
    });
}

function startIpfsDaemon(){    
    const IPFSFactory = __non_webpack_require__('ipfsd-ctl')
    IPFSFactory.create({ type: 'go' })
    .spawn({start:false, defaultAddrs: true}, function (err:any, ipfsd:any) {
        if (err) { throw err }
        
        ipfsd.start((err:any) => {
            if (err) { console.log(err); throw err }
          
            console.log('Ipfs endpoint is running')
          })        
    })
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