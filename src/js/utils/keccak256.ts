const createKeccakHash = require('keccak');

export default function keccak256(digest: string): string {
    return createKeccakHash('keccak256').update(digest).digest('hex');
}
