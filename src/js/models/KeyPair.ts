import { ec as Ec } from 'elliptic';
import toHexString from '../utils/toHexString';
import hexZeroPad from '../utils/hexZeroPad';

interface Signature {
    recoveryParam: number,
    r: string,
    s: string,
    v: number,
}

class KeyPair {
    curve: any;
    privateKey: string;
    publicKey: string;
    compressedPublicKey: string;

    constructor(privateKey: string) {
        this.curve = new Ec('secp256k1');
        
        const keyPair = this.curve.keyFromPrivate(privateKey);
        
        this.privateKey = privateKey;
        this.publicKey = keyPair.getPublic(false, 'hex');
        this.compressedPublicKey = keyPair.getPublic(true, 'hex');
    }

    sign(digest: string): Signature {
        const keyPair = this.curve.keyFromPrivate(this.privateKey);
        const signature = keyPair.sign(digest, { canonical: true });
        
        return {
            recoveryParam: signature.recoveryParam,
            r: hexZeroPad('0x' + signature.r.toString(16), 32),
            s: hexZeroPad('0x' + signature.s.toString(16), 32),
            v: 27 + signature.recoveryParam,
        }
    }
}

export default KeyPair;