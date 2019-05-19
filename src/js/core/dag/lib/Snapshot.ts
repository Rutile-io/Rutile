/**
 * Responsible of creating snapshots of the current state of the DAG.
 * It should only snapshot on milestone indexes or on transactions that have
 * a high confidence (>99%)
 *
 * @class Snapshot
 */
class Snapshot {
    accounts: any[];

    constructor() {

    }

    getIndex() {
        return 1;
    }

    getSolidEntryPoints() {
        return new Map<string, number>();
    }

    static async getLatestSnapshot(): Promise<Snapshot> {
        return new Snapshot();
    }
}

export default Snapshot;
