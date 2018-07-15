export default function isNodeJs(): boolean {
    if (typeof window === 'undefined') {
        return true;
    }

    return false;
}
