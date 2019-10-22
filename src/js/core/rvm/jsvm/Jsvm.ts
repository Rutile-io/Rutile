import { Results } from "../context";
import byteArrayToString from "../../../utils/byteArrayToString";
import Ivm from 'isolated-vm';
import { createJsvmContext } from "./JsVmContext";
import createBootstrapCode from "./createBootstrapCode";
import CallMessage from "../lib/CallMessage";
import GlobalState from "../../../models/GlobalState";
import { configuration } from "../../../Configuration";
const ivm = __non_webpack_require__('isolated-vm');

export default async function executeJsCode(binary: Uint8Array, callMessage: CallMessage, globalState: GlobalState): Promise<Results> {
    try {

        const code = byteArrayToString(binary);
        const isolate: Ivm.Isolate = new ivm.Isolate({ memoryLimit: configuration.vm.maximumMemory });
        const context: Ivm.Context = await isolate.createContext();
        const jsvmContext = await createJsvmContext(context, isolate, callMessage, globalState);
        const jail = jsvmContext.jail;

        // Creates the bootstrap code that converts all jsvmContext methods to global methods
        // Preruns the code in the same isolation as the application code
        const bootstrap = await createBootstrapCode(isolate);
        const bootstrapScriptResult: Ivm.Reference<any> = await bootstrap.run(context);

        // Compiles and runs the application this way the entry point can be extracted
        // later on. This does not execute "main" yet
        const script = await isolate.compileScript(code);
        await script.run(context);
        const mainFunc = await jail.get('main');

        const executionPromise = new Promise(async (resolve) => {
            // The application can throw an error or call finish() directly
            // so we pass it to the context so it can be used.
            jsvmContext.setExecutionCompleteCallback(resolve);

            // Executes the "main" entrypoint via the bootstrap code
            // which can take a promise resolve and pass it along
            await bootstrapScriptResult.apply(undefined, [
                mainFunc,
                new ivm.Reference(resolve),
            ]);
        });

        const timeout = setTimeout(() => {
            isolate.dispose();
        }, 10000);

        const result = await executionPromise;

        clearTimeout(timeout);

        console.log('[] result -> ', result);

        return null;
    } catch (error) {
        console.log('Timeout');
        console.error(error);
    }
}
