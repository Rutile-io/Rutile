import * as RLP from 'rlp';
import { Results } from '../core/rvm/context';
import { numberToHex, hexStringToBuffer } from '../utils/hexUtils';

interface Receipt {
    root: string;
    gasUsed: number;
    logs: string;
    logsBloom: string;
    status: string;
}

export function createReceipt(result: Results) {
    return RLP.encode([
        result.outputRoot,
        numberToHex(result.gasUsed),
        '0x',
        '0x',
        numberToHex(result.exception),
    ]);
}

export function decodeReceipt(receipt: Buffer): Receipt {
    const decodedData: any = RLP.decode(receipt);
    const data: Buffer[] = decodedData;

    return {
        root: '0x' + data[0].toString('hex'),
        gasUsed: parseInt('0x' + data[1].toString('hex')),
        logs: '0x' + data[2].toString('hex'),
        logsBloom: '0x' + data[3].toString('hex'),
        status: '0x' + data[4].toString('hex'),
    };
}


export default Receipt;
