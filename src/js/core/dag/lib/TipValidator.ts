import * as Logger from 'js-logger';
import BNType from 'bn.js';
import Transaction from "../../../models/Transaction";
import { getTransactionById, getAddressFromTransaction, validateTransaction } from "./services/TransactionService";
import Block from '../../../models/Block';
import { getBlockById } from './services/BlockService';
const BN = require('bn.js');

interface AddressBalancePair {
    [key: string]: BNType;
};

const BASE10_RADIX = 10;

class TipValidator {
    /**
     * Validates the balances of the block to check if the correct tips where selected
     * Returns null if the given blocks are considered valid
     * Returns a block that was considered to be not valid (and should be deleted from the database)
     *
     * @param {Block[]} blocks
     * @returns {(Promise<Block | null>)} A transaction that is invalid and should be deleted or null
     * @memberof TipValidator
     */
    async validateBlockBalances(blocks: Block[]): Promise<Block | null> {
        for (const block of blocks) {
            const balances = await this.generateAccountBalances(block.id);

            // Make sure we are not approving any negative balances
            if (!this.validateForNegativeBalances(balances)) {
                return block;
            }
        }

        return null;
    }

    /**
     * Checks in the pairs if any accounts ended up with a negative balance
     *
     * @param {AddressBalancePair} addressBalancePair
     * @returns {boolean} true if valid, false otherwise
     * @memberof TipValidator
     */
    validateForNegativeBalances(addressBalancePair: AddressBalancePair): boolean {
        const addresses = Object.keys(addressBalancePair);

        for (let index = 0; index < addresses.length; index++) {
            const address = addresses[index];
            const value = addressBalancePair[address];

            if (value.isNeg()) {
                return false;
            }
        }

        return true;
    }

    /**
     * Applies the current address -> balance pairs
     * This function does apply negative balances so it should be checked using validateForNegativeBalances
     *
     * @param {Transaction} transaction
     * @param {AddressBalancePair} state
     * @memberof TipValidator
     */
    applyTransactionToState(transaction: Transaction, state: AddressBalancePair) {
        const addresses = getAddressFromTransaction(transaction);

        // First we subtract the number from the address state to the new state.
        // We currently do allow negative balances at this stage
        // once we are at the final stage we have to check if some balances are negative
        // if they are we must not use the tip
        if (state[addresses.from]) {
            state[addresses.from] = state[addresses.from].sub(transaction.value);
        } else {
            // Genesis transactions do not have any address
            if (!transaction.isGenesis()) {
                // Going into the negatives.
                state[addresses.from] = new BN(0, BASE10_RADIX).sub(transaction.value);
            }
        }

        // Now for the receiver
        if (state[addresses.to]) {
            state[addresses.to] = state[addresses.to].add(transaction.value);
        } else {
            state[addresses.to] = transaction.value;
        }
    }

    /**
     * Generates a address -> balance pair starting from the transaction and walking backwards
     *
     * @param {string} startTransactionId
     * @returns {Promise<AddressBalancePair>}
     * @memberof TipValidator
     */
    async generateAccountBalances(startBlockId: string): Promise<AddressBalancePair> {
        const visitedBlocks: string[] = [];

        const blockIdsToCheck: string[] = [startBlockId];
        const state: AddressBalancePair = {};

        for (const blockId of blockIdsToCheck) {
            // Make sure we don't validate the same transactions twice
            if (visitedBlocks.includes(blockId)) {
                continue;
            }

            visitedBlocks.push(blockId);

            const block = await getBlockById(blockId);
            await block.validate();

            for (const transaction of block.transactions) {
                if (!transaction.value.isZero()) {
                    await validateTransaction(transaction, true);
                    this.applyTransactionToState(transaction, state);
                }
            }

            blockIdsToCheck.push(...block.parents);
        }

        return state;
    }
}

export default TipValidator;
