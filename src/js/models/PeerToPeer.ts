import isNodeJs from "../services/isNodeJs";
import getConfig, { configuration } from "../Configuration";
import NodesService from "../services/NodesService";
import P2P from "./P2P";
import PeerToPeerService from "../services/PeerToPeerService";
import { URL } from 'url';
import { ConnectOfferMessage } from "./types/MessageType";

const uuid = require('uuid/v4');

interface Connection {
    // Offers don't have yet a filled in nodeId,
    nodeId?: string,
    p2p: P2P,
}

class PeerToPeer {
    connections: Connection[] = [];
    isFirstConnectionMade: boolean = false;

    /**
     * Handles the HTTP Requests (Mostly for Node)
     *
     * @private
     * @param {*} req
     * @param {*} res
     * @returns
     * @memberof PeerToPeer
     */
    private handleHttpRequest(req: any, res: any) {
        res.setHeader('Access-Control-Allow-Origin', '*');

        if (req.url === '/nodes') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                Result: this.connections,
            }));
         } else if (req.url.includes('/requestSdpConnection')) {
            const requestUrl = new URL('http://localhost.com' + req.url);

            const sdp = requestUrl.searchParams.get('sdp');
            const nodeId = requestUrl.searchParams.get('nodeId');

            // TODO: Return a bad request when no sdp param was found..
            if (!sdp || !nodeId) {
                console.error('No sdp or nodeId available');
                return;
            }

            const descriptionInit: RTCSessionDescription = JSON.parse(sdp);

            if (descriptionInit.type !== 'offer') {
                console.error('SDP is not offer');
                return;
            }

            // Create a response signal and send it as response.
            const peer = new P2P(false);

            peer.onSignal = (offerSignal) => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    Result: {
                        sdp: offerSignal,
                        nodeId: getConfig('nodeId'),
                    }
                }));
            }

            peer.onClose = () => this.onPeerClose(peer.id);
            peer.onConnect = () => this.onPeerConnected(peer.id);
            peer.open();
            peer.connect(descriptionInit)

            // Now use the offer that was given and connect to that node.
            this.connections.push({
                p2p: peer,
                nodeId,
            });
         } else {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('Page not found.');
        }
    }

    /**
     * Connects to more nodes through p2p.
     *
     * @private
     * @returns
     * @memberof PeerToPeer
     */
    private async connectToMoreNodes() {
        console.log('[Peer] Requesting more connections');
        // Only get connections that are actually connected and not just offers
        const connectedNodes = this.connections.filter(connection => !!connection.nodeId);

        if (connectedNodes.length >= configuration.maximumNodes) {
            console.warn('Already connected to maximum nodes');
            return;
        }

        if (!connectedNodes.length) {
            console.error('No connections found, could not attach ');
            return;
        }

        // Ask for each node a pass through offer.
        const connectionsNeeded = configuration.maximumNodes - connectedNodes.length;

        // Loop the amount of needed connections
        // We chose already open connections at random to create an offer.
        for (let index = 0; index < connectionsNeeded; index++) {
            const peer = new P2P(true);

            peer.onSignal = (signal) => {
                const randomConnection = connectedNodes[Math.floor(Math.random() * connectedNodes.length)];  
                const message: ConnectOfferMessage = {
                    nodeId: configuration.nodeId,
                    sdp: signal,
                    type: 'CONNECT_OFFER',
                };
                
                randomConnection.p2p.sendData(JSON.stringify(message));
            }

            peer.onData = (data) => this.onPeerData(data, peer.id);
            peer.onClose = () => this.onPeerClose(peer.id);
            peer.onConnect = () => this.onPeerConnected(peer.id);

            peer.open();
            
            this.connections.push({
                p2p: peer,
            });
        }
    }

    private async onSignal(sessionDescription: RTCSessionDescriptionInit, peerId: string) {
        // No first connection, so we must add our session description through HTTP.
        if (!this.isFirstConnectionMade) {
            // TODO: NodeJS should connect to a different node aswell.
            // But for now we only let it be a stung server
            if (isNodeJs()) {
                return;
            }

            console.log('[PeerToPeer] Making first handshake with server');

            const response =  await PeerToPeerService.initialHttpNodeConnect(sessionDescription);
            const connectionIndex = this.connections.findIndex(connection => connection.p2p.id === peerId);
            const connection = this.connections[connectionIndex];

            if (!response) {
                console.error('No session description received, not adding connection');
                return;
            }

            if (!connection) {
                console.error('Could not find connection, not adding');
                return;
            }

            // Since this is our first connection we need more nodes.
            // So we ask the node to give us a list of different nodes.
            connection.p2p.onConnect = () => {
                this.connectToMoreNodes();
            }

            // Now completely connect to it.
            // And remember the node Id.
            connection.p2p.connect(response.sdp);
            this.connections[connectionIndex].nodeId = response.nodeId;
        }
    }

    // Peer handeling events

    private onPeerClose(peerId: string) {
        const disconnectedConnection = this.connections.findIndex(connection => connection.p2p.id === peerId);
        
        console.log('[] Disconnected with NodeId -> ', this.connections[disconnectedConnection].nodeId);

        // Remove from array
        this.connections.splice(disconnectedConnection, 1);

        // Maybe some meganism to re connect to a different node?
        this.connectToMoreNodes();
    }

    private onPeerData(data: Uint8Array, peerId: string) {

    }

    private onPeerConnected(peerId: string) {
        console.log('[PeerToPeer] A peer is connected');
        this.connectToMoreNodes();
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
        p2p.onSignal = (description) => this.onSignal(description, p2p.id);
        p2p.onClose = () => this.onPeerClose(p2p.id);
        p2p.onData = (data) => this.onPeerData(data, p2p.id);
        p2p.onConnect = () => this.onPeerConnected(p2p.id);
        p2p.open();

        this.connections.push({
            p2p,
        });
    }
}

export default PeerToPeer;
