import CallMessage from "../lib/CallMessage";
import GlobalState from "../../../models/GlobalState";
import Transaction from "../../../models/Transaction";

export default interface VmParams {
    callMessage: CallMessage;
    transaction?: Transaction;
    globalState: GlobalState;
    bin?: Uint8Array;
}
