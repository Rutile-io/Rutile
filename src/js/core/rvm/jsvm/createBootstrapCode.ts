import Ivm from 'isolated-vm';

/**
 * Creates the bootstrapping code that deletes dangerous code and replaces them with safer code.
 *
 * @export
 * @param {Ivm.Isolate} isolate
 * @returns
 */
export default async function createBootstrapCode(isolate: Ivm.Isolate) {
    const boostrap = await isolate.compileScript(`new function() {
        // First get the dangerous code out of the way
        let ivm = _ivm;
        delete _ivm;

        let rutileContext = _rutile;
        delete _rutile;

        // copy our rutile object so we can use the methods inside it
        const rutileMethods = rutileContext.copySync();

        // Our alternative for global methods. So scripts can call rutile.SOMETHING
        const rutile = {};

        rutileMethods.forEach((rutileMethod) => {
            const method = (...args) => {
                if (rutileMethod.type === 'async') {
                    return new Promise((resolve, reject) => {
                        const transferableArgs = args.map(arg => new ivm.ExternalCopy(arg).copyInto());

                        transferableArgs.push(new ivm.Reference(resolve));
                        transferableArgs.push(new ivm.Reference(reject));

                        rutileMethod.method.applyIgnored(undefined, transferableArgs);
                    });
                } else {
                    return rutileMethod.method.apply(undefined, args.map(arg => new ivm.ExternalCopy(arg).copyInto()));
                }
            }

            rutile[rutileMethod.key] = method;
        });

        global['rutile'] = rutile;

        // Our main entry point that can be set with setApp
        let mainEntrypoint = async () => {
            throw new Error('Main entry point was not set, call rutile.setApp()');
        };

        // Sets the main entry point
        rutile.setApp = (mainFunction) => {
            mainEntrypoint = mainFunction;
        }

        // The entry point needed to handle async main entrypoints
        return new ivm.Reference(function forwardMainPromise(resolve) {
            mainEntrypoint().then((value) => {
                resolve.applyIgnored(undefined, [
                    new ivm.ExternalCopy(value).copyInto(),
                ]);
            });
        });
    }`);

    return boostrap;
}
