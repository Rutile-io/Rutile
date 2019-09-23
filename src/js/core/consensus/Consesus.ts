import Block from "../../models/Block";
import Wallet from "../../models/Wallet";
import { configuration } from "../../Configuration";
import Transaction from "../../models/Transaction";
import createTempBlock from "./services/createTempBlock";
import { numberToHex } from "../../utils/hexUtils";
import hexZeroPad from "../../utils/hexZeroPad";

const MILESTONE_CONTRACT = '0x0200000000000000000000000000000000000000';

class Consensus {
    /**
     * Gets the current length of the validator set
     *
     * @param {Block} currentBlock
     * @returns {Promise<number>}
     * @memberof Consensus
     */
    async getValidatorsLength(currentBlock: Block): Promise<number> {
        const transaction = new Transaction({
            to: MILESTONE_CONTRACT,
            data: '0x00000003',
        });

        const tempBlock = await createTempBlock(currentBlock, [transaction]);
        const result = (await tempBlock.execute())[0];

        return parseInt(result.returnHex, 16);
    }

    /**
     * Gets the next validator address
     *
     * @param {Block} currentBlock
     * @returns {Promise<string>}
     * @memberof Consensus
     */
    async getNextValidator(currentBlock: Block): Promise<string> {
        const validatorsLength = await this.getValidatorsLength(currentBlock);
        const slotIndex = currentBlock.number % validatorsLength;
        const slotIndexHex = numberToHex(slotIndex);
        const paddedSlotIndex = hexZeroPad(slotIndexHex, 8).slice(2);

        const transaction = new Transaction({
            to: MILESTONE_CONTRACT,
            data: '0x00000002' + paddedSlotIndex,
        });

        const tempBlock = await createTempBlock(currentBlock, [transaction]);
        const result = await tempBlock.execute();

        return result[0].returnHex;
    }
}

export default Consensus;
