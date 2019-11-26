import Network from './core/network/Network';
import Ipfs from './services/wrappers/Ipfs';
import { configuration, setConfig } from './Configuration';
import Transaction from './models/Transaction';
import Chain from './core/chain/Chain';
import EventHandler from './services/EventHandler';
import KeyPair from './models/KeyPair';
import Account from './models/Account';
import byteArrayToString from './utils/byteArrayToString';
import Wallet from './models/Wallet';
import * as Database from './services/DatabaseService';
import * as Logger from 'js-logger';
import IConfig, { NodeType } from './models/interfaces/IConfig';
import Validator from './core/milestone/Validator';
import GlobalState from './models/GlobalState';
import Block from './models/Block';
import RpcServer from './core/rpc/RpcServer';
import isNodeJs from './services/isNodeJs';
import { startIpfsClient } from './services/IpfsService';

/**
 * Glue between all core modules.
 * Coordinates the core modules and exposes an API to the user.
 *
 * @class Rutile
 */
class Rutile {
    private network: Network;
    public ipfs: Ipfs;
    public chain: Chain;
    public eventHandler: EventHandler;
    public validator: Validator;

    static get Database() {
        return Database;
    }

    static get Transaction() {
        return Transaction;
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

    get Ipfs(){
        return this.ipfs;
    }

    constructor(options?: IConfig) {
        if (options) {
            setConfig(options);
        }

        this.ipfs = Ipfs.getInstance(configuration.ipfs);
        this.eventHandler = new EventHandler();
    }

    async start() {
        let ipfsNode: any = null;

        try {
            Logger.info('🚀 Starting Rutile');

            // Start the database
            await Database.startDatabase();

            Logger.info(`📦 Booting up IPFS node..`);
            ipfsNode = await startIpfsClient();
            Logger.info(`📦 IPFS is running`);

            // Boot up our peer to peer network
            this.network = new Network();
            await this.network.open();

        } catch (error) {
            if (error) {
                console.error('Could not connect to peers: ', error);
            }
        }

        this.chain = new Chain(this.network);
        await this.chain.synchronise();

        if (isNodeJs()) {
            const rpcServer = new RpcServer(this.chain, ipfsNode);
            rpcServer.open(8545);
        }

        if (configuration.nodeType === NodeType.FULL) {
            this.validator = new Validator(this.chain);
            this.validator.start();
        }
    }

    /**
     * Deploys a WASM contract to the network
     *
     * @param {Uint8Array} binary
     * @returns {Promise<string>}
     * @memberof Rutile
     */
    async deploy(binary: Uint8Array): Promise<string> {
        return this.ipfs.add(byteArrayToString(binary));
    }

    /**
     * Sends a transaction to the chain
     *
     * @param {Transaction} transaction
     * @param {KeyPair} keyPair
     * @returns
     * @memberof Rutile
     */
    async sendTransaction(transaction: Transaction, keyPair: KeyPair) {
        return this.chain.submitTransaction(transaction, keyPair);
    }

    /**
     * Gets the current balance of a given address
     *
     * @param {string} address
     * @returns
     * @memberof Rutile
     */
    async getAccountBalance(address: string, blockNumber: string = 'latest') {
        const account = await this.getAccount(address, blockNumber);

        return account.balance;
    }

    async getAccount(address: string, blockNumber: string = 'latest') {
        if (!this.chain) {
            throw new Error('Rutile should be started first');
        }

        let block: Block = null;

        if (blockNumber === 'latest') {
            block = await Block.getLatest();
        }

        if (!block) {
            throw new Error(`Block ${blockNumber} could not be found`);
        }

        const state = await GlobalState.create(block.stateRoot);
        const account = await state.findOrCreateAccount(address);
        return account;
    }
}

export default Rutile;


