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
    lastNodesConnectBroadcastTimestamp: number = 0;
    handledPeerConnectMessages: ConnectOfferMessage[] = [];

    constructor() {
        setInterval(this.cleanup.bind(this), configuration.timeoutBeforeCleanup);
        setInterval(this.connectToMoreNodes.bind(this), configuration.timeoutBeforeCleanup);
    }

    private cleanup(): void {
        const now = Date.now();

        console.info('[PeerToPeer] Cleanup in progress..');

        this.handledPeerConnectMessages.forEach((message, index) => {
            if ((configuration.timeoutBeforeCleanup + message.createdTimestamp) <= now) {
                this.handledPeerConnectMessages.splice(index, 1);
            }
        });
    }

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

            peer.onData = (data) => this.onPeerData(data, peer.id);
            peer.onClose = () => this.onPeerClose(peer.id);
            peer.onConnect = () => this.onPeerConnected(peer.id);
            peer.onError = (error) => this.onPeerError(error, peer.id);
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
    public async connectToMoreNodes() {
        const now = Date.now();
        const lastCheckDelta = now - this.lastNodesConnectBroadcastTimestamp;

        if (lastCheckDelta <= configuration.maximumNodeAskConnectTime) {
            return;
        }

        this.lastNodesConnectBroadcastTimestamp = Date.now();
        console.log('[PeerToPeer] Requesting more connections');

        // Only get connections that are actually connected and not just offers
        const connectedNodes = this.connections.filter(connection => !!connection.nodeId && connection.p2p.isConnected);

        if (connectedNodes.length >= configuration.maximumNodes) {
            console.warn('Already connected to maximum nodes');
            return;
        }

        if (!connectedNodes.length) {
            console.error('No connections found, could not connect to more nodes');
            return;
        }

        // Ask for each node a pass through offer.
        const connectionsNeeded = configuration.maximumNodes - connectedNodes.length;

        if (connectionsNeeded === 0) {
            console.log('[PeerToPeer] Enough connections established');
            return;
        }

        // Loop the amount of needed connections
        // We chose already open connections at random to create an offer.
        const peer = new P2P(true);

        peer.onSignal = (signal) => {
            const randomConnection = connectedNodes[Math.floor(Math.random() * connectedNodes.length)];  
            const message: ConnectOfferMessage = {
                // Star means we do not care which node it connects to
                toNodeId: '*',
                fromNodeId: configuration.nodeId,
                sdp: signal,
                type: 'CONNECT_OFFER',
                peerId: peer.id,
                createdTimestamp: Date.now(),
            };
            
            randomConnection.p2p.sendData(JSON.stringify(message));
        }

        peer.onData = (data) => this.onPeerData(data, peer.id);
        peer.onClose = () => this.onPeerClose(peer.id);
        peer.onConnect = () => this.onPeerConnected(peer.id);
        peer.onError = (error) => this.onPeerError(error, peer.id);

        peer.open();
        
        this.connections.push({
            p2p: peer,
        });
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
                console.log('[PeerToPeer]: First connection has been made');
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
        
        console.log('[PeerToPeer] Disconnected with NodeId -> ', this.connections[disconnectedConnection].nodeId);

        // Remove from array
        this.connections.splice(disconnectedConnection, 1);

        // Maybe some meganism to re connect to a different node?
        setTimeout(() => this.connectToMoreNodes(), 1000);
    }

    createPeer(initiator = false, onSignal = (sdp: RTCSessionDescriptionInit) => {}) {
        const peer = new P2P(initiator);

        peer.onClose = () => this.onPeerClose(peer.id);
        peer.onConnect = () => this.onPeerConnected(peer.id);
        peer.onData = (data) => this.onPeerData(data, peer.id);
        peer.onSignal = (sdp) => onSignal(sdp);
        peer.onError = (error) => this.onPeerError(error, peer.id);

        peer.open();

        return peer;
    }

    /**
     * Handles CONNECT_OFFER messages.
     * It simply checks if it already has the connection and if it doesn't add it
     * 
     *
     * @param {ConnectOfferMessage} connectOfferMessage
     * @memberof PeerToPeer
     */
    handlePeerConnectPassthrough(connectOfferMessage: ConnectOfferMessage, fromPeerId: string) {
        // Make sure we did not already sent this message along
        // Otherwise we are getting inside an infinite loop
        const isAlreadyHandled = this.handledPeerConnectMessages.find(message => message.fromNodeId === connectOfferMessage.fromNodeId && message.toNodeId === connectOfferMessage.toNodeId);

        if (isAlreadyHandled) {
            console.log('[PeerToPeer] Message from node already handled, giving node a timeout.');
            return;
        }

        this.handledPeerConnectMessages.push(connectOfferMessage);

        // * means that every node can act upon this message.
        if (connectOfferMessage.toNodeId === '*') {
            const nodeConnection = this.connections.find(connection => connection.nodeId === connectOfferMessage.fromNodeId);

            // We do not have a connection with this node, we can accept it and send them an offer response.
            if (!nodeConnection) {
                const peer = this.createPeer(false, (sdp) => {
                    // Find our peer that gave us this data
                    const connection = this.connections.find(connection => connection.p2p.id === fromPeerId);

                    if (!connection) {
                        console.error('[PeerToPeer] Could not find connection that gave the offer to this node');
                        return;
                    }

                    // Send back the message with our response to the offer.
                    const message: ConnectOfferMessage = {
                        fromNodeId: configuration.nodeId,
                        toNodeId: connectOfferMessage.fromNodeId,
                        sdp,
                        type: 'CONNECT_OFFER',
                        peerId: connectOfferMessage.peerId,
                        createdTimestamp: connectOfferMessage.createdTimestamp,
                    }

                    connection.p2p.sendData(JSON.stringify(message));
                });

                peer.connect(connectOfferMessage.sdp);

                this.connections.push({
                    nodeId: connectOfferMessage.fromNodeId,
                    p2p: peer,
                });
            } else {
                // We already have a connection with this node.
                // We can pass it along..
                // Send it to every peer but not the peer we got it from.

                // First get all active connections that is not the peer we got the message from.
                const activeConnections = this.connections.filter(connection => connection.nodeId && connection.p2p.id !== fromPeerId && connection.p2p.isConnected);

                // Pass through this message to the other connections
                activeConnections.forEach((connection) => {
                    connection.p2p.sendData(JSON.stringify(connectOfferMessage));
                });
            }
        } else {
            // We should look for an nodeId that has this id, if it doesn't redirect it through.
            // TODO: And maybe if there where too many passthrough fail the connection, and stop passing it.
            if (connectOfferMessage.toNodeId === configuration.nodeId) {
                // We are the receiving end of this message. We can connect to it now.
                if (connectOfferMessage.sdp.type !== 'answer') {
                    console.error('[PeerToPeer] Could not connect to a non answer sdp message');
                    return;
                }

                // Since it's an answer, we've created the offer. Let's find it and connect to it.
                const connection = this.connections.find(connection => connection.p2p.id === connectOfferMessage.peerId);

                if (!connection) {
                    console.error(`[PeerToPeer] Could not find connection for node id [${connectOfferMessage.peerId}]`);
                    return;
                }

                connection.p2p.connect(connectOfferMessage.sdp);
                console.log('WE ARE THE RECEIVING END OF THIS MESSAGE', connectOfferMessage);
            } else {
                const rightNodeConnection = this.connections.find(connection => connection.nodeId === connectOfferMessage.toNodeId);

                if (!rightNodeConnection) {
                    // First get all active connections that is not the peer we got the message from.
                    // We should also not send it back to the node where it came from.
                    const activeConnections = this.connections.filter(connection => connection.nodeId && connection.p2p.id !== fromPeerId && connection.p2p.isConnected && connection.p2p.id !== connectOfferMessage.fromNodeId);
                    
                    activeConnections.forEach((connection) => {
                        connection.p2p.sendData(JSON.stringify(connectOfferMessage));
                    });

                    return;
                }

                // We got the right node in our list. Simply give the message to it.
                rightNodeConnection.p2p.sendData(JSON.stringify(connectOfferMessage));
            }
        }
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
    private onPeerData(data: Uint8Array, peerId: string) {
        const commando = data.toString();

        try {
            const dataParsed = JSON.parse(commando);

            if (dataParsed.type === 'CONNECT_OFFER') {
                this.handlePeerConnectPassthrough(dataParsed, peerId);
            }
        } catch (error) {
            console.log('[onPeerData] error -> ', error);
        }
    }

    private onPeerConnected(peerId: string) {
        console.log('[PeerToPeer] A peer is connected');
        setTimeout(() => this.connectToMoreNodes(), 1000)
    }

    private onPeerError(error: any, peerId: string) {
        console.log('[OnPeerError] error -> ', error);
        // Something went wrong with the peer, best is to try connect to more..
        setTimeout(() => this.connectToMoreNodes(), 1000);
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
        p2p.onError = (error) => this.onPeerError(error, p2p.id);
        p2p.open();

        this.connections.push({
            p2p,
        });
    }

    async broadcast(messageType: string, data: string) {
        this.connections.forEach((connect) => {
            // Make sure it's still connected
            if (!connect.p2p.isConnected) {
                return;
            }

            connect.p2p.sendData(JSON.stringify(data));
        });
    }
}

export default PeerToPeer;
