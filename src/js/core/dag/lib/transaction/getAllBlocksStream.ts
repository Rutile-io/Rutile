import { Duplex } from "stream";
import { databaseGetAll } from "../../../../services/DatabaseService";

export default function getAllBlocksStream(): Duplex {
    // TODO: Find a better query to find blocks..
    return databaseGetAll({
        selector: {
            timestamp: {
                $gte: 0,
            }
        }
    });
}
