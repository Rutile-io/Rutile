import ITerminalController from '../../models/interfaces/ITerminalController';

const term = require('terminal-kit').terminal;

class OsTerminalController {
    write(output: string) {
        term(output);
    }

    writeLine(output: string) {
        term(`${output}\n`);
    }

    input(inputQuestion?: string) {
       

        term.inputField(function (error: any, userInput: string) {
            if (error) {
                console.log('[Input] error -> ', error);
            } else {
                console.log(userInput)
            }
        });

         // return new Promise<string>((resolve, reject) => {
        // });
    }

    reset() {
        term.reset();
    }
}

export default OsTerminalController;