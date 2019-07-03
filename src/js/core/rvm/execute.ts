import * as Logger from 'js-logger';
import './context';
import Context from './context';
import { configuration } from '../../Configuration'
import { createWorker } from './utils/workerUtils';
import WorkerMessageController from './controller/WorkerMessageController';
import isWasmBinary from './lib/services/isWasmBinary';
import CallMessage from './lib/CallMessage';
import getSystemContract from '../../services/getSystemContract';
import Account from '../../models/Account';
import { hexStringToString } from '../../utils/hexUtils';
import Ipfs from '../../services/wrappers/Ipfs';
import stringToByteArray from '../../utils/stringToByteArray';

interface ExecuteSecureResults {
    gasUsed?: number;
    result: any;
}

/**
 * Executes code in a virtual machine
 * Supports both EVM and EWASM
 *
 * @export
 * @param {Transaction} transaction
 * @param {Uint8Array} binary
 * @returns
 */
export default async function execute(callMessage: CallMessage) {
    const ipfs = Ipfs.getInstance(configuration.ipfs);

    // It's possible that we are just calling a system contract
    let binary: Uint8Array = getSystemContract(callMessage.destination);

    // The address is not a system contract, we'll forward it to IPFS.
    if (!binary) {
        const account = await Account.findOrCreate(callMessage.destination);

        // It's possible that an account does not have any contract attached to it
        // This means we do not have to execute any functions but should just transfer value
        if (!account.codeHash || account.codeHash === '0x00') {
            // We should not however return null, we should have a default contract for wallets
            // this will also make it easyer for users to use wallets.
            return null;
        }

        const ipfsHash = hexStringToString(account.codeHash);
        try {
            const contents = await ipfs.cat(ipfsHash);
            binary = stringToByteArray(contents);
        } catch (error) {
            Logger.error(`Error while executing: ${error.message}`);
        }
    }

    if (!isWasmBinary(binary)) {
        throw new Error('Binary is not WASM code');
    }

    const worker = createWorker(configuration.vmUrl);

    // This is the physical context it contains all functions and data
    // needed to execute a smart contract. It lives on the main thread
    // since database calls and asynchronous calls cannot be done on the
    // worker thread.
    const context = new Context({
        fromAddress: callMessage.sender,
        toAddress: callMessage.destination,
        data: callMessage.inputData,
        value: callMessage.value,
        transactionDifficulty: configuration.difficulty
    }, callMessage);

    const controller = new WorkerMessageController(worker, context);
    const result = await controller.start(binary);

    return result;
}
