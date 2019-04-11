import Rutile from './Rutile';
import { applyArgv } from './Configuration';
import isNodeJs from './services/isNodeJs';
import Wallet from './models/Wallet';
import { startDatabase } from './services/DatabaseService';
// import RutileContext from './models/RutileContext';
// import * as fs from 'fs';
import { validateTransaction, applyTransaction } from './services/TransactionService';

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

    const wallet = new Wallet('C0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DE');
    await wallet.getAccountInfo();

    // Testing..
    if (isNodeJs() || true) {
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
        // const file = fs.readFileSync('/Volumes/Mac Space/Workspace/Rutile/EVM.wasm/build/untouched.wasm');
        // const file = fs.readFileSync('/Users/franklinwaller/Projects/RustWASM/wrc20/pkg/wrc20_bg.wasm');
        // const file = fs.readFileSync('/Users/franklinwaller/Desktop/EVM.wasm-master/build/ewasm_token.wasm');
        // const wasm = new Uint8Array(file);
        const hash = 'QmW7E36huBmRzgd2meSk57tgWvtgN41PYv5JAZbMJrqo1Z'; // await rutile.deploy(wasm);

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

        transaction.sign(wallet.keyPair);
        transaction.proofOfWork();

        try {
            await validateTransaction(transaction);
            await applyTransaction(transaction);
        } catch (err) {
            console.error(err);
        }

        rutile.sendTransaction(transaction);
    }
}

run();

// For the browser
if (!isNodeJs()) {
    window['Rutile'] = Rutile;
}

export default Rutile;
