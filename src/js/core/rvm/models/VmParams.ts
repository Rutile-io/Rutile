import CallMessage from "../lib/CallMessage";
import GlobalState from "../../../models/GlobalState";

export default interface VmParams {
    callMessage: CallMessage;
    globalState: GlobalState;
    bin?: Uint8Array;
}
