import PeerToPeer from "../../models/PeerToPeer";
import { PEER_TO_PEER_ON_PEER_DATA } from "../../core/events";

export default async function getLatestMilestone(peerToPeer: PeerToPeer) {
    let eventId = null;

    eventId = peerToPeer.eventHandler.on(PEER_TO_PEER_ON_PEER_DATA, (data: any) => {
        console.log('[Data] data -> ', data);
    }, 'getLatestMilestone');

    peerToPeer.broadcast(JSON.stringify({
        type: '',
    }));
}
