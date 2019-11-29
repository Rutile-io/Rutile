import './context';
import Context, { Results } from './context';
import { configuration } from '../../Configuration'
import { createWorker } from './utils/workerUtils';
import WorkerMessageController from './controller/WorkerMessageController';
import isWasmBinary from './lib/services/isWasmBinary';
import Ipfs from '../../services/wrappers/Ipfs';
import { getContractBinary } from '../chain/lib/services/TransactionExecutionService';
import VmParams from './models/VmParams';
import isIpfsHash from '../chain/lib/utils/isIpfsHash';
import stringToByteArray from '../../utils/stringToByteArray';
import WasiContext from './lib/wasi/WasiContext';


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

        // Still no binary found (or IPFSHash)
        if (!binary) {
            throw new Error(`No binary found to match the address ${params.callMessage.destination}`);
        }
    }

    // We still have to fetch the binary since it came from IPFS
    if (isIpfsHash(binary.toString())) {
        const ipfsBinary = await ipfs.cat(binary.toString());
        binary = stringToByteArray(ipfsBinary);
    }

    if (!isWasmBinary(binary)) {
        throw new Error('Binary is not WASM');
    }

    const worker = await createWorker(configuration.vmUrl);
    const wasiContext = new WasiContext(params.callMessage, params.globalState, worker);

    return wasiContext.run(binary);
}
