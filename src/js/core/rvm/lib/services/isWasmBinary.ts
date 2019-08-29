const MAGIC_NUMBER = [0x00, 0x61, 0x73, 0x6D];

export default function isWasmBinary(binary: Uint8Array): boolean {
    if (!binary) {
        return false;
    }

    let isWasm = true;

    MAGIC_NUMBER.forEach((byte, index) => {
        if (byte !== binary[index]) {
            isWasm = false;
            return;
        }
    });

    return isWasm;
}
