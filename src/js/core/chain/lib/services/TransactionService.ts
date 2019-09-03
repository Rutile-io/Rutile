import Transaction from "../../../../models/Transaction";
import { configuration } from "../../../../Configuration";
import KeyPair from "../../../../models/KeyPair";
import keccak256, { rlpHash } from "../../../../utils/keccak256";
import { numberToHex } from "../../../../utils/hexUtils";
import Account from "../../../../models/Account";
import { isProofOfWorkValid } from "../../../../services/transaction/ProofOfWork";
import Block from "../../../../models/Block";
import GlobalState from "../../../../models/GlobalState";


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

    // Only positive values are allowed
    if (transaction.value.isNeg()) {
        throw new Error(`Transaction ${transaction.id} should not have negative values`);
    }

    if (!transaction.r || !transaction.s || !transaction.v) {
        throw new Error(`Transaction ${transaction.id} was not signed`);
    }

    // Genesis transactions don't really have any signature
    if (!transaction.isGenesis()) {
        // Make sure the signature matches the transaction.
        const unsignedTxHash = transaction.hash(false);
        const isSignatureValid = KeyPair.verifySignature(unsignedTxHash, {
            r: transaction.r,
            s: transaction.s,
            v: transaction.v
        });

        if (!isSignatureValid) {
            throw new Error(`Transaction ${transaction.id} has an invalid signature`);
        }
    }

    const latestBlock = await Block.getLatest();
    const globalState = await GlobalState.create(latestBlock.stateRoot);
    const addresses = getAddressFromTransaction(transaction);
    const account = await globalState.findOrCreateAccount(addresses.from);

    if (!transaction.nonce.eq(account.nonce)) {
        throw new Error(`Transaction ${transaction.id} nonce should be ${account.nonce} but is ${transaction.nonce}`);
    }

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

    const unsignedTransactionHash = transaction.hash(false);
    const fromAddress = KeyPair.recoverAddress('0x' + unsignedTransactionHash, {
        r: transaction.r,
        s: transaction.s,
        v: transaction.v
    });

    return {
        to: transaction.to,
        from: fromAddress,
    };
}
