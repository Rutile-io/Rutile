import isNodeJs from "../../../services/isNodeJs";
import Transaction from "../../../models/Transaction";
import { hexStringToBuffer } from "../../../utils/hexUtils";

const Bn = require('bn.js');

let Vm: any = null;

if (isNodeJs()) {
    Vm = __non_webpack_require__('ethereumjs-vm')
    // require('ethereumjs-vm')
} else {
    Vm = require('ethereumjs-vm');
}

class Evm {
    binary: Uint8Array;
    transaction: Transaction;

    constructor(binary: Uint8Array, transaction: Transaction) {
        this.binary = binary;
        this.transaction = transaction;
    }

    async execute() {
        console.log('Executing code...', hexStringToBuffer(this.transaction.data), this.transaction.data);
        return new Promise((resolve, reject) => {
            const vm = new Vm();

            vm.runCode({
                code: Buffer.from(this.binary.buffer),
                data: hexStringToBuffer(this.transaction.data),
                gasLimit: new Bn(0xffff),
            }, (error: any, results: any) => {
                console.log('[] error -> ', error);
                console.log('[] results -> ', results);
            });
        });
    }
}

export default Evm;
