import Rutile from './Rutile';
import { applyArgv, configuration, setConfig } from './Configuration';
import isNodeJs from './services/isNodeJs';
import Wallet from './models/Wallet';
import { startDatabase, databaseFind} from './services/DatabaseService';
import Account from './models/Account';
import * as Logger from 'js-logger';
import { stringToHex } from './utils/hexUtils';
import execute from './core/rvm/execute';
import PouchDbLevelDbMapping from './models/PouchDbLevelDbMapping';
import Transaction from './models/Transaction';
import {startIpfsClient} from './services/IpfsService';
import { CallKind } from './core/rvm/lib/CallMessage';
import Block from './models/Block';
const BN = require('bn.js');
// import RutileContext from './models/RutileContext';
// import * as fs from 'fs';
// import { validateTransaction, applyTransaction } from './services/_TransactionService';

Logger.setLevel(Logger.DEBUG);
const loggerHandler = Logger.createDefaultHandler({
    formatter: function(message, context) {
        message.unshift(`[${context.level.name.toLowerCase()}]:`);
        message.unshift(new Date().toLocaleString());
    }
});

Logger.setHandler(loggerHandler);

let wallet: Wallet;
let account: Account;
let rutile: Rutile;

function sleep(ms: number) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
}

async function deployContract() {
    // Deploy a contract to IPFS
    const fs = __non_webpack_require__('fs');
    const file = fs.readFileSync('/Volumes/Mac Space/Workspace/Rutile/InternalContracts/build/untouched-milestones.wasm');
    const wasm = new Uint8Array(file);
    let hash = await rutile.deploy(wasm);
    hash = stringToHex(hash);

    const transaction = new Rutile.Transaction({
        // Sending to no one means we want to create a contract
        to: null,
        gasPrice: 1,
        data: hash,
    });

    const result = await rutile.sendTransaction(transaction, wallet.keyPair);
    console.log('[WASM] result -> ', result);
}

async function sendTestTransaction() {
    const transaction = new Transaction({
        to: '0x63ae893e4b22d707943299a8d0c844df0e3d5557',
        value: '1',
        gasPrice: 1,
    });

    const result = await rutile.sendTransaction(transaction, wallet.keyPair);
    console.log('[SendTestTransaction] result -> ', result);
}

// async function playos() {
//     const fs = __non_webpack_require__('fs');
//     const file = fs.readFileSync('/Volumes/Mac Space/Workspace/OSS-PlayOS/PlayOS/build/optimized.wasm');
//     const wasm = new Uint8Array(file);
//     console.log('Execute');

//     const result = await execute({
//         depth: 1000,
//         destination: '0x123',
//         flags: 1,
//         gas: 10000,
//         inputData: new Uint8Array(0),
//         inputRoot: null,
//         inputSize: 2,
//         kind: CallKind.Call,
//         sender: '0x0',
//         value: new BN(0),
//     }, wasm);

//     console.log('[] result -> ', result);
// }

async function run() {
    applyArgv();
    let db = await startDatabase();
    let mapping = new PouchDbLevelDbMapping(db);

    try {
        await startIpfsClient();
    } catch (error) {
        Logger.error(`📦 IPFS was not able to startup..`);
    }

    wallet = new Wallet('C0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DE');
    account = await wallet.getAccountInfo();

    // playos();

    // testExecution();

    // Testing..
    if (isNodeJs()) {

        rutile = new Rutile();

        Logger.debug('Starting with address ', account.address, ' with balance ', account.balance.toString());

        try {
            await rutile.start();
        } catch (e) {
            console.error('Oh well', e);
        }

        // deployContract();

        // setInterval(() => {
        //     sendTestTransaction();
        // }, 6500);

        rutile.chain.networkController.network.on('peerConnected', () => {
            // deployContract();

        });

        setInterval(() => {
            // sendDummyTransaction();
        }, 20000);

        if (isNodeJs()) {
            // await sleep(10000);
        }

    }
}

run();

// For the browser
if (!isNodeJs()) {
    window['Rutile'] = Rutile;
}

export default Rutile;
