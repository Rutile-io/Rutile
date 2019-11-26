import Rutile from './Rutile';
import { applyArgv, configuration } from './Configuration';
import isNodeJs from './services/isNodeJs';
import { startDatabase } from './services/DatabaseService';
import * as Logger from 'js-logger';
import { startIpfsClient } from './services/IpfsService';
import Wallet from './models/Wallet';
import { createWorker } from './core/rvm/utils/workerUtils';
const BN = require('bn.js');

Logger.setLevel(Logger.DEBUG);
const loggerHandler = Logger.createDefaultHandler({
    formatter: function(message, context) {
        message.unshift(`[${context.level.name.toLowerCase()}]:`);
        message.unshift(new Date().toLocaleString());
    }
});

Logger.setHandler(loggerHandler);

async function run() {
    applyArgv();

    await createWorker(configuration.vmUrl);

    const wallet = new Wallet(configuration.privateKey);
    Logger.info(`🖥 Rutile is booting up with address ${wallet.address}`);

    // Testing..
    if (isNodeJs()) {
        const rutile = new Rutile();

        try {
            await rutile.start();
        } catch (e) {
            Logger.error(`⛔️ Rutile could not be run `, e);
            console.error('Oh well', e);
        }
    }
}

run();

// For the browser
if (!isNodeJs()) {
    window['Rutile'] = Rutile;
}

export default Rutile;
