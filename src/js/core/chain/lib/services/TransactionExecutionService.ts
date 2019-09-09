import Transaction from "../../../../models/Transaction";
import Account from "../../../../models/Account";
import { getAddressFromTransaction } from "./TransactionService";
import GlobalState from "../../../../models/GlobalState";
import { rlpHash } from "../../../../utils/keccak256";
import getSystemContract from "../../../../services/getSystemContract";
import { hexStringToString } from "../../../../utils/hexUtils";
import Ipfs from "../../../../services/wrappers/Ipfs";
import { configuration } from "../../../../Configuration";
import stringToByteArray from "../../../../utils/stringToByteArray";

/**
 * Transfers the value from one address to the next
 * Does no checking if the transaction index is correct
 * Call Transaction.validate() for that
 *
 * @export
 * @param {Transaction} transaction
 * @returns {GlobalState} The new state of the accounts
 */
export async function transferTransactionValue(transaction: Transaction, globalState: GlobalState): Promise<GlobalState> {
    // Zero transaction don't need to be transfered
    if (transaction.value.isZero()) {
        return globalState;
    }

    const addresses = getAddressFromTransaction(transaction);

    if (!addresses.to) {
        throw new Error('Cannot transfer value to a non existing address');
    }

    // The genesis block creates tokens out of tin air
    // We don't validate if the account is from genesis
    // Block.validate should validate this
    // This function only checks whether the transfer is possible
    if (addresses.from) {
        const fromAccount = await globalState.findOrCreateAccount(addresses.from);
        const newFromAccountBalance = fromAccount.balance.sub(transaction.value);
        fromAccount.balance = newFromAccountBalance;

        if (newFromAccountBalance.isNeg()) {
            throw new Error('"From" account spent tokens it doesn\'t have');
        }

        await globalState.update(fromAccount);
    }

    const toAccount = await globalState.findOrCreateAccount(addresses.to);
    const newToAccountBalance = toAccount.balance.add(transaction.value);
    toAccount.balance = newToAccountBalance;

    await globalState.update(toAccount);

    return globalState;
}

/**
 * Deploys a contract
 *
 * @export
 * @param {Transaction} transaction
 * @returns
 */
export async function deployContract(transaction: Transaction, globalState: GlobalState): Promise<Account> {
    if (transaction.to) {
        throw new Error(`Contract deploys should not have a 'to' property attached to it`);
    }

    const addresses = getAddressFromTransaction(transaction);

    // We derrive the new address from the account address with hash
    let newContractAddress = rlpHash([
        transaction.nonce,
        addresses.from,
    ]);

    newContractAddress = '0x' + newContractAddress.slice(24);

    // The transaction.data includes the IPFS hash where the contract is located
    const newContractAccount = await globalState.findOrCreateAccount(newContractAddress, transaction.data);
    return newContractAccount;
}

/**
 * Gets the contract's WASM binary
 *
 * @export
 * @param {Account} account
 * @returns {Promise<Uint8Array>}
 */
export async function getContractBinary(account: Account): Promise<Uint8Array> {
    const systemBinary = getSystemContract(account.address);

    // We got a system contract call
    if (systemBinary) {
        return systemBinary;
    }

    if (!account.codeHash || account.codeHash === '0x') {
        // We should probabbly return later a contract that handles value
        return null;
    }

    const ipfs = Ipfs.getInstance(configuration.ipfs);
    const ipfsHash = hexStringToString(account.codeHash);
    const content = await ipfs.cat(ipfsHash);

    return stringToByteArray(content);
}
