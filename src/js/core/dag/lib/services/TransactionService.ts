import Transaction from "../../../../models/Transaction";
import { configuration } from "../../../../Configuration";
import KeyPair from "../../../../models/KeyPair";
import { getById, createOrUpdate, databaseCreate, databaseFind, startDatabase } from "../../../../services/DatabaseService";
import { rlpHash } from "../../../../utils/keccak256";
import { numberToHex } from "../../../../utils/hexUtils";
import Account from "../../../../models/Account";
import getRandomInt from "../../../../utils/getRandomInt";
import { isProofOfWorkValid } from "../../../../services/transaction/ProofOfWork";

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
    const data = [
        numberToHex(transaction.transIndex),
        numberToHex(transaction.gasPrice),
        numberToHex(transaction.gasLimit),
        transaction.to ? transaction.to : '0x0',
        '0x' + transaction.value.toString('hex'),
        transaction.data,
        numberToHex(transaction.gasUsed),
        numberToHex(transaction.timestamp),
        numberToHex(configuration.genesis.config.chainId),
        transaction.parents,
        transaction.inputs,
        numberToHex(transaction.milestoneIndex),
    ];

    return rlpHash(data);
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
    const transactionIdData = [
        transactionDataHash,
        transaction.r,
        transaction.v,
        transaction.s,
    ];

    return '0x' + rlpHash(transactionIdData);
}

/**
 * Validates a transaction
 *
 * @export
 * @param {Transaction} transaction
 * @returns
 */
export async function validateTransaction(transaction: Transaction, noExecution: boolean = false) {
    // Making sure the properties are valid types
    // it throws an exception if a value is wrong
    Transaction.fromRaw(transaction.toRaw());

    // For now the maximum of transactions that can be validated is 2
    if (!transaction.isGenesis() && (transaction.parents.length < 2 || transaction.parents.length > 3)) {
        throw new Error(`Transaction ${transaction.id} should validate 2-3 other transactions.`);
    }

    if (!transaction.r || !transaction.s || !transaction.v) {
        throw new Error(`Transaction ${transaction.id} was not signed`);
    }

    // Genesis transactions don't really have any signature
    if (!transaction.isGenesis()) {
        // Make sure the signature matches the transaction.
        const unsignedTxHash = getUnsignedTransactionHash(transaction);
        const isSignatureValid = KeyPair.verifySignature(unsignedTxHash, {
            r: transaction.r,
            s: transaction.s,
            v: transaction.v
        });

        if (!isSignatureValid) {
            throw new Error(`Transaction ${transaction.id} has an invalid signature`);
        }
    }

    // Only positive values are allowed
    if (transaction.value.isNeg()) {
        throw new Error(`Transaction ${transaction.id} should not have negative values`);
    }

    // // For effeciency sake, first check the proof of work.
    // // Since we don't have to go through all the work if the PoW isn't even valid.
    if (!isProofOfWorkValid(transaction.id, transaction.nonce)) {
        throw new Error('Proof of work is not valid');
    }

    // By copying we are essentially only trusting a limited amount of data
    // this way we can be sure no tempering has been done to the executing
    const transactionCopy = new Transaction({
        gasPrice: transaction.gasPrice,
        gasLimit: transaction.gasLimit,
        to: transaction.to,
        data: transaction.data,
        r: transaction.r,
        s: transaction.s,
        v: transaction.v,
        timestamp: transaction.timestamp,
        nonce: transaction.nonce,
        value: transaction.value,
        inputs: transaction.inputs,
        parents: transaction.parents,
        milestoneIndex: transaction.milestoneIndex,
        transIndex: transaction.transIndex,
    });

    // "Sign" the transaction, since we are taking the signatures from the created transaction
    transactionCopy.sign();

    // TODO: Check if transaction is a milestone transaction
    // If it is we need to revalidate depending on the model.
    // Execute to get to the same point as the transaction
    const results = await transactionCopy.execute();

    // Check the Proof of Work again to make sure all the work adds up.
    if (!isProofOfWorkValid(transactionCopy.id, transactionCopy.nonce)) {
        throw new Error('Proof of Work after execution is not valid');
    }

    // On the off chance the PoW is valid but the id is not the same
    if (transactionCopy.id !== transaction.id) {
        throw new Error('Magic.. Proof of Work was valid while the id was not');
    }

    // Everything is valid, now if there is a contract creation we want to add it to our database
    if (results.createdAddress) {
        await Account.create(results.returnHex, transactionCopy.data, transactionCopy.id);
    }

    return true;
}

export function getAddressFromTransaction(transaction: Transaction) {
    // Genesis milestones don't have a from
    if (transaction.isGenesis()) {
        return {
            to: transaction.to,
            from: null,
        }
    }

    if (!transaction.r || !transaction.s || !transaction.v) {
        throw new Error(`Value r,s,v should not be undefined on transaction ${transaction.id}`);
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
    await saveTransaction(transaction);
}

export async function getMilestoneTransaction(milestoneIndex: number) {
    const result = await databaseFind('milestoneIndex', milestoneIndex);

    if (!result || !result.docs.length) {
        return null;
    }

    return Transaction.fromRaw(JSON.stringify(result.docs[0]));
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
    const rawTransaction = transaction.toRaw();
    await databaseCreate(transaction.id, JSON.parse(rawTransaction));
}

export async function createOrUpdateTransaction(transaction: Transaction) {
    await createOrUpdate(transaction.id, transaction.toRaw());
}

/**
 * Finds the transaction that created the given address, only applys to smart contracts
 *
 * @export
 * @param {string} toAddress
 * @returns {Promise<Transaction>}
 */
export async function getAccountCreationTransaction(toAddress: string): Promise<Transaction> {
    const account = await Account.getFromAddress(toAddress);

    if (!account) {
        return null;
    }

    return Transaction.getById(account.creationTransactionId);
}

export async function getStateInputTransactionTip(startTransaction: Transaction, address: string, cummulativeWeights: Map<string, number>): Promise<Transaction> {
    if (!startTransaction) {
        throw new Error('Start transaction is required');
    }

    const db = await startDatabase()
    const data = await db.find({
        selector: {
            // The first transaction of the parent should be the input transaction
            'inputs': {
                '$in': [startTransaction.id],
            }
        }
    });

    const parentTransactions = data.docs.map(tx => Transaction.fromRaw(JSON.stringify(tx)));

    // We found our tip
    if (!parentTransactions.length) {
        return startTransaction;
    }

    // We need a weighted choice between these transactions..
    const nextTransaction = getRandomWeightedTransaction(parentTransactions, cummulativeWeights);

    return getStateInputTransactionTip(nextTransaction, address, cummulativeWeights);
}

/**
 * Gets a random weighted transaction from the array
 *
 * @export
 * @param {Transaction[]} transactions
 * @param {Map<string, number>} cummulativeWeights
 * @returns {Transaction}
 */
export function getRandomWeightedTransaction(transactions: Transaction[], cummulativeWeights: Map<string, number>): Transaction {
    let sumOfWeight = 0;

    transactions.forEach((tx) => {
        sumOfWeight += cummulativeWeights.get(tx.id);
    });

    let randomNum = getRandomInt(0, sumOfWeight);

    const weightedTransaction = transactions.find((tx) => {
        if (randomNum < cummulativeWeights.get(tx.id)) {
            return true;
        }

        randomNum -= cummulativeWeights.get(tx.id);
    });

    if (!weightedTransaction) {
        return transactions[0];
    }

    return weightedTransaction;
}
