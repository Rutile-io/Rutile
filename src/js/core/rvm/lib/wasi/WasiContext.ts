import * as RLP from 'rlp';
import CallMessage from "../CallMessage";
import GlobalState from "../../../../models/GlobalState";
import { addEventListenerOnWorker, extractMessageFromEvent, postMessageOnWorker } from "../../utils/workerUtils";
import MerkleTree, { createMerkleTree } from "../../../../models/MerkleTree";
import createEnvironmentVariables from "./createEnvironmentVariables";
import { Results } from "../../context";
import { toHex } from '../../utils/hexUtils';

class WasiContext {
    callMessage: CallMessage = null;
    globalState: GlobalState = null;
    accountState: MerkleTree = null;
    vmWorker: Worker = null;
    result: Results = {
        createdAddress: null,
        exception: 0,
        exceptionError: null,
        gasUsed: 0,
        outputRoot: '0x',
        return: new Uint8Array(),
        returnHex: '0x',
    };

    // Buffer used for atomics
    notifierBuffer: SharedArrayBuffer = null;
    executionResolve: (value: any) => void;

    /**
     * Creates an instance of WasiContext.
     *
     * @param {CallMessage} callMessage
     * @param {GlobalState} globalState
     * @param {Worker} vmWorker
     * @memberof WasiContext
     */
    constructor(callMessage: CallMessage, globalState: GlobalState, vmWorker: Worker) {
        this.callMessage = callMessage;
        this.globalState = globalState;
        this.vmWorker = vmWorker;

        addEventListenerOnWorker(vmWorker, 'message', this.onWorkerMessage.bind(this));
    }

    /**
     * Fires when a message came from a worker
     *
     * @private
     * @param {*} event
     * @memberof WasiContext
     */
    private onWorkerMessage(event: any) {
        const message = extractMessageFromEvent(event);

        switch(message.type) {
            case 'CONTEXT_INIT':
                // This is our way of notifying the worker with atomics.
                this.notifierBuffer = message.value.notifier;

                // Bounce back
                postMessageOnWorker(this.vmWorker, {
                    type: message.type,
                    id: message.id,
                    value: null,
                });
                break;
            case 'EXIT':
                // Worker says that the application has finished execution
                this.executionResolve(message.value);
                break;
        }
    }

    /**
     * Runs a WASM binary on the worker
     *
     * @param {Uint8Array} binary
     * @memberof WasiContext
     */
    async run(binary: Uint8Array): Promise<Results> {
        // First create our key->value storage for this account
        const toAccount = await this.globalState.findOrCreateAccount(this.callMessage.destination);
        this.accountState = await createMerkleTree(toAccount.storageRoot);

        const environmentVariables = await createEnvironmentVariables(this.callMessage);
        const decodedArgs: any = RLP.decode(this.callMessage.inputData);
        const args: string[] = decodedArgs.map((buffer: Buffer) => '0x' + toHex(buffer));
        args.unshift(this.callMessage.destination);

        // Let the worker know we can start the WASM binary
        this.vmWorker.postMessage({
            type: 'START',
            value: {
                wasm: binary,
                env: environmentVariables,
                args,
            }
        });

        // We pass the resolve in the class since we don't know when the
        // application is done.
        return new Promise((resolve) => {
            this.executionResolve = (statusCode: number) => {
                this.result.exception = statusCode;

                resolve(this.result);
            };
        });
    }
}

export default WasiContext;
