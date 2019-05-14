import Rutile from './Rutile';
import { applyArgv, configuration } from './Configuration';
import isNodeJs from './services/isNodeJs';
import Wallet from './models/Wallet';
import { startDatabase, databaseCreate, createOrUpdate } from './services/DatabaseService';
import Account from './models/Account';
import * as Logger from 'js-logger';
import getTransactionCumulativeWeights from './core/dag/lib/services/CumulativeWeightService';
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

    console.log('My address is -> ', account.address, ' with balance -> ', account.balance);

    if (account.balance < 10) {
        Logger.debug('Transaction not possible, amount is lower than 10');
        return;
    }

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
        value: 10,
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

async function run() {
    applyArgv();
    startDatabase();

    wallet = new Wallet('10DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DE');
    account = await wallet.getAccountInfo();

    // Testing..
    if (isNodeJs()) {
        rutile = new Rutile();

        console.log('My address is -> ', account.address, ' with balance -> ', account.balance);

        try {
            await rutile.start();
        } catch (e) {
            console.error('Oh well', e);
        }

        setInterval(() => {
            sendDummyTransaction();
        }, 10000);

        rutile.dag.networkController.network.on('peerConnected', () => {
            // setInterval(() => {
            //     sendDummyTransaction();
            // }, 10000);
        });

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
