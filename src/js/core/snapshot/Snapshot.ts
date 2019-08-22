import TipValidator from "../dag/lib/TipValidator";

/**
 * Responsible of creating snapshots of the current state of the DAG.
 * It should only snapshot on milestone indexes or on transactions that have
 * a high confidence (>99%)
 *
 * @class Snapshot
 */
class Snapshot {
    accounts: any[];
    transactionId: string;

    constructor() {

    }

    getIndex() {
        return 1;
    }

    getSolidEntryPoints() {
        return new Map<string, number>();
    }

    saveToDisk() {

    }

    static async getLatestSnapshot(): Promise<Snapshot> {
        return new Snapshot();
    }

    static async create(transactionId: string): Promise<Snapshot> {
        const tipValidator = new TipValidator();
        const accountBalances = await tipValidator.generateAccountBalances(transactionId);

        return null;
    }
}

export default Snapshot;
