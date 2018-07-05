import { secureEval } from './lib/secureEval';
import { executeSecure } from './lib/executeSecure';
import { getCommandoClassString, ICommando } from './lib/executerLib/Commando';

class Executable {
    code: string;

    constructor(code: (process: ICommando) => void) {
        this.code = `(${code})`;
    }

    async exec() {
        const result = await executeSecure(this.code);

        return result;
    }
}

export default Executable;
