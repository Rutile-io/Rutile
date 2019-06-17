import Milestone from "./Milestone";
import Dag from "../dag/Dag";

class Validator {
    milestone: Milestone;

    constructor(dag: Dag) {
        this.milestone = new Milestone(dag);
    }

    start() {
        return;
        this.milestone.start();
    }
}

export default Validator;
