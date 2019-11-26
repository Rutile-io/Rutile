import IInternalContract from "../../../models/interfaces/IInternalContract";
import CallMessage from "../../rvm/lib/CallMessage";
import { Results } from "../../rvm/context";
import { toHex } from "../../rvm/utils/hexUtils";
import { hexStringToString } from '../../../utils/hexUtils';

import { getById, createOrUpdate} from '../../../services/DatabaseService'

import BNType from 'bn.js';
import { VM_ERROR } from "../../rvm/lib/exceptions";
import Transaction from "../../../models/Transaction";
import GlobalState from "../../../models/GlobalState";
const BN = require('bn.js');

const MINIMAL_FILEHOST_DEPOSIT: BNType = new BN(1);
const MINIMAL_DEPOSIT: BNType = new BN(0.001);

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
    results: Results = {
        exception: 0,
        exceptionError: null,
        gasUsed: 0,
        outputRoot: '0x',
        return: new Uint8Array(),
        returnHex: '0x',
        createdAddress: null,
    };

    async depositToFile(): Promise<Results> {
        if (this.callMessage.value.lt(MINIMAL_DEPOSIT)) {
            this.results.exceptionError = VM_ERROR.REVERT;
            return this.results;
        }

        // Read the last part of the input data and get the ipfs hash
        const ipfsHashBytes = this.callMessage.inputData.slice(4, 51);
        const ipfsHash = hexStringToString('0x' + toHex(ipfsHashBytes));

        var ipfsFileObject = {
            hash: ipfsHash,
            value: new BN(0),
            hosts: [] as any
        };

        const dbIpfsFile = await getById(ipfsHash);
        if(dbIpfsFile != null){
            ipfsFileObject = dbIpfsFile;

            // Convert saved string to BN
            ipfsFileObject.value = new BN(dbIpfsFile.value);
        }

        // Add the stored Rutile to the file
        ipfsFileObject.value = ipfsFileObject.value.add(this.callMessage.value);

        // Convert BN to string before we create or update
        ipfsFileObject.value = ipfsFileObject.value.toString();
        createOrUpdate(ipfsHash, ipfsFileObject);

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

        // Get the ipfs file in the db, if it's not found -> revert
        var ipfsFileObject = await getById(ipfsHash);
        if(ipfsFileObject == null){
            this.results.exceptionError = VM_ERROR.REVERT;
            return this.results;
        }

        // Create a new host for the file
        var host = {
            address: this.callMessage.sender
        }

        // Add to the array of hosts
        ipfsFileObject.hosts.push(host);

        // Update the object
        createOrUpdate(ipfsHash, ipfsFileObject);
        console.log('Registered ' + this.callMessage.sender+ 'as host for: ' + ipfsHash);

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

        return this.selectFunction(selector);
    }
}

export default IpfsInteralContract;
