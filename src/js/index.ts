import Rutile from './Rutile';
import { applyArgv, configuration, setConfig } from './Configuration';
import isNodeJs from './services/isNodeJs';
import Wallet from './models/Wallet';
import { startDatabase, databaseFind} from './services/DatabaseService';
import Account from './models/Account';
import * as Logger from 'js-logger';
import { stringToHex, numberToHex } from './utils/hexUtils';
import execute from './core/rvm/execute';
import PouchDbLevelDbMapping from './models/PouchDbLevelDbMapping';
import Transaction from './models/Transaction';
import {startIpfsClient} from './services/IpfsService';
import { CallKind } from './core/rvm/lib/CallMessage';
import Block from './models/Block';
import keccak256, { rlpHash } from './utils/keccak256';
import { getAddressFromTransaction } from './core/chain/lib/services/TransactionService';
import KeyPair from './models/KeyPair';
import GlobalState from './models/GlobalState';
import stringToByteArray from './utils/stringToByteArray';
import { toHex } from './core/rvm/utils/hexUtils';
const BN = require('bn.js');
const ethUtil = require('ethereumjs-util');
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

async function evmRun() {
    const tx = new Transaction({
        to: '0x19275bc05330979be6c20f99c4954fd60c33163f',
        data: '0x942ae0a7',
        gasLimit: 8000000000000000,
    });

    tx.sign(wallet.keyPair);

    const latestBlock = await Block.getLatest();

    const block = new Block({
        number: latestBlock.number + 1,
        parent: latestBlock.id,
    });

    await block.addTransactions([tx]);
    const r = await block.execute();

    console.log('[] r -> ', r);
}

async function run() {

    Logger.info(`🖥 Rutile is booting up..`);
    applyArgv();
    let db = await startDatabase();

    wallet = new Wallet('C0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DE');

    const block = await Block.getLatest();
    const bin = `
        async function main() {
            rutile.log("Hello world");
            rutile.log("From here");

            await rutile.storageStore('Je', 'Test');

            const data = await rutile.storageLoad('Je');

            rutile.log('This will not be called data: ', data);

            rutile.log('Test1');
            await rutile.revert("Revert becuz");


            return 1444;
        }

        rutile.setApp(main);
    `;

    const b = stringToByteArray(bin);

    await execute({
        globalState: await GlobalState.create(block.stateRoot),
        callMessage: {
            depth: 1,
            destination: '0x',
            flags: 1,
            gas: 100000,
            inputData: new Uint8Array(),
            inputSize: 0,
            kind: CallKind.Call,
            sender: '0x0000',
            value: new BN(9),
        },
        bin: b,
    });

    return;

    try {
        Logger.info(`📦 Booting up IPFS node..`);
        await startIpfsClient();
        Logger.info(`📦 IPFS is running`);
    } catch (error) {
        Logger.error(`📦 IPFS was not able to startup`);
    }

    // Testing..
    if (isNodeJs()) {
        rutile = new Rutile();

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
