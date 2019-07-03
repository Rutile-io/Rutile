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
import getAllBlocksStream from './core/dag/lib/transaction/getAllBlocksStream';
import Block from './models/Block';
import Transaction from './models/Transaction';
import createGenesisBlock from './core/dag/lib/transaction/createGenesisBlock';
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

    const block = new Rutile.Block({});

    const transaction = new Rutile.Transaction({
        to: hash,
        // data: '0x1A029399ed09375dc6b20050d242d1611af97ee4a6e93cad',
        // data: '0x9993021aed09375dc6b20050d242d1611af97ee4a6e93cad',
        data: '0x00000001',
        // data: '0x5d359fbde929cf2544363bdcee4a976515d5f97758ef476c000000000007a120',
        value: 1,
        nonce: wallet.account.transactionIndex + 1,
    });

    transaction.sign(wallet.keyPair);

    block.addTransactions([transaction]);


    // const result = await transaction.execute();

    // transaction.sign(wallet.keyPair);
    // transaction.proofOfWork();

    // try {
    //     await validateTransaction(transaction);
    //     await applyTransaction(transaction);
    // } catch (err) {
    //     console.error(err);
    // }

    rutile.sendBlock(block);
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

    transaction.sign(wallet.keyPair);

    const block = new Rutile.Block({});
    block.addTransactions([transaction]);

    const results = await block.execute();
    const result = await rutile.sendBlock(block);
    console.log('[WASM] result -> ', results);
}

async function deployEvmContract() {
    const contractCode = '0x608060405234801561001057600080fd5b5061013f806100206000396000f300608060405260043610610041576000357c0100000000000000000000000000000000000000000000000000000000900463ffffffff168063942ae0a714610046575b600080fd5b34801561005257600080fd5b5061005b6100d6565b6040518080602001828103825283818151815260200191508051906020019080838360005b8381101561009b578082015181840152602081019050610080565b50505050905090810190601f1680156100c85780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b60606040805190810160405280600a81526020017f68656c6c6f576f726c64000000000000000000000000000000000000000000008152509050905600a165627a7a72305820e1bfe6aaae737431bec307d10cb17276c39ad7accd9736d2bf0ee24a49dc92e90029';
    const binary = Uint8Array.from(hexStringToBuffer(contractCode));

    let hash = await rutile.deploy(binary);
    hash = stringToHex(hash);

    const transaction = new Rutile.Transaction({
        // Sending to no one means we want to create a contract
        to: null,
        gasPrice: 1,
        data: hash,
    });

    transaction.sign(wallet.keyPair);

    const block = new Rutile.Block({});
    block.addTransactions([transaction]);

    const results = await block.execute();
    const result = await rutile.sendBlock(block);
    console.log('[EVM] result -> ', results);
}

async function testExecution() {
    console.log('Executing...');
    const block = new Block({});
    const tx = new Transaction({
        to: '0x0000000000000000000000000000000000000001',
        gasPrice: 1,
        data: '0x00000001',
        value: '32',
    });

    tx.sign(wallet.keyPair);

    block.addTransactions([tx]);
    const results = await block.execute();

    console.log('[] results -> ', results);
}

async function run() {
    applyArgv();
    let db = startDatabase();
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

        deployContract();

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
