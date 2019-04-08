import isNodeJs from "../../../services/isNodeJs";
const uuid = require('uuid/v4');

export interface RequestMessage {
    type: string,
    value: any,
    id?: string,
    bufferIndex?: number;
}


/**
 * Creates a worker (NodeJS/Browser)
 *
 * @export
 * @param {string} stringUrl
 * @param {WorkerOptions} [options]
 * @returns {Worker}
 */
export function createWorker(stringUrl: string, options?: any): Worker {
    let WorkerConstructor: any = null;

    if (isNodeJs()) {
        WorkerConstructor = __non_webpack_require__('worker_threads').Worker;
    } else {
        WorkerConstructor = Worker;
    }

    return new WorkerConstructor(stringUrl, options);
}

export function workerParseMessage(event: any): RequestMessage {
    return event;
}

export function workerPostMessage(message: RequestMessage) {
    if (isNodeJs()) {
        __non_webpack_require__('worker_threads').parentPort.postMessage(message);
    } else {
        self.postMessage(message, '*');
    }
}

export function workerRequest(message: RequestMessage): Promise<RequestMessage> {
    return new Promise((resolve) => {
        message.id = uuid();

        function listener(event: any) {
            const receivedMessage = workerParseMessage(event);

            if (receivedMessage.id === message.id) {
                workerRemoveEventListener('message', listener);
                resolve(receivedMessage);
            }
        }

        workerPostMessage(message);
        workerAddEventListener('message', listener);
    });
}

export function workerRemoveEventListener(eventType: string, callback: (event: any) => void) {
    if (isNodeJs()) {
        __non_webpack_require__('worker_threads').parentPort.off(eventType, callback);
    } else {
        self.removeEventListener(eventType, callback);
    }
}

export function workerAddEventListener(eventType: string, callback: (event: any) => void) {
    if (isNodeJs()) {
        __non_webpack_require__('worker_threads').parentPort.on(eventType, callback);
    } else {
        self.addEventListener(eventType, callback);
    }
}

export function addEventListenerOnWorker(worker: Worker, evenType: string, callback: (event: any) => void) {
    if (isNodeJs()) {
        // @ts-ignore
        worker.on(evenType, callback);
    } else {
        worker.addEventListener(evenType, callback);
    }
}

export function postMessageOnWorker(worker: Worker, message: RequestMessage) {
    worker.postMessage(message);
}

