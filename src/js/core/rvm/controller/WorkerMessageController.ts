import { addEventListenerOnWorker, RequestMessage, postMessageOnWorker } from "../utils/workerUtils";
import Context, { Results } from "../context";
import Transaction from "../../../models/Transaction";

class WorkerMessageController {
    context: Context;
    worker: Worker;
    sharedNotifier: SharedArrayBuffer;
    executionResultResolve: (value: any) => void;

    constructor(worker: Worker, context: Context) {
        this.context = context;
        this.worker = worker;

        addEventListenerOnWorker(worker, 'message', this.onMessage.bind(this));
    }

    public start(transaction: Transaction, wasmBinary: Uint8Array): Promise<Results> {
        this.worker.postMessage({
            type: 'START',
            value: {
                transaction,
                wasm: wasmBinary,
            },
        });

        return new Promise((resolve) => {
            this.executionResultResolve = resolve;
        });
    }

    private async contextInit(message: RequestMessage) {
        const buffers = await this.context.init(message.value.memoryBuffer);

        this.sharedNotifier = buffers.notifier;

        postMessageOnWorker(this.worker, {
            type: message.type,
            id: message.id,
            value: {
                sharedMemory: buffers.memory,
                sharedNotifier: buffers.notifier,
            },
        });
    }

    private async onMessage(message: RequestMessage) {
        try {
            // Messages that start with context:: are from the Virtual Context
            // they usually want to access values from the Context itself.
            if (message.type.startsWith('context::')) {
                const func = message.type.replace('context::', '');
                const exposedFunctions = this.context.getExposedFunctions();
                const args = [
                    message.bufferIndex,
                    ...message.value,
                ];

                if (exposedFunctions[func]) {
                    exposedFunctions[func](...args);
                    return;
                }
            }

            switch(message.type) {
                case 'CONTEXT_INIT':
                    this.contextInit(message);
                    break;
                default:
                    console.error('[onMessage] Could not understand message type: ', message.type);
            }
        } catch (error) {
            if (error.errorType !== 'VmError' && error.errorType !== 'FinishExecution') {
                console.error('[VM] Error:', error);
                throw error;
            }

            this.executionResultResolve(this.context.results);
        }
    }
}

export default WorkerMessageController;
