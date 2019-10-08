export default function isIpfsHash(hash: string) {
    if (hash.startsWith('Qm')) {
        return true;
    }

    return false;
}
