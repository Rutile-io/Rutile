import { secureEval } from './lib/secureEval';
import Process from './Process';

class Executable {
    code: string;

    constructor(code: (process: Process) => void) {
        this.code = `(${code})();`;
    }

    async exec() {
        const result = await secureEval(this.code);

        console.log(this.code);
        console.log(result);
    }
}

export default Executable;
