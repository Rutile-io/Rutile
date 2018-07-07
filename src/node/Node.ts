import * as Peer from 'peerjs';

const PEER_NETWROK_KEY = 'lwjd5qra8257b9';

class Node {
    peer:any = null;
    connection: any = null;

    constructor() {
        this.peer = new Peer({key: PEER_NETWROK_KEY, debug: 3});
        this.peer.on('open', (id: string) => {
            console.log(id);
        })
    }

    connect() {

        console.log('Woop');
        // this.peer.connect();

    }
}

export default Node;
