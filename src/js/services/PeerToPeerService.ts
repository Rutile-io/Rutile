import getConfig from "../Configuration";
// import { URL } from 'url';

class PeerToPeerService {
    static async addNode(sessionDescription: RTCSessionDescriptionInit) {
        try {
            const url = new URL(`http://${getConfig('connectionServerUrl')}/requestSdpConnection`);
            url.searchParams.set('sdp', JSON.stringify(sessionDescription))

            const response = await fetch(url.toString());
        
            
        } catch (error) {
            console.error(error);
        }
    }
}

export default PeerToPeerService;
