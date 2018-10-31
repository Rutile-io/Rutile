export enum PeerDataType {
    CONNECT_OFFER = 'CONNECT_OFFER',
    EXECUTION_REQUEST = 'EXECUTION_REQUEST',
}


export interface PeerData {
    type: PeerDataType
}