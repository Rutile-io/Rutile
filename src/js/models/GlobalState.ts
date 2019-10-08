import MerkleTree from "./MerkleTree";
import { getDatabaseLevelDbMapping } from "../services/DatabaseService";
import Account from "./Account";

/**
 * Global state handler
 * The global state is all accounts combined
 *
 * @class GlobalState
 */
class GlobalState {
    storage: MerkleTree;
    root: string;

    /**
     * Creates an instance of GlobalState.
     *
     * @param {string} startingRoot
     * @memberof GlobalState
     */
    constructor(startingRoot: string) {
        this.root = startingRoot;
    }

    /**
     * Initialises the global state
     *
     * @memberof GlobalState
     */
    async init() {
        const dbMapping = await getDatabaseLevelDbMapping();
        this.storage = new MerkleTree(dbMapping, this.root);
    }

    /**
     * Updates the global state trie with a given account
     *
     * @param {Account} account
     * @returns {Promise<void>}
     * @memberof GlobalState
     */
    async update(account: Account): Promise<void> {
        if (!account) {
            throw new Error('Account must be given before updating the global state');
        }

        const buffer = await account.toBuffer();

        // Either overwrites the account address or creates a new one.
        await this.storage.put(account.address.toLowerCase(), buffer);
    }

    /**
     * Finds or creates an account inside the merkle tree
     * Does not store anything
     *
     * @param {string} address
     * @param {string} [code]
     * @returns {Promise<Account>}
     * @memberof GlobalState
     */
    async findOrCreateAccount(address: string, code?: string): Promise<Account> {
        if (!address) {
            throw new Error('Address should be given');
        }

        const lowerCaseAddress = address.toLowerCase();
        const buffer: Buffer = await this.storage.get(lowerCaseAddress);

        if (!buffer) {
            const newAccount = await Account.create(lowerCaseAddress, this, code);
            await this.update(newAccount);
            return newAccount;
        }

        return Account.fromBuffer(address, buffer, this);
    }

    /**
     * Gets the current Merkle root
     *
     * @returns {Promise<string>}
     * @memberof GlobalState
     */
    getMerkleRoot(): Promise<string> {
        return this.storage.getMerkleRoot();
    }

    /**
     * Creates a new instance of global state
     *
     * @static
     * @param {string} stateRoot
     * @returns
     * @memberof GlobalState
     */
    static async create(stateRoot: string) {
        const globalState = new GlobalState(stateRoot);
        await globalState.init();

        return globalState;
    }
}

export default GlobalState;
