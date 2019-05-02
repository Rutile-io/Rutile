import { Duplex } from "stream";
import { databaseGetAll } from "../../../../services/DatabaseService";

export default function getAllTransactionsStream(): Duplex {
    // TODO: Find a better query to find transactions..
    return databaseGetAll({
        selector: {
            timestamp: {
                $gte: 0,
            }
        }
    });
}
