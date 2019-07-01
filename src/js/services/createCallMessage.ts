import Transaction from '../models/Transaction';
import CallMessage, { CallKind } from '../core/rvm/lib/CallMessage';
import { getAddressFromTransaction } from '../core/dag/lib/services/TransactionService';
import { hexStringToBuffer } from '../utils/hexUtils';

export default function createCallMessage(transaction: Transaction): CallMessage {
    const callMessage = new CallMessage();
    const addresses = getAddressFromTransaction(transaction);

    callMessage.value = transaction.value;
    callMessage.destination = addresses.to;
    callMessage.sender = addresses.from;
    callMessage.depth = 0;
    callMessage.inputData = hexStringToBuffer(transaction.data);
    callMessage.inputSize = (transaction.data.length - 2) / 2;
    callMessage.kind = CallKind.Call;
    callMessage.flags = 1;
    callMessage.gas = transaction.gasLimit;
    callMessage.inputRoot = transaction.inputStateRoot;

    return callMessage;
}
