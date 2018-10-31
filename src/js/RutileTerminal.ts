import ITerminalController from "./models/interfaces/ITerminalController";
const packageJson = require('../../package.json');

let term: ITerminalController = null;

class RutileTerminal {
    static showIntro() {
        term.writeLine(`Welcome to Rutile v${packageJson.version}`);
    }

    static async showCommandoInput() {
        const commando = term.input('$> ');
        term.writeLine('Executing: ' + commando);
    }

    static run(terminalController: ITerminalController) {
        term = terminalController;
        // term.reset();
        // RutileTerminal.showIntro();
        RutileTerminal.showCommandoInput();
    }
}

export default RutileTerminal;