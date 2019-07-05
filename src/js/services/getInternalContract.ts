import IInternalContract from "../models/interfaces/IInternalContract";
import MilestoneInternalContract from "../core/milestone/contract/MilestoneInternalContract";

export const INTERNAL_CONTRACTS = [
    '0x0200000000000000000000000000000000000000',
];

export default function getInternalContract(address: string): IInternalContract {
    if (address === '0x0200000000000000000000000000000000000000') {
        return new MilestoneInternalContract();
    }

    return null;
}
