import Transaction from "../models/Transaction";
import sortObjKeysAlphabetically from "../utils/sortObjKeysAlphabetically";
import { configuration } from "../Configuration";
import KeyPair from "../models/KeyPair";
import Account from "../models/Account";
import { isProofOfWorkValid } from "./transaction/ProofOfWork";
import { getById, createOrUpdate, databaseCreate } from "./DatabaseService";

const createKeccakHash = require("keccak");
const GENESIS_MILESTONE = 1;

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
        milestoneIndex: transaction.milestoneIndex,
        gnonce: configuration.genesis.config.nonce,
        parents: transaction.parents
    });

    console.log('[] dataToHash -> ', dataToHash);

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

    const addresses = getAddress(transaction);
    const account = await Account.findOrCreate(addresses.from);

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
        parents: transaction.parents,
        milestoneIndex: transaction.milestoneIndex,
    });

    // TODO: Check if transaction is a milestone transaction
    // If it is we need to revalidate depending on the model.

    // Execute to get to the same point as the transaction
    await transactionCopy.execute();

    // "Sign" the transaction, since we are taking the signatures from the created transaction
    transactionCopy.sign();

    console.log(transactionCopy);

    // Check the Proof of Work again to make sure all the work adds up.
    if (!isProofOfWorkValid(transactionCopy.id, transactionCopy.nonce)) {
        throw new Error("Proof of Work after execution is not valid");
    }

    await applyTransaction(transaction);

    return true;
}

export function getAddress(transaction: Transaction) {
    // Genesis milestones don't have a from
    if (transaction.milestoneIndex === GENESIS_MILESTONE) {
        console.log('return fast');
        return {
            to: transaction.to,
            from: null,
        }
    }

    const unsignedTransactionHash = getUnsignedTransactionHash(transaction);
    const pubKey = KeyPair.recoverAddress(unsignedTransactionHash, {
        r: transaction.r,
        s: transaction.s,
        v: transaction.v
    });

    return {
        to: transaction.to,
        from: pubKey,
    };
}

/**
 * Apply's the transaction and put it's in the database.
 * Also modifies the state of the database to represent the transaction
 * It does not validate the transaction it self.
 *
 * @export
 * @param {Transaction} transaction
 */
export async function applyTransaction(transaction: Transaction) {
    const addresses = getAddress(transaction);
    const toAccount = await Account.findOrCreate(addresses.to);
    const results = [];

    // There is no from in a genesis milestone
    if (transaction.milestoneIndex !== GENESIS_MILESTONE) {
        const fromAccount = await Account.findOrCreate(addresses.from);

        fromAccount.balance = fromAccount.balance - transaction.value;
        fromAccount.transactionIndex = transaction.transIndex;

        results.push(fromAccount.save());
    }

    toAccount.balance = toAccount.balance + transaction.value;
    results.push(toAccount.save());
    results.push(saveTransaction(transaction));

    await Promise.all(results);
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

export async function getTransactionById(id: string): Promise<Transaction> {
    try {
        const result = await getById(id);

        if (!result) {
            return null;
        }

        const transaction = Transaction.fromRaw(JSON.stringify(result));

        return transaction;
    } catch (error) {
        console.error('getTransactionById: ', error);
        return null;
    }
}

export async function saveTransaction(transaction: Transaction) {
    const rawTransaction = JSON.parse(transaction.toRaw());
    const data = {
        ...rawTransaction,
        _id: rawTransaction.id,
    }

    await databaseCreate(rawTransaction.id, data);
}

export async function createOrUpdateTransaction(transaction: Transaction) {
    await createOrUpdate(transaction.id, transaction);
}
