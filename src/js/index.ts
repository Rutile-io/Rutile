import Rutile from './Rutile';
import { applyArgv, configuration } from './Configuration';
import isNodeJs from './services/isNodeJs';
import * as Logger from 'js-logger';
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

    const wallet = new Wallet(configuration.privateKey);
    Logger.info(`🖥 Rutile is booting up with address ${wallet.address}`);

    const rutile = new Rutile();

    try {
        await rutile.start();
    } catch (e) {
        Logger.error(`⛔️ There was a problem while trying to run Rutile `, e);
    }
}

run();

export default Rutile;
