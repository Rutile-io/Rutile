import { storageStore } from "./lib/storage";
import { memoryGet, loadMemory } from "./lib/memory";
import { toHex, hexStringToByte } from "./utils/hexUtils";

class Context {
    id: string;
    fromAddress: string;

    memory: Uint32Array;
    wasmInstance: WebAssembly.ResultObject;

    constructor(id: string, fromAddress: string) {
        this.id = id;
        this.fromAddress = fromAddress;
    }

    updateMemory() {
        this.memory = new Uint32Array(this.wasmInstance.instance.exports.memory.buffer);
    }

    storageStore(pathOffset: number, valueOffset: number) {
        this.updateMemory();
        // TODO: Some safety checks for poking in memory that might nog exists..
        const path = memoryGet(this.memory, pathOffset);
        const value = memoryGet(this.memory, valueOffset);

        const hex = toHex(path);

        console.log('[STORAGE] value -> ', path);
        console.log('VAL', hex);
        const r = hexStringToByte(hex);

        console.log('[] r -> ', r);

        //TODO: Store the actual value in the database
    }

    getAddress(resultOffset: number) {
        this.updateMemory();

        //@ts-ignore
        const addressInBytes = hexStringToByte(this.fromAddress);
        loadMemory(this.memory, resultOffset, addressInBytes);
    }

    getExposedFunctions() {
        return {
            rut_storageStore: this.storageStore.bind(this),
            rut_getAddress: this.getAddress.bind(this),
        }
    }
}

export default Context;
