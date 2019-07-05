import { Results } from "../../core/rvm/context";
import CallMessage from "../../core/rvm/lib/CallMessage";
import Transaction from "../Transaction";

export default interface IInternalContract {
    execute(callMessage: CallMessage, transaction: Transaction): Promise<Results>;
}
