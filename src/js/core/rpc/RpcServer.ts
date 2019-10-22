import isNodeJs from "../../services/isNodeJs";
import * as Logger from 'js-logger';
import { configuration } from "../../Configuration";
import { IncomingMessage, ServerResponse } from "http";
import Block from "../../models/Block";
import { numberToHex, hexStringToBuffer, hexStringToString } from "../../utils/hexUtils";
import GlobalState from "../../models/GlobalState";
import Transaction from "../../models/Transaction";
import Chain from "../chain/Chain";
import { getAddressFromTransaction } from "../chain/lib/services/TransactionService";
import { createZerosArray, toHex } from "../rvm/utils/hexUtils";
import execute from "../rvm/execute";
import { CallKind } from "../rvm/lib/CallMessage";
import BN = require("bn.js");
import { createMerkleTree } from "../../models/MerkleTree";
import { decodeReceipt } from "../../models/Receipt";
import { rlpHash } from "../../utils/keccak256";
import VmParams from "../rvm/models/VmParams";
import Ipfs from "../../services/wrappers/Ipfs";
import stringToByteArray from "../../utils/stringToByteArray";

interface RpcRequest {
    id: number;
    jsonrpc: string;
    params: any[];
    method: string;
}

function writeOk(res: ServerResponse, result: any, status: number = 200) {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
    });

    res.end(JSON.stringify(result));
}

function getBlockByTag(tag: string): Promise<Block> {
    if (tag === 'latest') {
        return Block.getLatest();
    } else if (tag === 'earliest') {
        return Block.getByNumber(0);
    } else if (tag === 'pending') {
        return Block.getLatest();
    } else {
        const number = parseInt(tag, 16);
        return Block.getByNumber(number);
    }
}

class RpcServer {
    chain: Chain;

    constructor(chain: Chain) {
        this.chain = chain;
    }

    getAllChunkData(message: IncomingMessage): Promise<string> {
        return new Promise((resolve) => {
            let result = '';

            message.on('data', (chunk: Buffer) => {
                result += chunk.toString();
            });

            message.on('end', () => {
                resolve(result);
            });
        });
    }

    async sendBlockNumber(res: ServerResponse, data: RpcRequest) {
        const block = await Block.getLatest();

        const result = {
            id: data.id,
            jsonrpc: data.jsonrpc,
            result: numberToHex(block.number),
        };

        writeOk(res, result);
    }

    async sendNetVersion(res: ServerResponse, data: RpcRequest) {
        const result = {
            id: data.id,
            jsonrpc: data.jsonrpc,
            result: configuration.genesis.config.chainId.toString(),
        };

        writeOk(res, result);
    }

    async sendGetBlockByNumber(res: ServerResponse, data: RpcRequest) {
        const blockNumber = parseInt(data.params[0]);
        const block = await Block.getByNumber(blockNumber);
        let resultData: any = block;

        if (!block) {
            const result = {
                id: data.id,
                jsonrpc: data.jsonrpc,
                result: '',
            };

            res.end(JSON.stringify(result));
            return;
        }

        // Convert block wheter or not the hashes should be included
        if (!data.params[1]) {
            if (block.transactions) {
                const transactionHashes = block.transactions.map(tx => tx.id);
                resultData.transactions = transactionHashes;
            }
        }

        // Convert more of the block to a ETH compatible style
        resultData.number = numberToHex(block.number);
        resultData.hash = block.id;
        resultData.parentHash = block.parent;
        resultData.nonce = numberToHex(block.nonce);
        resultData.sha3uncles = '0x';
        resultData.logsBloom = '0x';
        resultData.miner = block.coinbase;

        const result = {
            id: data.id,
            jsonrpc: data.jsonrpc,
            result: resultData,
        };

        writeOk(res, result);
    }

    async sendGetBalance(res: ServerResponse, data: RpcRequest) {
        let block: Block = await getBlockByTag(data.params[1]);

        if (!block) {
            return writeOk(res, {
                id: data.id,
                jsonrpc: data.jsonrpc,
                result: '0x',
            }, 400);
        }

        const state = await GlobalState.create(block.stateRoot);
        const account = await state.findOrCreateAccount(data.params[0]);

        const result = {
            id: data.id,
            jsonrpc: data.jsonrpc,
            result: '0x' + account.balance.toString('hex'),
        };

        writeOk(res, result);
    }

    async sendGetTransactionCount(res: ServerResponse, data: RpcRequest) {
        const blockNumber = data.params[1];
        let block: Block = null;

        if (blockNumber === 'latest') {
            block = await Block.getLatest();
        } else {
            block = await Block.getByNumber(parseInt(blockNumber));
        }

        if (!block) {
            block = await Block.getLatest();
        }

        const state = await GlobalState.create(block.stateRoot);
        const account = await state.findOrCreateAccount(data.params[0]);

        const result = {
            id: data.id,
            jsonrpc: data.jsonrpc,
            result: '0x' + account.nonce.toString('hex'),
        };

        writeOk(res, result);
    }

    async sendRawTransaction(res: ServerResponse, data: RpcRequest) {
        const transaction = Transaction.fromBuffer(data.params[0]);

        this.chain.addTransaction(transaction, '');

        const result = {
            id: data.id,
            jsonrpc: data.jsonrpc,
            result: transaction.id,
        };

        writeOk(res, result);
    }

    async sendGetCode(res: ServerResponse, data: RpcRequest) {
        const block = await getBlockByTag(data.params[1]);
        const globalState = await GlobalState.create(block.stateRoot);
        const account = await globalState.findOrCreateAccount(data.params[0]);
        const ipfsBuffer = await account.getCode(globalState);
        const ipfsHash = hexStringToString('0x' + ipfsBuffer.toString('hex'));

        const ipfs = Ipfs.getInstance(configuration.ipfs);
        const stringifiedCode = await ipfs.cat(ipfsHash);
        const binary = stringToByteArray(stringifiedCode);

        const result = {
            id: data.id,
            jsonrpc: data.jsonrpc,
            result: '0x' + toHex(binary),
        };

        writeOk(res, result);
    }

    async sendGetTransactionByHash(res: ServerResponse, data: RpcRequest) {

        const block = await Block.getByTransactionId(data.params[0]);
        let result = {
            id: data.id,
            jsonrpc: data.jsonrpc,
            result: {},
        }

        if (block) {
            const txInBlockIndex = block.transactions.findIndex(tx => tx.id === data.params[0]);
            const txInBlock = block.transactions[txInBlockIndex];
            const addresses = getAddressFromTransaction(txInBlock);

            result = {
                id: data.id,
                jsonrpc: data.jsonrpc,
                result: {
                    blockHash: block.id,
                    blockNumber: numberToHex(block.number),
                    from: addresses.from,
                    gas: numberToHex(txInBlock.gasLimit),
                    gasPrice: numberToHex(txInBlock.gasPrice),
                    hash: txInBlock.hash(true),
                    input: txInBlock.data,
                    nonce: '0x' + txInBlock.nonce.toString('hex'),
                    to: txInBlock.to,
                    transactionIndex: numberToHex(txInBlockIndex),
                    value: '0x' + txInBlock.value.toString('hex'),
                    v: numberToHex(txInBlock.v),
                    r: txInBlock.r,
                    s: txInBlock.s,
                },
            };
        } else {
            result.result = null;
        }

        writeOk(res, result);
    }

    async sendGetTransactionReceipt(res: ServerResponse, data: RpcRequest) {
        const block = await Block.getByTransactionId(data.params[0]);

        let result = {
            id: data.id,
            jsonrpc: data.jsonrpc,
            result: {},
        }

        if (block) {
            const txInBlockIndex = block.transactions.findIndex(tx => tx.id === data.params[0]);
            const txInBlock = block.transactions[txInBlockIndex];
            const addresses = getAddressFromTransaction(txInBlock);
            const receiptMerkleTree = await createMerkleTree(block.receiptsRoot);
            const receiptBuffer = await receiptMerkleTree.get(txInBlock.id);
            const receipt = decodeReceipt(receiptBuffer);
            let contractAddress: string = null;

            if (!txInBlock.to) {
                contractAddress = rlpHash([
                    txInBlock.nonce,
                    addresses.from,
                ]);

                contractAddress = '0x' + contractAddress.slice(24);
            }

            result.result = {
                transactionHash: txInBlock.id,
                transactionIndex: numberToHex(txInBlockIndex),
                blockHash: block.id,
                blockNumber: numberToHex(block.number),
                from: addresses.from,
                to: addresses.to,
                cumulativeGasUsed: numberToHex(block.gasUsed),
                gasUsed: numberToHex(receipt.gasUsed),
                contractAddress,
                logs: [],
                logsBloom: '0x',
                status: '0x1',
            };
        } else {
            result.result = null;
        }

        writeOk(res, result);
    }

    async sendGasPrice(res: ServerResponse, data: RpcRequest) {
        let result = {
            id: data.id,
            jsonrpc: data.jsonrpc,
            result: '0x09184e72a000',
        }

        writeOk(res, result);
    }

    async sendEstimateGas(res: ServerResponse, data: RpcRequest) {
        let result = {
            id: data.id,
            jsonrpc: data.jsonrpc,
            result: '0x7a1200',
        }

        writeOk(res, result);
    }

    async sendCall(res: ServerResponse, data: RpcRequest) {
        const block = await getBlockByTag(data.params[1]);
        const call = data.params[0];

        const vmParams: VmParams = {
            globalState: await GlobalState.create(block.stateRoot),
            callMessage: {
                depth: 1,
                destination: call.to,
                flags: 1,
                gas: parseInt(call.gas),
                inputData: hexStringToBuffer(call.data),
                inputSize: (call.data.length - 2) / 2,
                kind: CallKind.Call,
                sender: call.from,
                value: new BN(hexStringToBuffer(call.value)),
            },
        };

        const results = await execute(vmParams);

        const result = {
            id: data.id,
            jsonrpc: data.jsonrpc,
            result: results.returnHex,
        };

        writeOk(res, result);
    }

    async handleHttpRequest(req: IncomingMessage, res: ServerResponse) {
        try {
            if (req.method === 'OPTIONS') {
                writeOk(res, {});
                return;
            }

            const data: RpcRequest = JSON.parse(await this.getAllChunkData(req));

            switch(data.method) {
                case 'eth_blockNumber':
                    await this.sendBlockNumber(res, data);
                    break;
                case 'net_version':
                    await this.sendNetVersion(res, data);
                    break;
                case 'eth_getBlockByNumber':
                    await this.sendGetBlockByNumber(res, data);
                    break;
                case 'eth_getBalance':
                    await this.sendGetBalance(res, data);
                    break;
                case 'eth_getTransactionCount':
                    await this.sendGetTransactionCount(res, data);
                    break;
                case 'eth_sendRawTransaction':
                    await this.sendRawTransaction(res, data);
                    break;
                case 'eth_getCode':
                    await this.sendGetCode(res, data);
                    break;
                case 'eth_getTransactionByHash':
                    await this.sendGetTransactionByHash(res, data);
                    break;
                case 'eth_getTransactionReceipt':
                    await this.sendGetTransactionReceipt(res, data);
                    break;
                case 'eth_gasPrice':
                    await this.sendGasPrice(res, data);
                    break;
                case 'eth_estimateGas':
                    await this.sendEstimateGas(res, data);
                    break;
                case 'eth_call':
                    await this.sendCall(res, data);
                    break;
                default:
                    Logger.warn('Missing method ', data.method, data);
                    break;
            }
        } catch (error) {
            res.writeHead(400, {
                'Content-Type': 'application/json',
            });

            console.log('[RPC] error -> ', error);

            res.end(JSON.stringify({
                message: 'Input should be JSON',
            }));
        }
    }

    open(port: number) {
        if (!isNodeJs()) {
            throw new Error('Only non-browser nodes can run a HTTP server');
        }

        const http = require('http');
        const httpServer = http.createServer(this.handleHttpRequest.bind(this));

        httpServer.listen(port, '0.0.0.0');

        Logger.info(`RPC HTTP Server listening on port ${port}`);
    }
}

export default RpcServer;
