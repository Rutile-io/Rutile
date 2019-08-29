import { Results } from "../../core/rvm/context";
import CallMessage from "../../core/rvm/lib/CallMessage";
import Transaction from "../Transaction";
import GlobalState from "../GlobalState";

export default interface IInternalContract {
    execute(callMessage: CallMessage, globalState: GlobalState, transaction: Transaction): Promise<Results>;
}
