import Executable from "./Executable";

class Program {
    name: string;
    executables: Executable[] = [];

    constructor(name: string) {
        this.name = name;
    }

    addExecutable(executable: Executable) {
        this.executables.push(executable);
    }

    execAll() {
        this.executables.forEach((executable) => {
            executable.exec();
        });
    }
}

export default Program;
