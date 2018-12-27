export default function stringToByteArray(str: string): Uint8Array {
    const byteArray = new Uint8Array(str.length);

    for(let i = 0; i < str.length; i++) {
        byteArray[i] = str.charCodeAt(i);
    }

    return byteArray;
}
