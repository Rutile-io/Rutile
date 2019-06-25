import { addEventListenerOnWorker, RequestMessage, postMessageOnWorker, extractMessageFromEvent } from "../utils/workerUtils";
import Context, { Results } from "../context";
import Transaction from "../../../models/Transaction";
import { storeAndNotify } from "../utils/sharedBufferUtils";

class WorkerMessageController {
    context: Context;
    worker: Worker;
    executionResultResolve: (value: any) => void;

    constructor(worker: Worker, context: Context) {
        this.context = context;
        this.worker = worker;

        addEventListenerOnWorker(worker, 'message', this.onMessage.bind(this));
    }

    public start(wasmBinary: Uint8Array): Promise<Results> {
        this.worker.postMessage({
            type: 'START',
            value: {
                wasm: wasmBinary,
            },
        });

        return new Promise((resolve) => {
            this.executionResultResolve = resolve;
        });
    }

    private async contextInit(message: RequestMessage) {
        await this.context.init(message.value.memory, message.value.notifier);

        // Let the worker know that we are finished with initialising.
        postMessageOnWorker(this.worker, {
            type: message.type,
            id: message.id,
            value: null,
        });
    }

    private async finish(results: Results) {
        this.worker.terminate();
        await this.context.close();
        this.executionResultResolve(this.context.results);
    }

    private async onMessage(event: any) {
        try {
            const message = extractMessageFromEvent(event);

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
                case 'SHAREDMEMORY_GROW':
                    this.context.updateMemory(message.value);
                    storeAndNotify(this.context.notifierBuffer, message.bufferIndex, 1);
                    break;
                default:
                    console.error('[onMessage] Could not understand message type: ', message.type);
            }
        } catch (error) {
            if (error.errorType !== 'VmError' && error.errorType !== 'FinishExecution') {
                console.error('[VM] Error:', error);
                throw error;
            }

            this.finish(this.context.results);
        }
    }
}

export default WorkerMessageController;
