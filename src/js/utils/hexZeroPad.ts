export function isHexString(value: any, length?: number): boolean {
    if (typeof(value) !== 'string' || !value.match(/^0x[0-9A-Fa-f]*$/)) {
        return false
    }
    if (length && value.length !== 2 + 2 * length) { return false; }
    return true;
}

export default function hexZeroPad(value: string, length: number): string {
    if (!isHexString(value)) {
        throw Error("Invalid hex string");
    }

    while (value.length < 2 * length + 2) {
        value = '0x0' + value.substring(2);
    }
    
    return value;
}