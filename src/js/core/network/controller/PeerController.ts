import PeerToPeerService from "../services/PeerToPeerService";
import { URL } from 'url';
import { TransactionMessage } from "../lib/types/MessageType";
import Transaction from "../../../models/Transaction";
import Peer from '../lib/Peer';
import { configuration } from "../../../Configuration";
import isNodeJs from "../../../services/isNodeJs";


interface Connection {
    // Offers don't have yet a filled in nodeId,
    nodeId?: string,
    peer: Peer,
}

export interface PeerDataMessage {
    data: {
        type: string;
        value: string;
    }
}

class PeerController {
    connections: Connection[] = [];

    /**
     * Handles the HTTP Requests (Mostly for Node)
     *
     * @private
     * @param {*} req
     * @param {*} res
     * @returns
     * @memberof PeerController
     */
    private handleHttpRequest(req: any, res: any) {
        res.setHeader('Access-Control-Allow-Origin', '*');

        if (req.url === '/nodes') {
            res.writeHead(200, {
                'Content-Type': 'application/json'
            });
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
            const peer = new Peer(false);

            peer.onSignal = (offerSignal) => {
                res.writeHead(200, {
                    'Content-Type': 'application/json',
                });
                res.end(JSON.stringify({
                    Result: {
                        sdp: offerSignal,
                        nodeId: configuration.nodeId,
                    }
                }));
            }

            peer.onData = (data) => this.onPeerData(data, peer.id);
            peer.onClose = () => this.onPeerClose(peer.id);
            peer.onConnect = () => this.onPeerConnected(peer.id);
            peer.onError = (error) => this.onPeerError(error, peer.id);
            peer.open();
            peer.connect(descriptionInit)

            // Now use the offer that was given and connect to that node.
            this.connections.push({
                peer,
                nodeId,
            });
         } else {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('Page not found.');
        }
    }

    private async onSignal(sessionDescription: RTCSessionDescriptionInit, peerId: string) {
        const response =  await PeerToPeerService.initialHttpNodeConnect(sessionDescription);
        const connectionIndex = this.connections.findIndex(connection => connection.peer.id === peerId);
        const connection = this.connections[connectionIndex];

        if (!response) {
            throw new Error('No session description received, not adding connection');
        }

        if (!connection) {
            throw new Error('Could not find connection, not adding');
        }

        // Since this is our first connection we need more nodes.
        // So we ask the node to give us a list of different nodes.
        connection.peer.onConnect = () => {
            console.log('[PeerToPeer]: First connection has been made');
        }

        // Now completely connect to it.
        // And remember the node Id.
        connection.peer.connect(response.sdp);
        this.connections[connectionIndex].nodeId = response.nodeId;
    }

    // Peer handeling events

    private onPeerClose(peerId: string) {
        const disconnectedConnection = this.connections.findIndex(connection => connection.peer.id === peerId);

        console.log('[PeerToPeer] Disconnected with NodeId -> ', this.connections[disconnectedConnection].nodeId);

        // Remove from array
        this.connections.splice(disconnectedConnection, 1);
    }

    createPeer(initiator = false, onSignal = (sdp: RTCSessionDescriptionInit) => {}) {
        const peer = new Peer(initiator);

        peer.onClose = () => this.onPeerClose(peer.id);
        peer.onConnect = () => this.onPeerConnected(peer.id);
        peer.onData = (data) => this.onPeerData(data, peer.id);
        peer.onSignal = (sdp) => onSignal(sdp);
        peer.onError = (error) => this.onPeerError(error, peer.id);

        peer.open();

        return peer;
    }

    /**
     * Handles the peer data
     * TOOD: Make sure we are not parsing huge strings.
     *
     * @private
     * @param {Uint8Array} data
     * @param {string} peerId
     * @memberof PeerToPeer
     */
    private async onPeerData(data: Uint8Array, peerId: string) {
        try {
            const commando = data.toString();
            const dataParsed: any = JSON.parse(commando);
            const peerDataMessage: PeerDataMessage = {
                data: dataParsed,
            }

            // this.eventHandler.trigger(PEER_TO_PEER_ON_PEER_DATA, peerDataMessage);
        } catch (error) {
            console.log('[onPeerData] error -> ', error);
        }
    }

    private onPeerConnected(peerId: string) {
        console.log(`[PeerToPeer] A peer is connected (Connected: ${this.connections.length})`);
    }

    private onPeerError(error: any, peerId: string) {
        console.log('[OnPeerError] error -> ', error);
    }

    /**
     * Opens the connection with peer to peer.
     * If it's running on node we will create a simple stung server
     * where all webrtc connections are passed through.
     *
     * @memberof PeerToPeer
     */
    open(): Promise<string> {
        return new Promise((resolve, reject) => {
            if (isNodeJs()) {
                // TODO: Use HTTPS here instead of HTTP
                const http = require('http');
                const httpServer = http.createServer(this.handleHttpRequest.bind(this));

                httpServer.listen(configuration.port, '0.0.0.0');

                console.log(`[Peer]Listening on port ${configuration.port}`);
            }

            // Since we are just opening the node we have to create an offer.
            const peer = new Peer(true);

            peer.onSignal = async (description) => {
                try {
                    await this.onSignal(description, peer.id);
                } catch (error) {
                    reject(error);
                }
            }

            peer.onClose = () => this.onPeerClose(peer.id);
            peer.onData = (data) => this.onPeerData(data, peer.id);
            peer.onConnect = () => {
                this.onPeerConnected(peer.id);
                resolve(peer.id);
            }

            peer.onError = (error) => {
                this.onPeerError(error, peer.id);
                reject(error);
            }

            peer.open();

            this.connections.push({
                peer,
            });
        });
    }

    async broadcastTransaction(transaction: Transaction) {

        const message: TransactionMessage = {
            type: 'TRANSACTION',
            value: transaction.toRaw(),
        };

        await this.broadcast(JSON.stringify(message));
    }

    async broadcast(data: string) {
        this.connections.forEach((connect) => {
            // Make sure it's still connected
            if (!connect.peer.isConnected) {
                return;
            }

            connect.peer.sendData(data);
        });
    }

    /**
     * Sends data to a single peer
     *
     * @param {string} nodeId
     * @param {string} data
     * @memberof PeerToPeer
     */
    sendDataToPeer(nodeId: string, data: string) {
        const connection = this.connections.find(connection => connection.nodeId === nodeId);

        if (!connection.peer.isConnected) {
            throw new Error(`Node ${nodeId} is not connected`);
        }

        connection.peer.sendData(data);
    }
}

export default PeerController;
