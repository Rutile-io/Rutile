import Rutile from './Rutile';
import { applyArgv, configuration } from './Configuration';
import isNodeJs from './services/isNodeJs';
import Wallet from './models/Wallet';
import { startDatabase, databaseCreate, createOrUpdate, databaseFind } from './services/DatabaseService';
import Account from './models/Account';
import * as Logger from 'js-logger';
import getTransactionCumulativeWeights from './core/dag/lib/services/CumulativeWeightService';
import { stringToHex, hexStringToBuffer } from './utils/hexUtils';
import stringToByteArray from './utils/stringToByteArray';
import keccak256 from './utils/keccak256';
import { toHex } from './core/rvm/utils/hexUtils';
import execute from './core/rvm/execute';
import MerkleTree from './models/MerkleTree';
import PouchDbLevelDbMapping from './models/PouchDbLevelDbMapping';
import Block from './models/Block';
import Transaction from './models/Transaction';
import {startIpfsClient} from './services/IpfsService';
import createGenesisBlock from './core/dag/lib/transaction/createGenesisTransaction';
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

    const results = await transaction.execute();
    const result = await rutile.sendTransaction(transaction, wallet.keyPair);
    console.log('[WASM] result -> ', results);
}

async function run() {
    applyArgv();
    await startIpfsClient();
    let db = await startDatabase();
    let mapping = new PouchDbLevelDbMapping(db);

    wallet = new Wallet('10DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DE');
    account = await wallet.getAccountInfo();

    // testExecution();

    // Testing..
    if (isNodeJs()) {
        rutile = new Rutile();

        Logger.debug('My address is -> ', account.address, ' with balance -> ', account.balance);

        try {
            await rutile.start();
        } catch (e) {
            console.error('Oh well', e);
        }

        // deployContract();

        await rutile.dag.takeSnapshot(1);

        // setInterval(() => {
        //     sendDummyTransaction();
        // }, 10000);

        rutile.dag.networkController.network.on('peerConnected', () => {
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
