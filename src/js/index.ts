import Rutile from './Rutile';
import { applyArgv, configuration } from './Configuration';
import isNodeJs from './services/isNodeJs';
import Wallet from './models/Wallet';
import { startDatabase, databaseCreate, createOrUpdate } from './services/DatabaseService';
import Account from './models/Account';
import * as Logger from 'js-logger';
import getTransactionCumulativeWeights from './core/dag/lib/services/CumulativeWeightService';
import { stringToHex } from './utils/hexUtils';
// import RutileContext from './models/RutileContext';
// import * as fs from 'fs';
// import { validateTransaction, applyTransaction } from './services/_TransactionService';

Logger.setLevel(Logger.TRACE);
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

async function sendDummyTransaction () {
    wallet = new Wallet(configuration.privateKey);
    account = await wallet.getAccountInfo();

    const myBalance = await rutile.getAccountBalance(account.address);

    console.log('My address is -> ', account.address, ' with balance -> ', myBalance);

    // if (account.balance < 10) {
    //     Logger.debug('Transaction not possible, amount is lower than 10');
    //     return;
    // }

// const file = fs.readFileSync('./examples/wrc20/wrc20-non-debug.wasm');
    // require('/Users/franklinwaller/Desktop/EVM.wasm-master/build/untouched.wasm');
    // const file = fs.readFileSync('/Volumes/Mac Space/Workspace/Rutile/EVM.wasm/build/untouched.wasm');
    // const file = fs.readFileSync('/Users/franklinwaller/Projects/RustWASM/wrc20/pkg/wrc20_bg.wasm');
    // const file = fs.readFileSync('/Users/franklinwaller/Desktop/EVM.wasm-master/build/ewasm_token.wasm');
    // const wasm = new Uint8Array(file);
    const hash = 'QmW7E36huBmRzgd2meSk57tgWvtgN41PYv5JAZbMJrqo1Z'; //await rutile.deploy(wasm);

    console.log('[WASM] hash -> ', hash);

    const transaction = new Rutile.Transaction({
        to: hash,
        // data: '0x1A029399ed09375dc6b20050d242d1611af97ee4a6e93cad',
        // data: '0x9993021aed09375dc6b20050d242d1611af97ee4a6e93cad',
        data: '0x00000001',
        // data: '0x5d359fbde929cf2544363bdcee4a976515d5f97758ef476c000000000007a120',
        value: 0,
        transIndex: wallet.account.transactionIndex + 1,
    });

    const result = await transaction.execute();

    // transaction.sign(wallet.keyPair);
    // transaction.proofOfWork();

    // try {
    //     await validateTransaction(transaction);
    //     await applyTransaction(transaction);
    // } catch (err) {
    //     console.error(err);
    // }

    rutile.sendTransaction(transaction, wallet.keyPair);
}

async function deployContract() {
    // Deploy a contract to IPFS
    const fs = __non_webpack_require__('fs');
    const file = fs.readFileSync('/Volumes/Mac Space/Workspace/Rutile/EVM.wasm/build/untouched.wasm');
    const wasm = new Uint8Array(file);
    let hash = await rutile.deploy(wasm);
    hash = stringToHex(hash);

    const transaction = new Rutile.Transaction({
        // Sending to no one means we want to create a contract
        to: null,
        gasPrice: 1,
        data: hash,
    });

    // const result = await transaction.execute();

    // console.log('[] result -> ', result);

    const result = await rutile.sendTransaction(transaction, wallet.keyPair);
    console.log('[] result -> ', result);
}

async function run() {
    applyArgv();
    startDatabase();

    wallet = new Wallet('10DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DE');
    account = await wallet.getAccountInfo();

    // Testing..
    if (isNodeJs()) {
        rutile = new Rutile();

        Logger.debug('My address is -> ', account.address, ' with balance -> ', account.balance);

        try {
            await rutile.start();
        } catch (e) {
            console.error('Oh well', e);
        }

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
