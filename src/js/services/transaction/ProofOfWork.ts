import { configuration } from '../../Configuration';
const createKeccakHash = require('keccak');

export function calculateProofOfWorkHash(digest: string, nonce: number): string {
    return createKeccakHash('keccak256').update(`${digest}${nonce}`).digest('hex');
}

export function isProofOfWorkValid(digest: string, nonce: number): boolean {
    // Validate the hash
    const transactionHash = calculateProofOfWorkHash(digest, nonce);

    if (transactionHash.substring(0, configuration.difficulty) !== Array(configuration.difficulty + 1).join('0')) {
        return false;
    }

    return true;
}

export function applyProofOfWork(digest: string) {
    let nonce = 0;

    while(!isProofOfWorkValid(digest, nonce)) {
        nonce += 1;
    }

    return nonce;
}
