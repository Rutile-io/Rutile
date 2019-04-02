import isNodeJs from "../../../services/isNodeJs";

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


export function workerAddEventListener(eventType: string, callback: (event: any) => void) {
    if (isNodeJs()) {
        __non_webpack_require__('worker_threads').parentPort.on(eventType, callback);
    } else {
        self.addEventListener(eventType, callback);
    }
}
