import { configuration } from '../../Configuration';
const createKeccakHash = require('keccak');

export function calculateProofOfWorkHash(id: string, nonce: number): string {
    return createKeccakHash('keccak256').update(`${id}${nonce}`).digest('hex');
}

export function isProofOfWorkValid(id: string, nonce: number): boolean {
    // Validate the hash
    const transactionHash = calculateProofOfWorkHash(id, nonce);

    if (transactionHash.substring(0, configuration.difficulty) !== Array(configuration.difficulty + 1).join('0')) {
        return false;
    }

    return true;
}

export function applyProofOfWork(id: string) {
    let nonce = 0;

    while(!isProofOfWorkValid(id, nonce)) {
        nonce += 1;
    }

    return nonce;
}
