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
    for (let i = 0; i < length; i++) {
        memory[i + addressPtr] = value[i];
    }
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
