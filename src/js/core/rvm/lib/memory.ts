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
        return new Uint8Array(this.buffer, offset, length);
    }
}
