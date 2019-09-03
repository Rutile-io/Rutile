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

async function run() {
    applyArgv();
    let db = await startDatabase();
    let mapping = new PouchDbLevelDbMapping(db);

    // const tx = Transaction.fromBuffer(Buffer.from('f86c808502540be4008252089442b904bca15eb96488912456c17475ce33e0d3cf881bc16d674ec800008025a065551c1b6a339c9d01e2fd141d604d8a5cabf967cdb9ff808b620dd7837d03a5a03fb94339e666a8552c35852a1f99f8cbd0a1f68659be38bd22802a237b5f8369', 'hex'));
    // const addresses = getAddressFromTransaction(tx);


    // // const valid = KeyPair.verifySignature('0x3d92063df59f5d4dfc86ee670c40543006ccbe6b245ca0c257a8a9c64e417816', {
    // //     r: tx.r,
    // //     s: tx.s,
    // //     v: tx.v,
    // // });

    // // tx.hash(false);

    // // console.log('[] valid -> ', valid, tx.hash(false), tx.hash(true));

    // return;
    // for (let index = 0; index < 100; index++) {
    //     try {
    //         const pub = ethUtil.ecrecover(
    //             Buffer.from(tx.hash(false), 'hex'),
    //             tx.v - index,
    //             tx.r,
    //             tx.s,
    //             configuration.genesis.config.chainId - index,
    //         );

    //         console.log('[] ethUtil -> ', ethUtil.pubToAddress(pub, false));
    //     } catch (err) {}
    // }

    // const pub = ethUtil.ecrecover(
    //     Buffer.from(tx.hash(false), 'hex'),
    //     tx.v + 1,
    //     tx.r,
    //     tx.s,
    //     configuration.genesis.config.chainId + 1,
    // );

    // console.log('[] ethUtil -> ', ethUtil.pubToAddress(pub, false));

    // console.log('[] addresses -> ', addresses);
    // console.log('[] pub -> ', KeyPair.computeAddress('0x' + pub.toString('hex')));

    // return;

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
