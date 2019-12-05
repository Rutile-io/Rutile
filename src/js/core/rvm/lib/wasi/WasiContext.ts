import * as RLP from 'rlp';
import CallMessage from "../CallMessage";
import GlobalState from "../../../../models/GlobalState";
import { addEventListenerOnWorker, extractMessageFromEvent, postMessageOnWorker, RequestMessage } from "../../utils/workerUtils";
import MerkleTree, { createMerkleTree } from "../../../../models/MerkleTree";
import createEnvironmentVariables from "./createEnvironmentVariables";
import { Results } from "../../context";
import { toHex } from '../../utils/hexUtils';
import { storeAndNotify } from '../../utils/sharedBufferUtils';
import Logger = require('js-logger');
import { stringToHex, hexStringToBuffer } from '../../../../utils/hexUtils';

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

    // Buffer used for notifiying when a function completed execution
    notifierBuffer: SharedArrayBuffer = null;

    // Buffer used for storing values
    sharedValuesBuffer: SharedArrayBuffer = null;

    executionResolve: () => void;

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
     * Uses gas
     *
     * @param {number} amount
     * @memberof WasiContext
     */
    public useGas(amount: number) {
        this.result.gasUsed += amount;

        // TODO: Check if the maximum amount has been reached.
    }

    private async storageStore(key: string, value: Uint8Array) {
        await this.accountState.put(key, value);
    }

    private async storageLoad(key: string): Promise<Buffer> {
        return await this.accountState.get(key);
    }

    private async onContextMessage(message: RequestMessage) {
        const method = message.type.replace('context::', '');
        let dataToWrite: Buffer = null;

        if (method === 'useGas') {
            this.useGas(message.value[0]);
            return;
        } else if (method === 'storageStore') {
            await this.storageStore(message.value[0], message.value[1]);
        } else if (method === 'storageLoad') {
            dataToWrite = await this.storageLoad(message.value[0]);
        } else if (method === 'exit') {
            this.vmWorker.terminate();

            // Logger.debug('=============== Debug ==============\n\n' + message.value[1]);
            // Logger.debug('====================================');

            if (message.value[1].startsWith('0x')) {
                this.result.return = Buffer.from(message.value[1].replace('0x', ''), 'hex');
                this.result.returnHex = '0x' + toHex(this.result.return);
                this.result.exception = message.value[0];
            }

            this.executionResolve();
            return;
        }

        if (dataToWrite) {
            // Write the data in the shared array buffer so we can use it in the worker
            const dataLength = dataToWrite.length;
            const u8ValuesBuffer = new Uint8Array(this.sharedValuesBuffer);

            u8ValuesBuffer.set(Buffer.from(dataLength.toString(16), 'hex'));
            u8ValuesBuffer.set(dataToWrite, 4);
        }

        // Now notify the VirtualContext that the execution was completed and
        // it can continue execution
        storeAndNotify(this.notifierBuffer, message.bufferIndex, 1);
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

        if (message.type.includes('context::')) {
            this.onContextMessage(message);
            return;
        }

        switch(message.type) {
            case 'CONTEXT_INIT':
                // This is our way of notifying the worker with atomics.
                this.notifierBuffer = message.value.notifier;
                this.sharedValuesBuffer = message.value.sharedValuesBuffer;

                // Bounce back
                postMessageOnWorker(this.vmWorker, {
                    type: message.type,
                    id: message.id,
                    value: null,
                });
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
            this.executionResolve = async () => {
                this.result.outputRoot = await this.accountState.getMerkleRoot();
                resolve(this.result);
            };
        });
    }
}

export default WasiContext;
