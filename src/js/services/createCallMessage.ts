import Transaction from '../models/Transaction';
import CallMessage, { CallKind } from '../core/rvm/lib/CallMessage';
import { getAddressFromTransaction } from '../core/chain/lib/services/TransactionService';
import { hexStringToBuffer } from '../utils/hexUtils';
import Account from '../models/Account';

/**
 * Creates a call message that can be used for executing in the VM
 *
 * @export
 * @param {Transaction} transaction
 * @returns {Promise<CallMessage>}
 */
export default async function createCallMessage(transaction: Transaction): Promise<CallMessage> {
    const callMessage = new CallMessage();
    const addresses = getAddressFromTransaction(transaction);

    callMessage.inputRoot = '0x';

    if (!transaction.isGenesis()) {
        // The node requested to use the account as an input (It's confident that the order is correct)
        const account = await Account.findOrCreate(addresses.to);
        callMessage.inputRoot = account.storageRoot;
    }

    callMessage.value = transaction.value;
    callMessage.destination = addresses.to;
    callMessage.sender = addresses.from;
    callMessage.depth = 0;
    callMessage.inputData = hexStringToBuffer(transaction.data);
    callMessage.inputSize = (transaction.data.length - 2) / 2;
    callMessage.kind = CallKind.Call;
    callMessage.flags = 1;
    callMessage.gas = transaction.gasLimit;

    return callMessage;
}
