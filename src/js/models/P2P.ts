import isNodeJs from '../services/isNodeJs';

declare var __non_webpack_require__: any;

const Peer = require('simple-peer');
const uuid = require('uuid/v4');

class P2P {
    private peer: any;
    private isInitiator: boolean = false;
    public id: string;

    constructor(initiator = false) {
        this.id = uuid();
        this.isInitiator = initiator;
    }

    public onClose() {
        console.log('Closing!');
    }

    public onConnect() {
        this.peer.send('WHATEVER :)');
    }

    public onSignal(sessionDescription: RTCSessionDescriptionInit) {
        console.log(JSON.stringify(sessionDescription));
    }

    public onData(data: Uint8Array) {
        console.log('[onData] :: data -> ', data);
    }

    /**
     * Connects to a different node. 
     *
     * @param {RTCSessionDescription} sessionDescription
     * @memberof P2P
     */
    connect(sessionDescription: RTCSessionDescription) {
        this.peer.signal(sessionDescription);
    }

    open() {
        const peerConfig = {
            initiator: this.isInitiator,
            trickle: false
        };

        // Node requires a polyfill for WebRTC
        if (isNodeJs()) {
            const wrtc = __non_webpack_require__('wrtc');
            peerConfig['wrtc'] = wrtc;
        }

        this.peer = new Peer(peerConfig);
        
        this.peer.on('connect', this.onConnect.bind(this));
        this.peer.on('signal', this.onSignal.bind(this));
        this.peer.on('data', this.onData.bind(this));
        this.peer.on('close', this.onClose.bind(this));
    }
}

export default P2P;