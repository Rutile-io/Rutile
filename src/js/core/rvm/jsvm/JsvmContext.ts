import Ivm from 'isolated-vm';
import { createMerkleTree } from '../../../models/MerkleTree';
import CallMessage from '../lib/CallMessage';
import GlobalState from '../../../models/GlobalState';
import stringToByteArray from '../../../utils/stringToByteArray';
import { toHex } from '../utils/hexUtils';
import byteArrayToString from '../../../utils/byteArrayToString';
import { Results } from '../context';
import { VM_ERROR } from '../lib/exceptions';
const ivm = __non_webpack_require__('isolated-vm');

interface JsvmContext {
    jail: Ivm.Reference<Object>;
    setExecutionCompleteCallback: Function;
}

interface Method {
    key: string;
    type: string;
    method: Function;
}

interface JsvmMethods {
    methods: Method[];
    setExecutionCompleteCallback: Function;
}

async function getJsvmMethods(isolate: Ivm.Isolate, callMessage: CallMessage, globalState: GlobalState): Promise<JsvmMethods> {
    const toAccount = await globalState.findOrCreateAccount(callMessage.destination);
    const stateStorage = await createMerkleTree(toAccount.storageRoot);
    const result: Results = {
        createdAddress: null,
        exception: 0,
        exceptionError: null,
        gasUsed: 0,
        outputRoot: '0x',
        return: new Uint8Array(),
        returnHex: '0x',
    };

    let executionCompleteCallback = (...args: any[]) => {};

    function log(...args: any[]) {
        console.log('[Log]: ', ...args);
    }

    function useGas(amount: number) {
        result.gasUsed += amount;
    }

    /**
     * Loads a key from the storage
     *
     * @param {string} key
     * @param {Ivm.Reference<any>} resolve
     */
    async function storageLoad(key: string, resolve: Ivm.Reference<any>) {
        useGas(200);

        const value = await stateStorage.get(toHex(stringToByteArray(key)));

        resolve.applyIgnored(undefined, [
            new ivm.ExternalCopy(byteArrayToString(value)).copyInto(),
        ]);
    }

    /**
     * Stores a key value into the global state
     *
     * @param {string} key
     * @param {string} value
     * @param {Ivm.Reference<any>} resolve
     */
    async function storageStore(key: string, value: string, resolve: Ivm.Reference<any>) {
        useGas(20000);

        const keyArr = toHex(stringToByteArray(key));
        const valueArr = stringToByteArray(value);

        await stateStorage.put(keyArr, valueArr);

        resolve.applyIgnored(undefined, []);
    }

    /**
     * Halts execution. Transaction considered succesfull
     *
     * @param {string} message
     */
    async function finish(message: string) {
        result.return = stringToByteArray(message);
        result.returnHex = '0x' + toHex(result.return);
        result.outputRoot = await stateStorage.getMerkleRoot();

        executionCompleteCallback(result);
        isolate.dispose();
    }

    function revert(message: string) {

    }


    // Mapping all methods to IVM methods
    return {
        methods: [
            {
                key: 'log',
                type: 'sync',
                method: new ivm.Reference(log),
            },
            {
                key: 'storageStore',
                type: 'async',
                method: new ivm.Reference(storageStore),
            },
            {
                key: 'storageLoad',
                type: 'async',
                method: new ivm.Reference(storageLoad),
            },
            {
                key: 'finish',
                type: 'sync',
                method: new ivm.Reference(finish),
            }
        ],
        setExecutionCompleteCallback: (callback: () => void) => {
            executionCompleteCallback = callback;
        }
    }
}

export async function createJsvmContext(ivmContext: Ivm.Context, isolate: Ivm.Isolate, callMessage: CallMessage, globalState: GlobalState): Promise<JsvmContext> {
    const jail = ivmContext.global;
    const jsvmMethods = await getJsvmMethods(isolate, callMessage, globalState);

    // Setting our global variables
    await jail.set('global', jail.derefInto());
    await jail.set('_ivm', ivm);
    await jail.set('_rutile', new ivm.Reference(jsvmMethods.methods));

    return {
        jail,
        setExecutionCompleteCallback: (callback: Function) => {
            jsvmMethods.setExecutionCompleteCallback(callback);
        }
    };
}
