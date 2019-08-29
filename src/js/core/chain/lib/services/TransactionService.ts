import Transaction from "../../../../models/Transaction";
import { configuration } from "../../../../Configuration";
import KeyPair from "../../../../models/KeyPair";
import { rlpHash } from "../../../../utils/keccak256";
import { numberToHex } from "../../../../utils/hexUtils";
import Account from "../../../../models/Account";
import { isProofOfWorkValid } from "../../../../services/transaction/ProofOfWork";


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
        numberToHex(transaction.timestamp),
        numberToHex(configuration.genesis.config.chainId),
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
export async function validateTransaction(transaction: Transaction) {
    // Making sure the properties are valid types
    // it throws an exception if a value is wrong
    Transaction.fromRaw(transaction.toRaw());

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
        transIndex: transaction.transIndex,
    });

    // "Sign" the transaction, since we are taking the signatures from the created transaction
    transactionCopy.sign();

    // TODO: Check if transaction is a milestone transaction
    // If it is we need to revalidate depending on the model.
    // Execute to get to the same point as the transaction
    // const results = await transactionCopy.execute();

    // Check the Proof of Work again to make sure all the work adds up.
    if (!isProofOfWorkValid(transactionCopy.id, transactionCopy.nonce)) {
        throw new Error('Proof of Work after re-validating is not valid');
    }

    // On the off chance the PoW is valid but the id is not the same
    if (transactionCopy.id !== transaction.id) {
        throw new Error('Magic.. Proof of Work was valid while the id was not');
    }

    // Everything is valid, now if there is a contract creation we want to add it to our database
    // if (results.createdAddress) {
    //     await Account.create(results.returnHex, transactionCopy.data, transactionCopy.id);
    // }

    return true;
}

/**
 * Gets all the addresses from the transaction (Deriving from signature)
 *
 * @export
 * @param {Transaction} transaction
 * @returns
 */
export function getAddressFromTransaction(transaction: Transaction) {
    // Genesis milestones don't have a from
    if (transaction.isGenesis()) {
        return {
            to: transaction.to,
            from: null,
        }
    }

    if (!transaction.r || !transaction.s || !transaction.v) {
        throw new Error(`Value r,s,v should not be undefined on transaction ${transaction.id}, please call transaction.sign() first`);
    }

    const unsignedTransactionHash = getUnsignedTransactionHash(transaction);
    const fromAddress = KeyPair.recoverAddress(unsignedTransactionHash, {
        r: transaction.r,
        s: transaction.s,
        v: transaction.v
    });

    return {
        to: transaction.to,
        from: fromAddress,
    };
}
