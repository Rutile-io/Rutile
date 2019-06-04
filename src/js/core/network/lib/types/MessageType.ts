export interface ConnectOfferMessage {
    sdp: RTCSessionDescriptionInit,
    fromNodeId: string,
    toNodeId: string,
    type: 'CONNECT_OFFER',
    peerId: string,
    createdTimestamp: number,
}

export interface TransactionMessage {
    type: 'TRANSACTION',
    value: string;
}

export interface BlockMessage {
    type: 'BLOCK';
    value: string;
}
