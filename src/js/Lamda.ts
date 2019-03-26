import { TextDecoder, TextEncoder } from 'text-encoding';
import { NodeType } from './models/types/NodeType';
import stringToByteArray from './utils/stringToByteArray';
import byteArrayToString from './utils/byteArrayToString';
import execute from './core/rvm/execute';

export interface CompiledLamda {
    bin: number[],
    // signature: string,
    // cost: string,
}

export interface LamdaResult {
    gasUsed: number;
    result: any;
}

class Lamda {
    private code?: string;
    public compiledCode?: CompiledLamda;
    public wasmBinary?: Uint8Array;

    constructor(wasmBinary: Uint8Array = null) {
        this.wasmBinary = wasmBinary;
    }

    static fromCompiledLamdaString(compiledLamdaString: string): Lamda {
        try {
            const byteArrayWasm = stringToByteArray(compiledLamdaString);
            const lamda = new Lamda(byteArrayWasm);

            return lamda;
        } catch (error) {
            throw new Error(`Could not create lamda ${error}`);
        }
    }

    /**
     * Compiles the code to a deployable friendly string.
     * TODO: Minify the file
     *
     * @returns {Promise<string>}
     * @memberof Lamda
     */
    compile(): Promise<string> {
        return new Promise((resolve) => {
            if (!this.wasmBinary) {
                throw new Error('Could not compile if there is no code set.');
            }

            const result = byteArrayToString(this.wasmBinary);

            resolve(result);
        });
    }
}

export default Lamda;
