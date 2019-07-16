import IInternalContract from "../../../models/interfaces/IInternalContract";
import CallMessage from "../../rvm/lib/CallMessage";
import { Results } from "../../rvm/context";
import { toHex } from "../../rvm/utils/hexUtils";
import BNType from 'bn.js';
import { VM_ERROR } from "../../rvm/lib/exceptions";
import Transaction from "../../../models/Transaction";
import MilestoneSlots from "./MilestoneSlots";
const BN = require('bn.js');

const MINIMAL_DEPOSIT: BNType = new BN(32);

/**
 * Internal contract for the Proof of Stake implementation
 *
 * data parameters
 *
 * [0 - 4] Always equals the selector of the function
 *
 * 0x00 00 00 01
 * Register as Validator
 * Params:
 * [5 - 25] Address of the register
 * value: Minimal of MINIMAL_DEPOSIT
 *
 *
 *
 * @class MilestoneInternalContract
 * @implements {IInternalContract}
 */
class MilestoneInternalContract implements IInternalContract {
    callMessage: CallMessage;
    transaction: Transaction;
    milestoneSlots: MilestoneSlots;
    results: Results = {
        exception: 0,
        exceptionError: null,
        gasUsed: 0,
        outputRoot: '0x',
        return: new Uint8Array(),
        returnHex: '0x',
        createdAddress: false,
    };

    async registerAsValidator(): Promise<Results> {
        if (this.callMessage.value.lt(MINIMAL_DEPOSIT)) {
            this.results.exceptionError = VM_ERROR.REVERT;
            return this.results;
        }

        const address = '0x' + toHex(this.callMessage.inputData.slice(4));

        if (address.length !== 42) {
            this.results.exceptionError = VM_ERROR.REVERT;
            return this.results;
        }

        // Each deposit put the address in 1 slot
        await this.milestoneSlots.addSlot(address, this.callMessage.value);
        const outputRoot = await this.milestoneSlots.merkleTree.getMerkleRoot();

        this.results.outputRoot = outputRoot;

        return this.results;
    }

    async getNextValidator() {
        // We use the previous milestone as a seed
    }

    private async selectFunction(selector: Uint8Array): Promise<Results> {
        const selectorHex = '0x' + toHex(selector);

        if (selectorHex === '0x00000001') {
            return this.registerAsValidator();
        }

        return this.results;
    }

    async execute(callMessage: CallMessage, transaction: Transaction): Promise<Results> {
        const selector = callMessage.inputData.slice(0, 4);

        this.callMessage = callMessage;
        this.transaction = transaction;

        // Just in case the contract failed we are going to set the input root as the new outputroot
        this.results.outputRoot = callMessage.inputRoot;

        this.milestoneSlots = new MilestoneSlots(transaction);
        await this.milestoneSlots.init(callMessage.inputRoot);

        return this.selectFunction(selector);
    }
}

export default MilestoneInternalContract;