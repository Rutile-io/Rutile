import * as assert from 'assert';

export default function fromI64(high: number, low: number) {
    if (high < 0) {
        // convert from a 32-bit two's compliment
        high = 0x100000000 - high
    }

    // High shouldn't have any bits set between 32-21
    assert((high & 0xffe00000) === 0, 'Failed to convert wasm i64 to JS numbers')

    if (low < 0) {
        // convert from a 32-bit two's compliment
        low = 0x100000000 - low
    }
    // JS only bitshift 32bits, so instead of high << 32 we have high * 2 ^ 32
    return (high * 4294967296) + low
}
