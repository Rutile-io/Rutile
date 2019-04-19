/**
 * Converts a byte array to a hexadecimal string
 *
 * @export
 * @param {Uint32Array} byteArray
 * @returns {string}
 */
export function toHex(byteArray: ArrayLike<number>): string {
    return Array.prototype.map.call(byteArray, function(byte: number) {
        return ('0' + (byte & 0xFF).toString(16)).slice(-2);
    }).join('');
}

export function hexStringToByte(str: string) {
    var a = [];

    for (var i = 0, len = str.length; i < len; i+=2) {
      a.push(parseInt(str.substr(i,2),16));
    }

    return new Uint8Array(a);
  }

export function createZerosArray(length: number) {
    return new Uint8Array(length).fill(0);
}

