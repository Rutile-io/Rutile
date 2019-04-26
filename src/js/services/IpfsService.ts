import isNodeJs from './isNodeJs';
import { configuration } from '../Configuration';
const IPFS = require('ipfs');
let node = new IPFS({start: false});

/**
 * Starts the database
 *
 * @export
 */
export function startIpfsClient() {
 
    if (isNodeJs()) {
        try {
            node.start()
            console.log('Node started!')
          } catch (error) {
            console.error('Node failed to start!', error)
          }
    } else {
        // const leveljs = require('level-js');
        // lvlDown = leveljs(configuration.databaseName);
    }
    return node;
}