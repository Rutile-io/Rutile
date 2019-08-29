import * as RLP from 'rlp';
import * as Database from "../services/DatabaseService";
import Transaction from "./Transaction";
import MerkleTree from "./MerkleTree";
import { toHex } from "../core/rvm/utils/hexUtils";
import { numberToHex, hexStringToBuffer } from "../utils/hexUtils";
import BNtype from 'bn.js';
import GlobalState from "./GlobalState";
const BN = require('bn.js');

interface AccountParams {
    address: string;
    nonce: BNtype;
    codeHash: string;
    balance: BNtype;
    storageRoot: string;
}

class Account {
    // Properties inside the Merkle root
    address: string = '';
    balance: BNtype;
    nonce: BNtype;
    codeHash: string;
    storageRoot: string;


    storage: MerkleTree;
    alias: string;
    isFilled: boolean;

    /**
     * Creates an instance of Account.
     *
     * @param {AccountParams} params
     * @memberof Account
     */
    constructor(params: AccountParams) {
        this.address = params.address;
        this.balance = params.balance;
        this.nonce = params.nonce;
        this.codeHash = params.codeHash;
        this.storageRoot = params.storageRoot;
    }

    /**
     * Converts the Account to a buffer using RLP
     *
     * @returns {Promise<Buffer>}
     * @memberof Account
     */
    async toBuffer(): Promise<Buffer> {
        const data = [
            this.address,
            '0x' + this.balance.toString('hex'),
            this.nonce,
            this.codeHash,
            this.storageRoot,
        ];

        return RLP.encode(data);
    }

    static async fromBuffer(accountBuffer: Buffer): Promise<Account> {
        // Sometimes Typescript get's annoying.. (The input is Buffer but the output is Buffer[])
        // which the overload does not support
        const decodedData: any = RLP.decode(accountBuffer);
        const decodedDataBuffer: Buffer[] = decodedData;

        // It's best to compare it with the data from toBuffer().
        // index 0 equals to index 0 on that array
        const address = '0x' + toHex(decodedDataBuffer[0]);
        const balance: BNtype = new BN(decodedDataBuffer[1]);
        const nonce: BNtype = new BN(decodedDataBuffer[2]);
        const codeHash = '0x' + toHex(decodedDataBuffer[3])
        const storageRoot = '0x' + toHex(decodedDataBuffer[4]);

        return new Account({
            address,
            balance,
            codeHash,
            nonce,
            storageRoot,
        });
    }

    /**
     * Gets an account using the address
     *
     * @static
     * @param {string} address
     * @returns {Promise<Account>}
     * @memberof Account
     */
    static async getFromAddress(address: string): Promise<Account> {
        try {
            const data: any = await Database.getById(address);

            if (!data) {
                return null;
            }

            const account = new Account(data);

            return account;
        } catch (error) {
            console.error(error);
            return null;
        }
    }

    /**
     * Finds or creates an Account
     *
     * @static
     * @param {string} address
     * @param {string} [codeHash]
     * @param {string} [creationTransactionId]
     * @returns {Promise<Account>}
     * @memberof Account
     */
    static async findOrCreate(address: string, codeHash?: string): Promise<Account> {
        const account = await Account.getFromAddress(address);

        if (account) {
            return account;
        }

        return Account.create(address, codeHash);
    }

    /**
     * Creates an account
     *
     * @static
     * @param {string} address The address of the new account
     * @param {string} [codeHash] The IPFS Hash if available (Location of the code)
     * @param {string} [transactionId] The transaction id where the contract was created
     * @returns
     * @memberof Account
     */
    static async create(address: string, codeHash?: string): Promise<Account> {
        const dbMapping = await Database.getDatabaseLevelDbMapping();
        const merkleTree = new MerkleTree(dbMapping);
        const storageRoot = await merkleTree.getMerkleRoot();

        const newAccount = new Account({
            address: address,
            storageRoot,
            balance: new BN(0),
            codeHash: codeHash || null,
            nonce: new BN(0),
        });

        return newAccount;
    }
}

export default Account;
