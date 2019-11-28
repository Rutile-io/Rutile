import { toHex } from "../utils/hexUtils";

export class Memory {
    buffer: SharedArrayBuffer = null;

    constructor(raw: SharedArrayBuffer) {
        this.buffer = raw;
    }

    write(offset: number, length: number, value: ArrayLike<number>) {
        // Grow if needed, need to rework since we are using shared buffers
        // if (this._raw.buffer.byteLength < length) {
        //     const diff = length - this._raw.buffer.byteLength
        //     const pageSize = 64 * 1024
        //     this._raw.grow(Math.ceil(diff / pageSize))
        // }
        const m = new Uint8Array(this.buffer, offset, length);
        m.set(value);
    }

    read(offset: number, length: number) {
        const data = new Uint8Array(this.buffer, offset, length);

        return data;
    }

    /**
     * Stores on the memory in reverse
     *
     * @param {number} offset
     * @param {number} length
     * @param {ArrayLike<number>} value
     * @memberof Memory
     */
    storeMemoryReverse(offset: number, length: number, value: ArrayLike<number>) {
        const m = new Uint8Array(this.buffer);

        for (let index = 0; index < length; ++index) {
            m.set([value[index]], offset + length - (index + 1));
        }
    }

    storeUint128(offset: number, value: ArrayLike<number>) {
        this.storeMemoryReverse(offset, 16, value);
    }

    storeUint256(offset: number, value: ArrayLike<number>) {
        this.storeMemoryReverse(offset, 32, value);
    }

    /**
     * Gets the string from a pointer
     * taken from https://github.com/AssemblyScript/assemblyscript/blob/c7740fe36590679c411e4de1c0865732f8050c03/lib/loader/index.js
     *
     * @param {number} ptr
     * @returns
     * @memberof Memory
     */
    getString(ptr: number) {
        const U32 = new Uint32Array(this.buffer);
        const U16 = new Uint16Array(this.buffer);

        let length = U32[(ptr + -4) >>> 2] >>> 1;
        let offset = ptr >>> 1;

        if (length <= 1024) return String.fromCharCode.apply(String, U16.subarray(offset, offset + length));
        const parts = [];

        do {
            const last = U16[offset + 1024 - 1];
            const size = last >= 0xD800 && last < 0xDC00 ? 1024 - 1 : 1024;
            parts.push(String.fromCharCode.apply(String, U16.subarray(offset, offset += size)));
            length -= size;
        } while (length > 1024);

        return parts.join("") + String.fromCharCode.apply(String, U16.subarray(offset, offset + length));
    }
}

export function synchroniseMemoryToBuffer(memory: WebAssembly.Memory, buffer: SharedArrayBuffer) {
    const ui8Shared = new Uint8Array(buffer);
    const ui8Memory = new Uint8Array(memory.buffer);

    if (ui8Shared.length !== ui8Memory.length) {
        throw new Error('Memory and shared buffer are not the same size, out of bounds');
    }

    for (let index = 0; index < ui8Memory.length; index++) {
        Atomics.store(ui8Shared, index, ui8Memory[index]);
    }
}

export function synchroniseBufferToMemory(memory: WebAssembly.Memory, buffer: SharedArrayBuffer) {
    const ui8Shared = new Uint8Array(buffer);
    const ui8Memory = new Uint8Array(memory.buffer);

    if (ui8Shared.length !== ui8Memory.length) {
        throw new Error('Memory and shared buffer are not the same size, out of bounds');
    }

    for (let index = 0; index < ui8Shared.length; index++) {
        ui8Memory[index] = Atomics.load(ui8Shared, index);
    }
}
