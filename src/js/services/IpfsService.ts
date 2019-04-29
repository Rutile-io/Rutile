import isNodeJs from './isNodeJs';
import { configuration } from '../Configuration';

/**
 * Starts the database
 *
 * @export
 */
export async function startIpfsClient() {
    return new Promise(() => {
        if (isNodeJs()) {
            try {
                const IPFS = __non_webpack_require__('ipfs');
                let node = new IPFS({start: true});

                node.on('ready', () => {
                    console.log('Node started!')
                });
              } catch (error) {
                console.error('Node failed to start!', error)
              }
        } else {
            // const leveljs = require('level-js');
            // lvlDown = leveljs(configuration.databaseName);
        }
    });
}
