const keccak = require('../../wasm/keccak256');

/**
 * Returns the WASM byte array according to https://github.com/ewasm/design/blob/master/system_contracts.md
 *
 * @export
 * @param {string} address
 * @returns {Uint8Array}
 */
export default function getSystemContract(address: string): Uint8Array {
    // Keccak256
    if (address === '0x0000000000000000000000000000000000000009') {
        return keccak;
    }

    return null;
}
