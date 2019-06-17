import Network from './core/network/Network';
import Ipfs from './services/wrappers/Ipfs';
import { configuration } from './Configuration';
import Transaction from './models/Transaction';
import Dag from './core/dag/Dag';
import EventHandler from './services/EventHandler';
import KeyPair from './models/KeyPair';
import Account from './models/Account';
import byteArrayToString from './utils/byteArrayToString';
import Wallet from './models/Wallet';
import * as Database from './services/DatabaseService';
import * as Logger from 'js-logger';
import Block from './models/Block';
import { NodeType } from './models/interfaces/IConfig';
import Validator from './core/milestone/Validator';

/**
 * Glue between all core modules.
 * Coordinates the core modules and exposes an API to the user.
 *
 * @class Rutile
 */
class Rutile {
    private network: Network;
    public ipfs: Ipfs;
    public dag: Dag;
    public eventHandler: EventHandler;
    public validator: Validator;

    static get Database() {
        return Database;
    }

    static get Transaction() {
        return Transaction;
    }

    static get Block() {
        return Block;
    }

    static get KeyPair() {
        return KeyPair;
    }

    static get Wallet() {
        return Wallet;
    }

    static get Account() {
        return Account;
    }

    constructor() {
        this.ipfs = Ipfs.getInstance(configuration.ipfs);
        this.eventHandler = new EventHandler();
    }

    async start() {
        try {
            Logger.info('Starting Rutile');
            // Boot up our peer to peer network
            this.network = new Network();
            await this.network.open();
        } catch (error) {
            console.error('Could not connect to peers: ', error);
        }

        this.dag = new Dag(this.network);
        await this.dag.synchronise();

        if (configuration.nodeType === NodeType.FULL) {
            this.validator = new Validator(this.dag);
            this.validator.start();
        }
    }

    async deploy(binary: Uint8Array): Promise<string> {
        return this.ipfs.add(byteArrayToString(binary));
    }

    async sendBlock(block: Block) {
        return this.dag.submitBlock(block);
    }

    async getAccountBalance(address: string) {
        if (!this.dag) {
            throw new Error('Rutile should be started first');
        }

        const balances = await this.dag.getAccountBalance(address);

        if (!balances[address]) {
            return '0';
        }

        return balances[address].toString();
    }
}

export default Rutile;


