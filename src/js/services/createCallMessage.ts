import Transaction from '../models/Transaction';
import CallMessage, { CallKind } from '../core/rvm/lib/CallMessage';
import { getAddressFromTransaction } from '../core/dag/lib/services/TransactionService';
import { hexStringToBuffer } from '../utils/hexUtils';

export default async function createCallMessage(transaction: Transaction): Promise<CallMessage> {
    const callMessage = new CallMessage();
    const addresses = getAddressFromTransaction(transaction);

    callMessage.inputRoot = '0x';

    if (!transaction.isGenesis()) {
        // It's possible that the input of the transaction does not exist
        // (Either because it's the beginning of this address or because there couldnt be one found)
        if (transaction.inputs[0]) {
            const inputTransaction = await Transaction.getById(transaction.inputs[0]);

            if (inputTransaction) {
                callMessage.inputRoot = inputTransaction.outputs[0];
            }
        }
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
