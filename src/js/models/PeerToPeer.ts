import isNodeJs from "../services/isNodeJs";
import getConfig from "../Configuration";
import NodesService from "../services/NodesService";
import P2P from "./P2P";
import PeerToPeerService from "../services/PeerToPeerService";
import { URL } from 'url';

const uuid = require('uuid/v4');

interface Connection {
    p2p: P2P,
}

class PeerToPeer {
    connections: Connection[] = [];
    isFirstConnectionMade: boolean = false;

    private handleHttpRequest(req: any, res: any) {
        res.setHeader('Access-Control-Allow-Origin', '*');

        if (req.url === '/nodes') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                Result: this.connections,
            }));
         } else if (req.url.includes('/requestSdpConnection')) {
            const requestUrl = new URL('http://localhost.com' + req.url);

            // TODO: Return a bad request when no sdp param was found..
            if (!requestUrl.searchParams.has('sdp')) {
                return;
            }

            const descriptionInit = requestUrl.searchParams.get('sdp');

            // Now use the offer that was given and connect to that node.

            //  this.connections.push();
         } else {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('Page not found.');
        }
    }

    async onSignal(sessionDescription: RTCSessionDescriptionInit, isOffer: boolean) {
        console.log('[] :: sessionDescription -> ', sessionDescription);

        // No first connection, so we must add our session description through HTTP.
        if (!this.isFirstConnectionMade) {
            if (isNodeJs()) {
                return;
            }

            await PeerToPeerService.addNode(sessionDescription);
        }
    }

    /**
     * Opens the connection with peer to peer.
     * If it's running on node we will create a simple stung server
     * where all webrtc connections are passed through.
     *
     * @memberof PeerToPeer
     */
    async open() {
        // NodeJS should create a 
        if (isNodeJs()) {
            // TODO: Use HTTPS here instead of HTTP
            const http = require('http');
            const httpServer = http.createServer(this.handleHttpRequest.bind(this));

            httpServer.listen(getConfig('port'), '0.0.0.0');

            console.log(`Listening on port ${getConfig('port')}`);
        }

        // Since we are just opening the node we have to create an offer.
        const p2p = new P2P(true);
        p2p.onSignal = (description) => this.onSignal(description, true);
        p2p.open();

        this.connections.push({
            p2p,
        });
    }
}

export default PeerToPeer;
