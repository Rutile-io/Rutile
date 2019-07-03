import getConfig, { configuration } from "../../../Configuration";
import fetch from 'node-fetch';
import isNodeJs from "../../../services/isNodeJs";
import * as Logger from 'js-logger';
// import { URL } from 'url';

interface InitialHttpNodeConnectResponse {
    sdp: RTCSessionDescription,
    nodeId: string,
}

interface AvailableNode {
    nodeId: string,
    nodeUrl: string,
    dbUrl: string,
}

// TODO: A better way of peer discovery..
const alreadyConnectedTo: string[] = [];

class PeerToPeerService {
    /**
     * Gets all nodes from a provided service and returns one host that is possible to connect to.
     *
     * @static
     * @returns {Promise<AvailableNode>}
     * @memberof PeerToPeerService
     */
    static async getRandomAvailableHost(): Promise<AvailableNode> {
        try {
            const response = await fetch(configuration.nodesListUrl);
            const availableNodes: AvailableNode[] = await response.json();

            const node = availableNodes[Math.floor(Math.random() * availableNodes.length)];

            if (alreadyConnectedTo.includes(node.nodeUrl)) {
                return null;
            }

            alreadyConnectedTo.push(node.nodeUrl);

            return node;
        } catch (error) {
            Logger.error(`Could not connect to ${configuration.nodesListUrl}`);
            return null;
        }
    }

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
            const availableNode = await PeerToPeerService.getRandomAvailableHost();

            if (!availableNode) {
                return null;
            }

            let url = null;

            if (isNodeJs()) {
                const URL = require('url').URL;
                url = new URL(`${availableNode.nodeUrl}/requestSdpConnection`);
            } else {
                url = new URL(`${availableNode.nodeUrl}/requestSdpConnection`);
            }

            url.searchParams.set('sdp', JSON.stringify(sessionDescription))
            url.searchParams.set('nodeId', configuration.nodeId);

            const response = await fetch(url.toString());
            const data: InitialHttpNodeConnectResponse = (await response.json()).Result;

            if (data.nodeId === configuration.nodeId) {
                return null;
            }

            return data;
        } catch (error) {
            console.error(error);
            return null;
        }
    }
}

export default PeerToPeerService;
