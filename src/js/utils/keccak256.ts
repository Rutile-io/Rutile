const createKeccakHash = require('keccak');

export default function keccak256(digest: any): string {
    return createKeccakHash('keccak256').update(digest).digest('hex');
}
