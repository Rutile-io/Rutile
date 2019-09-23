import { Results } from "../../core/rvm/context";
import CallMessage from "../../core/rvm/lib/CallMessage";
import Transaction from "../Transaction";
import GlobalState from "../GlobalState";
import Block from "../Block";

export default interface IInternalContract {
    execute(callMessage: CallMessage, globalState: GlobalState, transaction: Transaction, block: Block): Promise<Results>;
}
