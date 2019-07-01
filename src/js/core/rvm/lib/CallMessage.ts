import BNType from 'bn.js';

export enum CallKind {
    Call,
    CallCode,
    CallDelegate,
    CallStatic
}

class CallMessage {
    sender: string;
    destination: string;
    flags: number;
    depth: number;
    gas: number;
    kind: CallKind;
    value: BNType;
    inputData: Uint8Array;
    inputSize: number;
    inputRoot?: string;
}

export default CallMessage;
