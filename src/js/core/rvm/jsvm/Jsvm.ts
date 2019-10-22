import { Results } from "../context";
import byteArrayToString from "../../../utils/byteArrayToString";
import Ivm from 'isolated-vm';
const ivm = __non_webpack_require__('isolated-vm');

export default async function executeJsCode(binary: Uint8Array): Promise<Results> {
    const code = byteArrayToString(binary);
    const isolate: Ivm.Isolate = new ivm.Isolate({ memoryLimit: 128 });
    const context: Ivm.Context = await isolate.createContext();
    const jail = context.global;

    jail.setSync('global', jail.derefInto());
    jail.setSync('_log', new ivm.Reference((...args: any[]) => {
        console.log('[Log]: ', ...args);
    }));

    jail.setSync('_storageStore', new ivm.Reference(async (key: string, value: string, resolve: Ivm.Reference<any>) => {
        console.log('Setting key & value pair ->', key, value);

        setTimeout(() => {
            resolve.applyIgnored(undefined, [
                new ivm.ExternalCopy('I came from storageStore').copyInto(),
            ]);
        }, 1000);
    }));

    jail.setSync('_ivm', ivm);

    const bootstrap = await isolate.compileScript(`new function() {
        let ivm = _ivm;
        delete _ivm;

        let log = _log;
        delete _log;

        let storageStore = _storageStore;
        delete _storageStore;

        global.log = (...args) => {
            log.applyIgnored(undefined, args.map(arg => new ivm.ExternalCopy(arg).copyInto()));
        }

        global.storageStore = (key, value) => {
            return new Promise((resolve) => {
                storageStore.applyIgnored(
                    undefined,
                    [new ivm.ExternalCopy(key).copyInto(), new ivm.ExternalCopy(value).copyInto(), new ivm.Reference(resolve)]
                );
            });
        }

        return new ivm.Reference(function forwardMainPromise(mainFunc, resolve) {
            const derefMainFunc = mainFunc.deref();

            derefMainFunc().then((value) => {
                resolve.applyIgnored(undefined, [
                    new ivm.ExternalCopy(value).copyInto(),
                ]);
            });
        });
    }`);

    const bootstrapScriptResult: Ivm.Reference<any> = await bootstrap.run(context);

    const script = await isolate.compileScript(code);
    await script.run(context);
    const mainFunc = await jail.get('main');

    const executionPromise = new Promise(async (resolve) => {
        await bootstrapScriptResult.apply(undefined, [
            mainFunc,
            new ivm.Reference(resolve),
        ]);
    });

    const result = await executionPromise;

    console.log('Done -> ', result);

    return null;
}
