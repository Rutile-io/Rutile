import * as RLP from 'rlp';
const createKeccakHash = require('keccak');

export default function keccak256(digest: any): string {
    return createKeccakHash('keccak256').update(digest).digest('hex');
}

/**
 * Applys RLP encoding and hashes the result
 *
 * @export
 * @param {*} items
 * @returns
 */
export function rlpHash(items: any) {
    return keccak256(RLP.encode(items));
}
