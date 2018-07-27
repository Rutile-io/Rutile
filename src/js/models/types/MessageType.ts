export interface ConnectOfferMessage {
    sdp: RTCSessionDescriptionInit,
    nodeId: string,
    type: 'CONNECT_OFFER',
}