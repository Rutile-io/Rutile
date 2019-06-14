import { configuration } from '../../Configuration';
const createKeccakHash = require('keccak');

export function calculateProofOfWorkHash(digest: string, nonce: number): string {
    return createKeccakHash('keccak256').update(`${digest}${nonce}`).digest('hex');
}

export function isProofOfWorkValid(digest: string, nonce: number, difficulty: number = configuration.difficulty): boolean {
    // Validate the hash
    const transactionHash = calculateProofOfWorkHash(digest, nonce);

    if (transactionHash.substring(0, difficulty) !== Array(difficulty + 1).join('0')) {
        return false;
    }

    return true;
}

export function applyProofOfWork(digest: string, difficulty: number = configuration.difficulty) {
    let nonce = 0;

    while(!isProofOfWorkValid(digest, nonce, difficulty)) {
        nonce += 1;
    }

    return nonce;
}
