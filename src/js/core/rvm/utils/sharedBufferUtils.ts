/**
 * Stores on a shared buffer and notifies the buffer it is ready.
 *
 * @export
 * @param {SharedArrayBuffer} sharedArrayBuffer
 * @param {number} index
 * @param {number} value
 */
export function storeAndNotify(sharedArrayBuffer: SharedArrayBuffer, index: number, value: number) {
    const int32a = new Int32Array(sharedArrayBuffer);

    Atomics.store(int32a, index, value);

    // @ts-ignore
    Atomics.notify(int32a, index);
}

export function waitAndLoad(sharedArrayBuffer: SharedArrayBuffer, index: number) {
    const int32a = new Int32Array(sharedArrayBuffer);

    Atomics.wait(new Int32Array(sharedArrayBuffer), index, 0);
    return Atomics.load(int32a, index);
}

export function reset(sharedArrayBuffer: SharedArrayBuffer, index: number) {
    const int32a = new Int32Array(sharedArrayBuffer);
    Atomics.store(int32a, index, 0);
}
