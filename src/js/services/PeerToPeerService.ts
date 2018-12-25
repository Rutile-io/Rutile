import getConfig, { configuration } from "../Configuration";
import fetch from 'node-fetch';
import isNodeJs from "./isNodeJs";
// import { URL } from 'url';

interface InitialHttpNodeConnectResponse {
    sdp: RTCSessionDescription,
    nodeId: string,
}

interface AvailableNode {
    nodeId: string,
    nodeUrl: string,
}

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
            const response = await fetch(getConfig('nodesListUrl'));
            const availableNodes: AvailableNode[] = await response.json();

            return availableNodes[Math.floor(Math.random() * availableNodes.length)];
        } catch (error) {
            console.error(error);
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
            url.searchParams.set('nodeId', getConfig('nodeId'));

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
