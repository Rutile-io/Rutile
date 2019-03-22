/**
 * Writes to memory with the given value.
 *
 * @export
 * @param {Uint32Array} memory
 * @param {number} addressPtr
 * @param {number} [length=32]
 * @returns
 */
export function loadMemory(memory: Uint32Array, addressPtr: number, value: Uint32Array, length: number = 32) {
    memory.set(value, addressPtr);
}

/**
 * Gets a value from memory as a 32 bit array
 *
 * @export
 * @param {Uint32Array} memory
 * @param {number} addressPtr
 * @param {number} [length=32]
 * @returns {Uint32Array}
 */
export function memoryGet(memory: Uint32Array, addressPtr: number, length: number = 32) {
    const result = new Uint32Array(length);

    for (let index = 0; index < length; index++) {
        result[index] = memory[index + addressPtr];
    }

    return result;
}

export class Memory {
    _raw: any = null;

    constructor(raw: any) {
        this._raw = raw;
    }

    write(offset: any, length: any, value: any) {
        // Grow if needed
        if (this._raw.buffer.byteLength < length) {
            const diff = length - this._raw.buffer.byteLength
            const pageSize = 64 * 1024
            this._raw.grow(Math.ceil(diff / pageSize))
        }

        const m = new Uint8Array(this._raw.buffer, offset, length)
        m.set(value);
    }

    read(offset: any, length: any) {
        return new Uint8Array(this._raw.buffer, offset, length);
    }
}
