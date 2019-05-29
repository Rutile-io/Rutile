const ethUtil = require('ethereumjs-util')

export function numberToHex(numb: number) {
    return '0x' + numb.toString(16);
}

export function hexStringToBuffer(str: string): Buffer {
    return ethUtil.toBuffer(str);
}

/**
 * Converts a string to a hex
 *
 * @export
 * @param {string} str
 * @returns
 */
export function stringToHex(str: string): string {
    let result = '';

    for (var i=0; i < str.length; i++) {
      result += str.charCodeAt(i).toString(16);
    }

    return '0x' + result;
}

export function hexStringToString(hexStr: string): string {
    return hexStringToBuffer(hexStr).toString('utf8');
}
