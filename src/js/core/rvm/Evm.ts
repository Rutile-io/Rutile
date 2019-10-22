import VmParams from "./models/VmParams";
import VM from 'ethereumjs-vm/dist/index';
import StateManager from 'ethereumjs-vm/dist/state/stateManager';
import { Results } from "./context";
import { toHex } from "./utils/hexUtils";
import { VM_ERROR } from "./lib/exceptions";
import { hexStringToBuffer } from "../../utils/hexUtils";
import { getDatabaseLevelDbMapping } from "../../services/DatabaseService";
import { createMerkleTree } from "../../models/MerkleTree";
import { Transaction } from "ethereumjs-tx";
import { ExecResult } from "ethereumjs-vm/dist/evm/evm";
import { configuration } from "../../Configuration";
import Block from "../../models/Block";
import Common from "ethereumjs-common";
const BN = require('bn.js');

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
        const merkleTree = await createMerkleTree(await params.globalState.getMerkleRoot());
        const stateManager = new StateManager({
            trie: merkleTree.trie,
        });

        const genesisBlock = await Block.getByNumber(1);


        const commonOpts = {
            networkId: configuration.genesis.config.chainId,
            genesis: {
                hash: genesisBlock.id,
                timestamp: genesisBlock.timestamp,
                gasLimit: genesisBlock.gasLimit,
                difficulty: genesisBlock.difficulty,
                nonce: genesisBlock.nonce,
                extraData: genesisBlock.extraData,
                stateRoot: genesisBlock.stateRoot,
            },
            // @ts-ignore
            hardforks: [],
            bootstrapNodes: [
                {
                    ip: '127.0.0.1',
                    port: 8545,
                    chainId: configuration.genesis.config.chainId,
                    id: 'LOCAL_NODE',
                    location: '',
                    comment: '',
                }
            ],
        }

        const common = new Common(commonOpts)

        // @ts-ignore
        const vm = new VM({
            stateManager,
            // @ts-ignore
            chain: common,
        });

        let executionResult: ExecResult = null;

        if (params.transaction) {
            const tx = new Transaction({
                nonce: '0x' + params.transaction.nonce.toString('hex'),
                gasPrice: '0x' + params.transaction.gasPrice.toString(16),
                gasLimit: '0x' + params.transaction.gasLimit.toString(16),
                to: params.transaction.to ? '0x' + params.transaction.to : null,
                value: '0x' + params.transaction.value.toString('hex'),
                data: params.transaction.data,
                v: '0x' + params.transaction.v.toString(16),
                r: params.transaction.r,
                s: params.transaction.s,
            },
            // {
            //     common,
            // }
            );

            console.log('[Evm] tx -> ', tx);

            const result = await vm.runTx({
                skipBalance: true,
                skipNonce: true,
                tx,
            });

            executionResult = result.execResult;
        } else {
            const toAddress = params.callMessage.destination;
            const vmParams = {
                address: toAddress ? hexStringToBuffer(toAddress) : null,
                caller: hexStringToBuffer(params.callMessage.sender),
                data: toAddress ? params.callMessage.inputData : null,
                depth: params.callMessage.depth,
                value: params.callMessage.value,
                code: Buffer.from(params.bin),
                gasLimit: new BN(params.callMessage.gas),
            };

            // @ts-ignore
            const result = await vm.runCode(vmParams);
            executionResult = result;
        }


        // const db = await getDatabaseLevelDbMapping();
        // let trie = null;

        // trie = new Trie(db, await params.globalState.getMerkleRoot());

        // const stateManager = new StateManager({
        //     trie,
        // });

        // const vm = new VM({
        //     stateManager,
        // });

        // let binary = params.bin;

        // if (!binary) {
        //     binary = params.callMessage.inputData;
        // }

        // const toAddress = params.callMessage.destination;
        // const vmParams = {
        //     address: toAddress ? hexStringToBuffer(toAddress) : null,
        //     caller: hexStringToBuffer(params.callMessage.sender),
        //     data: toAddress ? params.callMessage.inputData : null,
        //     depth: params.callMessage.depth,
        //     value: params.callMessage.value,
        //     code: Buffer.from(binary),
        //     gasLimit: new BN(params.callMessage.gas),
        // };

        // // @ts-ignore
        // const evmResults = await vm.runCode(vmParams);

        const result: Results = {
            gasUsed: executionResult.gasUsed.toNumber(),
            return: executionResult.returnValue,
            returnHex: '0x' + toHex(executionResult.returnValue),
            exception: 0,
            exceptionError: null,
            createdAddress: null,
            outputRoot: '0x' + (await stateManagerGetStateRoot(stateManager)).toString('hex'),
        };

        if (executionResult.exceptionError && executionResult.exceptionError.error === 'out of gas') {
            result.exception = 1;
            result.exceptionError = VM_ERROR.OUT_OF_GAS;
        }

        console.log('[VM] result -> ', result);

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
