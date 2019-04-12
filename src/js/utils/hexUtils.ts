const ethUtil = require('ethereumjs-util')

export function numberToHex(numb: number) {
    return '0x' + numb.toString(16);
}

export function hexStringToBuffer(str: string) {
    return ethUtil.toBuffer(str);
}
