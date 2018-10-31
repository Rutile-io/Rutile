import { NodeType } from './models/types/NodeType';
import executeSecure from './services/executeSecure';

export interface CompiledLamda {
    func: string,
    // signature: string,
    // cost: string,
}

class Lamda {
    private code?: string;
    public compiledCode?: CompiledLamda;
    private apiDefinition: string;

    static fromCompiledLamdaString(compiledLamdaString: string): Lamda {
        try {
            const compiledLamda = JSON.parse(compiledLamdaString);
            const lamda = new Lamda();
    
            lamda.compiledCode = compiledLamda;
            lamda.code = compiledLamda.func;
    
            return lamda;
        } catch (error) {
            throw new Error(`Could not create lamda ${error}`);
        }
    }

    setApiDefinition(api: any) {
        this.apiDefinition = api;
    }

    setCodeString(code: string) {
        this.code = `function () { ${code} }`;
    }

    setCode(code: Function) {
        this.code = code.toString();
    }

    async execute(args: string[] = ['']) {
        try {
            const wrappedCode = `${this.code}()`;
            const result = await executeSecure(wrappedCode, args);

            return result;
        } catch (error) {
            console.error('Script threw an error: ', error);
        }
    }

    /**
     * Compiles the code to a deployable friendly string.
     * TODO: Minify the file
     *
     * @returns {Promise<string>}
     * @memberof Lamda
     */
    async compile(): Promise<string> {
        if (!this.code) {
            throw new Error('Could not compile if there is no code set.');
        }

        const result: CompiledLamda = {
            func: this.code,
        };

        this.compiledCode = result;
        return JSON.stringify(result);
    }
}

export default Lamda;