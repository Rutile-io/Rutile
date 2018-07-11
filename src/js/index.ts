import Ipfs from "./services/wrappers/Ipfs";
import Transaction from "./models/Transaction";
import FileService from "./services/FileService";
import getConfig from "./Configuration";
import { Wallet, WalletConstructor } from "./models/Wallet";

const ipfs = new Ipfs({
    host: 'ipfs.infura.io',
    port: 5001,
    protocol: 'https',
});

async function run() {
    const walletProvider: WalletConstructor = getConfig('walletProvider');
    const wallet = walletProvider.getFromStorage();

    const walletBalance = await wallet.getBalance();

    console.log(walletBalance);
    
}

run();

// const IPFS = require('ipfs-mini');
// const ipfs = new IPFS({ host: 'ipfs.infura.io', port: 5001, protocol: 'https' });

// ipfs.add('HELLO WORLD BS', (error, result) => {
//     console.log('[ADD] :: result -> ', result, error);
// });

// ipfs.cat('QmNt6Mn5wB82N81tYSgbexrfH9PUfcFH6djEa548QCFzU4', (error, result) => {
//     console.log('[CAT] :: result -> ', result, error);
// });

// // Setup a node in this instance..
// const node = new Node();
// node.connect();

// console.log(node);

// // Execute a program
// const program = new Program('HelloWorld');
// const executable = new Executable(() => {
//     postMessage(JSON.stringify({
//         type: 'success',
//         value: 'TEST',
//     }));
// });

// program.addExecutable(executable);

// program.execAll().then((results) => {
//     console.log(results);
// });
