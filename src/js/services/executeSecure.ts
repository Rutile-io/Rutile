import RutileContext from '../models/RutileContext';
// import { secureEval } from 'secure-eval/secure-eval';
const saferEval = require('safer-eval');

/**
 * Executes code in a different context and vm.
 * This way the code is executed safely.
 * We only give it an instance of Rutile
 *
 * @export
 * @param {string} code
 * @param {string[]} scriptArgs
 * @returns
 */
export default async function executeSecure(code: string, scriptArgs: string[]) {
    const rutileContext = new RutileContext(scriptArgs);

    const result = await saferEval(`${code}`, {
        rutile: rutileContext,
    });
    
    return result;
}