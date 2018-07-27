import getConfig from "../Configuration";
// import { URL } from 'url';

interface InitialHttpNodeConnectResponse {
    sdp: RTCSessionDescription,
    nodeId: string,
}

class PeerToPeerService {
    /**
     * Connects to a node.js node for the initial connection.
     * This is only used in the beginning, nodes are expected to send everything through WebRTC.
     *
     * @static
     * @param {RTCSessionDescriptionInit} sessionDescription
     * @returns {RTCSessionDescription}
     * @memberof PeerToPeerService
     */
    static async initialHttpNodeConnect(sessionDescription: RTCSessionDescriptionInit): Promise<InitialHttpNodeConnectResponse | null> {
        try {
            const url = new URL(`http://${getConfig('connectionServerUrl')}/requestSdpConnection`);
            url.searchParams.set('sdp', JSON.stringify(sessionDescription))
            url.searchParams.set('nodeId', getConfig('nodeId'));

            const response = await fetch(url.toString());
            const data: InitialHttpNodeConnectResponse = (await response.json()).Result;
            
            return data;
        } catch (error) {
            console.error(error);
            return null;
        }
    }
}

export default PeerToPeerService;
