import Transaction from "../models/Transaction";
import sortObjKeysAlphabetically from "../utils/sortObjKeysAlphabetically";
import { configuration } from "../Configuration";
import KeyPair from "../models/KeyPair";
import Account from "../models/Account";
import { isProofOfWorkValid } from "./transaction/ProofOfWork";

const createKeccakHash = require("keccak");

/**
 * Gets a unsigned transaction hash
 * This is not the id of the transaction but it can be used in combination with
 * r,s,v to create a transaction id.
 *
 * @export
 * @param {Transaction} transaction
 * @returns {string}
 */
export function getUnsignedTransactionHash(transaction: Transaction): string {
    // TODO: Add a state hash (A hash that shows what changed in a contract)
    const dataToHash = sortObjKeysAlphabetically({
        data: transaction.data,
        to: transaction.to,
        value: transaction.value,
        gasPrice: transaction.gasPrice,
        gasLimit: transaction.gasLimit,
        gasUsed: transaction.gasUsed,
        timestamp: transaction.timestamp,
        transIndex: transaction.transIndex,
        nonce: configuration.genesis.config.nonce,
        parents: transaction.parents
    });

    return createKeccakHash("keccak256")
        .update(JSON.stringify(dataToHash))
        .digest("hex");
}

/**
 * Gets the transaction id using the data in the transaction.
 * Requires transaction to be signed
 *
 * @export
 * @param {Transaction} transaction
 * @returns
 */
export function getTransactionId(transaction: Transaction) {
    if (!transaction.s || !transaction.v || !transaction.r) {
        throw new Error("Could not create transaction id without r,s,v");
    }

    const transactionDataHash = getUnsignedTransactionHash(transaction);
    const transactionIdData = sortObjKeysAlphabetically({
        hash: transactionDataHash,
        r: transaction.r,
        v: transaction.v,
        s: transaction.s
    });

    return createKeccakHash("keccak256")
        .update(JSON.stringify(transactionIdData))
        .digest("hex");
}

export async function validateTransaction(transaction: Transaction) {
    // For effeciency sake, first check the proof of work.
    // Since we don't have to go through all the work if the transaction isn't even valid.
    if (!isProofOfWorkValid(transaction.id, transaction.nonce)) {
        throw new Error("Proof of work is not valid");
    }

    const unsignedTransactionHash = getUnsignedTransactionHash(transaction);

    // We need to find the account that is associated with the transaction
    // making sure we bind the correct user to it.
    const pubKey = KeyPair.recoverAddress(unsignedTransactionHash, {
        r: transaction.r,
        s: transaction.s,
        v: transaction.v
    });

    const account = await Account.findOrCreate(pubKey);

    // Make sure that balance updates are possible
    account.validateTransaction(transaction);

    // By copying we are essentially only trusting a limited amount of data
    // this way we can be sure no tempering has been done to the executing
    const transactionCopy = new Transaction({
        to: transaction.to,
        data: transaction.data,
        r: transaction.r,
        s: transaction.s,
        v: transaction.v,
        timestamp: transaction.timestamp,
        nonce: transaction.nonce,
        transIndex: transaction.transIndex,
        parents: transaction.parents
    });

    // Execute to get to the same point as the transaction
    await transaction.execute();

    // "Sign" the transaction, since we are taking the signatures from the created transaction
    transactionCopy.sign();

    // Check the Proof of Work again to make sure all the work adds up.
    if (!isProofOfWorkValid(transactionCopy.id, transactionCopy.nonce)) {
        throw new Error("Proof of Work after execution is not valid");
    }

    await account.applyTransaction(transaction);

    return true;
}

/**
 * Searches the database for transactions that have a low weight that
 * needs to be validated.
 *
 * @export
 * @param {number} amount
 */
export async function getTransactionsToValidate(amount: number = 2): Promise<Transaction[]> {
    return null;
}

/**
 * Calculates the transaction's current weight.
 *
 * @export
 * @param {Transaction} transaction
 */
export async function calculateTransactionWeight(transaction: Transaction): Promise<number> {
    return 0;
}
