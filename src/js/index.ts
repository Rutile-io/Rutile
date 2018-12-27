import Rutile from './Rutile';
// import createLamdaFromFile from './services/createLamdaFromFile';
import { setConfig } from './Configuration';
import * as fs from 'fs';
import isNodeJs from './services/isNodeJs';
import Wallet from './models/Wallet';
import RutileContext from './models/RutileContext';
// const Logger = require('js-logger');

// const metering = require('wasm-metering');

// Logger.useDefaults();

async function run() {
    const wallet = Wallet.createRandom();

    // Testing..
    if (isNodeJs()) {
        const rutile = new Rutile();
        rutile.start();



        const file = fs.readFileSync('./examples/hello-world/add.wasm');
        const fileArrayBuffer = new Uint8Array(file);

        const lamda = new Rutile.Lamda(fileArrayBuffer);

        const hash = 'QmaRRwro76P2vgjpU8RJaxtuEKiEQg9ddBVHwgeYGiVewk'; //await rutile.deploy(lamda);
        console.log('[] hash -> ', hash);
        const transaction = new Rutile.Transaction({
            to: hash,
            data: [
                'add',
                1,
                9504,
            ],
        });

        const result = await transaction.execute();
        transaction.mine();

        console.log('[] result -> ', result);
    }
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
