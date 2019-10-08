import './context';
import Context, { Results } from './context';
import { configuration } from '../../Configuration'
import { createWorker } from './utils/workerUtils';
import WorkerMessageController from './controller/WorkerMessageController';
import isWasmBinary from './lib/services/isWasmBinary';
import Ipfs from '../../services/wrappers/Ipfs';
import { getContractBinary } from '../chain/lib/services/TransactionExecutionService';
import VmParams from './models/VmParams';
import { executeEvmCode } from './Evm';


/**
 * Executes code in a virtual machine
 * Supports both EVM and EWASM
 *
 * @export
 * @param {Transaction} transaction
 * @param {Uint8Array} binary
 * @returns
 */
export default async function execute(params: VmParams): Promise<Results> {
    const ipfs = Ipfs.getInstance(configuration.ipfs);
    let binary = params.bin;

    // The address is not a system contract, we'll forward it to IPFS.
    if (!binary) {
        const toAccount = await params.globalState.findOrCreateAccount(params.callMessage.destination);
        binary = await getContractBinary(toAccount, params.globalState);
        params.bin = binary;
    }

    if (!isWasmBinary(binary)) {
        return executeEvmCode(params);
    }

    const worker = createWorker(configuration.vmUrl);

    // This is the physical context it contains all functions and data
    // needed to execute a smart contract. It lives on the main thread
    // since database calls and asynchronous calls cannot be done on the
    // worker thread.
    const context = new Context(params.callMessage, params.globalState);
    const controller = new WorkerMessageController(worker, context);
    const result = await controller.start(binary);

    return result;
}
