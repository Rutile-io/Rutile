import Ivm from 'isolated-vm';
const ivm = __non_webpack_require__('isolated-vm');


function getJsvmMethods() {
    function log(...args: any[]) {
        console.log('[Log]: ', ...args);
    }

    /**
     * Stores a key value into the global state
     *
     * @param {string} key
     * @param {string} value
     * @param {Ivm.Reference<any>} resolve
     */
    async function storageStore(key: string, value: string, resolve: Ivm.Reference<any>) {
        console.log('Setting key & value pair ->', key, value);

        setTimeout(() => {
            resolve.applyIgnored(undefined, [
                new ivm.ExternalCopy('I came from storageStore').copyInto(),
            ]);
        }, 1000);
    }

    // Mapping all methods to IVM methods
    return {
        log: new ivm.Reference(log),
        storageStore: new ivm.Reference(storageStore)
    }
}

export async function createJsvmContext(ivmContext: Ivm.Context) {
    const jail = ivmContext.global;

    // Setting our global variables
    await jail.set('global', jail.derefInto());
    await jail.set('_ivm', ivm);
    await jail.set('_rutile', getJsvmMethods());
}
