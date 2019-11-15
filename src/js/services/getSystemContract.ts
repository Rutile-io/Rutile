const keccak = require('../../wasm/keccak256');
// const fs = require('fs');
// const file = fs.readFileSync('/Volumes/Mac Space/Workspace/Rutile/InternalContracts/build/untouched-milestones.wasm');
// const wasm = new Uint8Array(file);

/**
 * Returns the WASM byte array according to https://github.com/ewasm/design/blob/master/system_contracts.md
 *
 * @export
 * @param {string} address
 * @returns {Uint8Array}
 */
export default function getSystemContract(address: string): Uint8Array {
    // // WASM test
    // if (address === '0x0000000000000000000000000000000000000001') {
    //     return wasm;
    // }

    // Keccak256
    if (address === '0x0000000000000000000000000000000000000009') {
        return new Uint8Array(keccak);
    }

    return null;
}
