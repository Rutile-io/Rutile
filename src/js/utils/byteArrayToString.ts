export default function byteArrayToString(arr: Uint8Array) {
    return String.fromCharCode.apply(null, arr);
}
