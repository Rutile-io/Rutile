import VmParams from "./models/VmParams";
import VM from 'ethereumjs-vm/dist/index';
import StateManager from 'ethereumjs-vm/dist/state/stateManager';
import { Results } from "./context";
import { toHex } from "./utils/hexUtils";
import { VM_ERROR } from "./lib/exceptions";
import { hexStringToBuffer } from "../../utils/hexUtils";
import { getDatabaseLevelDbMapping } from "../../services/DatabaseService";
import { createMerkleTree } from "../../models/MerkleTree";
const BN = require('bn.js');
const Trie = require('merkle-patricia-tree');

function stateManagerGetStateRoot(stateManager: StateManager): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        stateManager.getStateRoot((error: any, result: Buffer) => {
            if (error) {
                return reject(error);
            }

            resolve(result);
        });
    });
}

export async function executeEvmCode(params: VmParams): Promise<Results> {
    try {
        const db = await getDatabaseLevelDbMapping();
        let trie = null;

        // Get our storage root for our account
        // This will be modified by the smart contract
        if (params.callMessage.destination) {
            const toAccount = await params.globalState.findOrCreateAccount(params.callMessage.destination);
            const merkleTree = await createMerkleTree(toAccount.storageRoot);
            const data = await merkleTree.fill();
            console.log('[] data -> ', data);

            trie = new Trie(db, toAccount.storageRoot);
        } else {
            trie = new Trie(db);
        }

        const stateManager = new StateManager({
            trie,
        });

        const vm = new VM({
            stateManager,
        });

        let binary = params.bin;

        if (!binary) {
            binary = params.callMessage.inputData;
        }

        const toAddress = params.callMessage.destination;
        const vmParams = {
            address: toAddress ? hexStringToBuffer(toAddress) : null,
            caller: hexStringToBuffer(params.callMessage.sender),
            data: toAddress ? params.callMessage.inputData : null,
            depth: params.callMessage.depth,
            value: params.callMessage.value,
            code: Buffer.from(binary),
            gasLimit: new BN(params.callMessage.gas),
        };

        // @ts-ignore
        const evmResults = await vm.runCode(vmParams);

        console.log('[] evmResults -> ', evmResults);

        const result: Results = {
            gasUsed: evmResults.gasUsed,
            return: evmResults.returnValue,
            returnHex: '0x' + toHex(evmResults.returnValue),
            exception: 0,
            exceptionError: null,
            createdAddress: null,
            outputRoot: '0x' + (await stateManagerGetStateRoot(stateManager)).toString('hex'),
        };

        if (evmResults.exceptionError && evmResults.exceptionError.error === 'out of gas') {
            result.exception = 1;
            result.exceptionError = VM_ERROR.OUT_OF_GAS;
        }

        return result;
    } catch (error) {
        console.error('Evm execution failed', error);
        return {
            exception: 1,
            exceptionError: VM_ERROR.REVERT,
            gasUsed: 0,
            outputRoot: await params.globalState.getMerkleRoot(),
            return: new Uint8Array([]),
            returnHex: '0x',
            createdAddress: '',
        }
    }
}
