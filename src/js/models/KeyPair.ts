import { ec as Ec } from 'elliptic';
import { arrayify } from '../utils/arrayify';
import keccak256 from '../utils/keccak256';
import { toHex } from '../core/rvm/utils/hexUtils';

interface Signature {
    recoveryParam?: number,
    r: string,
    s: string,
    v: number,
}

let curve: any = null;

function getCurve() {
    if (!curve) {
        curve = new Ec('secp256k1');
    }

    return curve;
}

class KeyPair {
    curve: any;
    privateKey: string;
    publicKey: string;
    compressedPublicKey: string;

    constructor(privateKey: string) {
        this.curve = getCurve();

        const keyPair = this.curve.keyFromPrivate(privateKey);

        this.privateKey = privateKey;
        this.publicKey = keyPair.getPublic(false, 'hex');

        this.compressedPublicKey = keyPair.getPublic(true, 'hex');
    }

    sign(digest: string): Signature {
        // const keyPair = this.curve.keyFromPrivate(this.privateKey);
        const keyPair = this.curve.keyFromPrivate(this.privateKey);
        const signature = keyPair.sign(digest, { canonical: true });

        return {
            recoveryParam: signature.recoveryParam,
            // r: signature.r.toString(16),
            // s: signature.s.toString(16),
            r: '0x' + signature.r.toString(16),
            s: '0x' + signature.s.toString(16),
            v: 27 + signature.recoveryParam,
        }
    }

    getAddress() {
        return KeyPair.computeAddress(this.publicKey);
    }

    static verifySignature(digest: string, signature: Signature): boolean {
        const recoveryParam = signature.v - 27;

        const rs = {
            r: signature.r.slice(2),
            s: signature.s.slice(2),
        }

        const pubkeyCurve = getCurve().recoverPubKey(arrayify(digest), rs, recoveryParam);
        const keyPair = getCurve().keyFromPublic(pubkeyCurve);

        return keyPair.verify(digest, rs);
    }

    static recoverAddress(digest: string, signature: Signature) {
        const publicKey = KeyPair.recoverPublicKey(digest, signature);

        return KeyPair.computeAddress(publicKey);
    }

    static recoverPublicKey(digest: string, signature: Signature) {
        const recoveryParam = signature.v - 27;

        const rs = {
            r: signature.r.slice(2),
            s: signature.s.slice(2),
        }

        const publicKey = getCurve().recoverPubKey(arrayify(digest), rs, recoveryParam).encode('hex', false);

        return KeyPair.computePublicKey(publicKey, false);
    }

    static computePublicKey(key: string, compressed?: boolean) {
        if (!compressed) {
            return key;
        }

        return getCurve().keyFromPublic(key, 'hex').getPublic(true, 'hex');
    }

    static computeAddress(key: string) {
        const keyBuffer = Buffer.from(arrayify(key.substring(2)));
        return '0x' + keccak256(keyBuffer).slice(24);
    }
}

export default KeyPair;
