import isNodeJs from "../../services/isNodeJs";
import * as Logger from 'js-logger';
import Network from "./Network";
import { configuration } from "../../Configuration";

class PeerHttpServer {
    network: Network;

    constructor(network: Network) {
        this.network = network;
    }

    handleHttpRequest(req: any, res: any) {
        res.setHeader('Access-Control-Allow-Origin', '*');

        if (req.url.includes('/requestSdpConnection')) {
            const requestUrl = new URL('http://localhost.com' + req.url);

            const sdp = requestUrl.searchParams.get('sdp');
            const nodeId = requestUrl.searchParams.get('nodeId');

            if (!sdp || !nodeId) {
                Logger.debug('Http request was invalid, missing required nodeId or sdp');
                res.writeHead(400, {
                    'Content-Type': 'application/json',
                });

                res.end(JSON.stringify({
                    Message: 'Http request was invalid, missing required nodeId or sdp'
                }));

                return;
            }

            const descriptionInit: RTCSessionDescription = JSON.parse(sdp);

            if (descriptionInit.type !== 'offer') {
                Logger.debug('Http request sdp is not an offer');
                res.writeHead(400, {
                    'Content-Type': 'application/json',
                });

                res.end(JSON.stringify({
                    Message: 'Http request was invalid, sdp is not an offer'
                }));
                return;
            }

            const peer = this.network.createPeer(false, (offerSignal) => {
                res.writeHead(200, {
                    'Content-Type': 'application/json',
                });

                res.end(JSON.stringify({
                    Result: {
                        sdp: offerSignal,
                        nodeId: configuration.nodeId,
                    }
                }));
            });

            peer.connect(descriptionInit);

            this.network.connections.push({
                peer,
                nodeId,
            });
            return;
        }

        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('Page not found.');
    }

    open(port: number) {
        if (!isNodeJs()) {
            throw new Error('Only non-browser nodes can run a HTTP server');
        }

        const http = require('http');
        const httpServer = http.createServer(this.handleHttpRequest.bind(this));

        httpServer.listen(port, '0.0.0.0');

        Logger.info(`Peer HTTP Server listening on port ${port}`);
    }
}

export default PeerHttpServer;
