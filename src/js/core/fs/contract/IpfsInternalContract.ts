import IInternalContract from "../../../models/interfaces/IInternalContract";
import CallMessage from "../../rvm/lib/CallMessage";
import { Results } from "../../rvm/context";
import { toHex } from "../../rvm/utils/hexUtils";
import { hexStringToString } from '../../../utils/hexUtils';

import BNType from 'bn.js';
import { VM_ERROR } from "../../rvm/lib/exceptions";
import Transaction from "../../../models/Transaction";
import GlobalState from "../../../models/GlobalState";
import IpfsController from "../IpfsController";
const BN = require('bn.js');

const MINIMAL_FILEHOST_DEPOSIT: BNType = new BN(2);
const MINIMAL_DEPOSIT: BNType = new BN(1);

/**
 * Internal contract for the IPFS implementation
 *
 * data parameters
 *
 * [0 - 4] Always equals the selector of the function
 *
 * 0x00 00 00 01
 * Deposit to file
 * Params:
 * [5 - 25] Address of the register
 * value: Minimal of MINIMAL_DEPOSIT
 *
 * 0x00 00 00 02
 * Register as file host
 * Params:
 * [5 - 25] Address of the register
 * value: Minimal of MINIMAL_DEPOSIT
 *
 * @class IpfsInteralContract
 * @implements {IInternalContract}
 */
class IpfsInteralContract implements IInternalContract {
    callMessage: CallMessage;
    transaction: Transaction;
    ipfsController: IpfsController;
    results: Results = {
        exception: 0,
        exceptionError: null,
        gasUsed: 0,
        outputRoot: '0x',
        return: new Uint8Array(),
        returnHex: '0x',
        createdAddress: false
    };

    async depositToFile(): Promise<Results> {
        if (this.callMessage.value.lt(MINIMAL_DEPOSIT)) {
            this.results.exceptionError = VM_ERROR.REVERT;
            return this.results;
        }

        // Read the last part of the input data and get the ipfs hash
        const ipfsHashBytes = this.callMessage.inputData.slice(4, 51);
        const ipfsHash = hexStringToString('0x' + toHex(ipfsHashBytes));

        await this.ipfsController.addFile(ipfsHash, this.callMessage.sender, this.callMessage.value);

        this.results.outputRoot = await this.ipfsController.merkleTree.getMerkleRoot();
        return this.results;
    }

    async registerAsFileHost(): Promise<Results> {
        if (this.callMessage.value.lt(MINIMAL_FILEHOST_DEPOSIT)) {
            this.results.exceptionError = VM_ERROR.REVERT;
            return this.results;
        }

        // Read the last part of the input data and get the ipfs hash
        const ipfsHashBytes = this.callMessage.inputData.slice(4, 51);
        const ipfsHash = hexStringToString('0x' + toHex(ipfsHashBytes));

        await this.ipfsController.addHost(ipfsHash, this.callMessage.sender);

        console.log('Registered ' + this.callMessage.sender+ 'as host for: ' + ipfsHash);
        this.results.outputRoot = await this.ipfsController.merkleTree.getMerkleRoot();
        return this.results;
    }

    private async selectFunction(selector: Uint8Array): Promise<Results> {
        const selectorHex = '0x' + toHex(selector);
        if (selectorHex === '0x00000001') {
            return this.depositToFile();
        }
        if (selectorHex === '0x00000002'){
            return this.registerAsFileHost();
        }

        return this.results;
    }

    async execute(callMessage: CallMessage, globalState: GlobalState, transaction: Transaction): Promise<Results> {
        const selector = callMessage.inputData.slice(0, 4);

        this.callMessage = callMessage;
        this.transaction = transaction;

        // Just in case the contract failed we are going to set the input root as the new outputroot
        const toAccount = await globalState.findOrCreateAccount(callMessage.destination);

        this.ipfsController = new IpfsController();
        await this.ipfsController.init(toAccount.storageRoot);

        const result = await this.selectFunction(selector);

        result.returnHex = '0x' + toHex(result.return);
        result.outputRoot = await this.ipfsController.merkleTree.getMerkleRoot();

        return result;
    }
}

export default IpfsInteralContract;
