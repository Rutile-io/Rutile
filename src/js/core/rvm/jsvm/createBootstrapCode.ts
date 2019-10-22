import Ivm from 'isolated-vm';
const ivm = __non_webpack_require__('isolated-vm');

export default async function createBootstrapCode(isolate: Ivm.Isolate) {
    const x: Ivm.Reference<any> = null;

    const boostrap = await isolate.compileScript(`new function() {
        // First get the dangerous code out of the way
        let ivm = _ivm;
        delete _ivm;

        let rutile = _rutile;
        delete _rutile;

        // copy our rutile object so we can use the methods inside it
        const rutileMethods = rutile.copySync();

        rutileMethods.forEach((rutileMethod) => {
            global[rutileMethod.key] = (...args) => {
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
        });

        // The entry point needed to handle async main entrypoints
        return new ivm.Reference(function forwardMainPromise(mainFunc, resolve) {
            const derefMainFunc = mainFunc.deref();

            derefMainFunc().then((value) => {
                resolve.applyIgnored(undefined, [
                    new ivm.ExternalCopy(value).copyInto(),
                ]);
            });
        });
    }`);

    return boostrap;
}
