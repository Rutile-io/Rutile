import Rutile from './Rutile';
// import createLamdaFromFile from './services/createLamdaFromFile';
import { applyArgv } from './Configuration';
import isNodeJs from './services/isNodeJs';
import Wallet from './models/Wallet';
import { saveTransaction, startDatabase } from './services/DatabaseService';
// import RutileContext from './models/RutileContext';
// import * as fs from 'fs';
import { validateTransaction } from './services/TransactionService';
// const Logger = require('js-logger');

// const metering = require('wasm-metering');

// Logger.useDefaults();

function sleep(ms: number) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
}

async function run() {
    applyArgv();
    startDatabase();

    let wallet = null;
    if (!isNodeJs()) {
        wallet = Wallet.fromStorage();

        if (!wallet) {
            wallet = Wallet.createRandom();
            wallet.saveToLocalStorage();
        }
    } else {
        wallet = new Wallet('0123456789012345678901234567890123456789012345678901234567890123');
    }

    const ourAccount = await wallet.getAccountInfo();

    // Testing..
    // if (isNodeJs()) {
        const rutile = new Rutile();
        try {
            await rutile.start();
        } catch (e) {
            console.error('Oh well', e);
        }

        if (isNodeJs()) {
            // await sleep(10000);
        }
        // const file = fs.readFileSync('./examples/wrc20/wrc20-non-debug.wasm');
        // require('/Users/franklinwaller/Desktop/EVM.wasm-master/build/untouched.wasm');
        const file = fs.readFileSync('/Users/franklinwaller/Desktop/EVM.wasm-master/build/untouched.wasm');
        const fileArrayBuffer = new Uint8Array(file);

        const lamda = new Rutile.Lamda(fileArrayBuffer);

        const hash = await rutile.deploy(lamda);

        // const lamda = new Rutile.Lamda(fileArrayBuffer);

        const transaction = new Rutile.Transaction({
            to: hash,
            data: '9993021a',
            value: 0,
            transIndex: wallet.account.transactionIndex + 1,
        });

        // const transaction = new Rutile.Transaction({
        //     to: hash,
        //     data: [
        //         'add',
        //         1,
        //         '9504',
        //     ],
        //     value: 0,
        //     transIndex: wallet.account.transactionIndex + 1,
        // });

        // const result = await transaction.execute();

        // transaction.sign(wallet.keyPair);
        // transaction.proofOfWork();
        // await saveTransaction(transaction);
        // wallet.account.applyTransaction(transaction);

        // validateTransaction(transaction);
        // rutile.sendTransaction(transaction);
    // }
}

run();


// if (isNodeJs()) {
//     const yargs = require('yargs');
//     const rutile = new Rutile();

//     yargs.usage('$0 <cmd> [args]');

//     yargs.command('deploy [file]', 'Deploys an script to the Rutile network', (yarg: any) => {
//         yarg.positional('file', {
//             type: 'string',
//             describe: 'The lambda file you want to deploy',
//         });
//     }, async (argv: any) => {
//         if (!argv.file) {
//            throw new Error('Missing param file');
//         }

//         try {
//             Logger.info('Deploying to the Rutile network...');
//             const lamda = await createLamdaFromFile(argv.file);
//             const ipfsHash = await rutile.deploy(lamda);
//             Logger.info(`Deploy success: ${ipfsHash}`);
//         } catch (error) {
//             Logger.error('Could not deploy: ', error);
//         }
//     });

//     yargs.command('execute <hash> [args..]', 'Executes an script locally', (yarg: any) => {
//         yarg.positional('hash', {
//             type: 'string',
//             describe: 'The hash from IPFS that you want to execute',
//         });
//     }, async (argv: any) => {
//         if (!argv.hash) {
//             throw new Error('Missing param hash');
//         }

//         try {
//             const result = await rutile.execute(argv.hash, argv.args);

//             if (result !== undefined) {
//                 Logger.info(result);
//             }
//         } catch (error) {
//             Logger.error('Could not execute: ', error);
//         }
//     });

//     yargs.command('start', 'Starts the Rutile server and connects to the network', () => {}, async (argv: any) => {
//         try {
//             if (argv.port) {
//                 setConfig('port', argv.port);
//             }

//             if (argv.genesis) {
//                 setConfig('genesis', true);
//             }

//             await rutile.start();
//         } catch (error) {
//             Logger.error('Could not execute: ', error);
//         }
//     });


//     yargs.help();
//     yargs.argv;
// }


// For the browser
if (!isNodeJs()) {
    window['Rutile'] = Rutile;
}

export default Rutile;
