import Executable from "./Executable";
import { ExecuteSecureResult } from "./lib/executeSecure";

class Program {
    name: string;
    executables: Executable[] = [];

    constructor(name: string) {
        this.name = name;
    }

    addExecutable(executable: Executable) {
        this.executables.push(executable);
    }

    execAll() : Promise<ExecuteSecureResult[]> {
        const promises: Promise<ExecuteSecureResult>[] = [];

        this.executables.forEach((executable) => {
            const promise = executable.exec();
            promises.push(promise);
        });

        return Promise.all(promises);
    }
}

export default Program;
