import isNodeJs from "../../services/isNodeJs";
import * as Logger from 'js-logger';
import { configuration } from "../../Configuration";
import { IncomingMessage, ServerResponse } from "http";
import Block from "../../models/Block";
import { numberToHex } from "../../utils/hexUtils";
import GlobalState from "../../models/GlobalState";
import Transaction from "../../models/Transaction";
import Chain from "../chain/Chain";
import { getAddressFromTransaction } from "../chain/lib/services/TransactionService";
import { createZerosArray, toHex } from "../rvm/utils/hexUtils";

interface RpcRequest {
    id: number;
    jsonrpc: string;
    params: any[];
    method: string;
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

        res.writeHead(200, {
            'Content-Type': 'application/json',
        });

        res.end(JSON.stringify(result));
    }

    async sendNetVersion(res: ServerResponse, data: RpcRequest) {
        const result = {
            id: data.id,
            jsonrpc: data.jsonrpc,
            result: configuration.genesis.config.chainId.toString(),
        };

        res.writeHead(200, {
            'Content-Type': 'application/json',
        });

        res.end(JSON.stringify(result));
    }

    async sendGetBlockByNumber(res: ServerResponse, data: RpcRequest) {
        const blockNumber = parseInt(data.params[0]);
        const block = await Block.getByNumber(blockNumber);
        let resultData: any = block;

        res.writeHead(200, {
            'Content-Type': 'application/json',
        });

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
        resultData.sha3uncles = '0x00';
        resultData.logsBloom = '0x00';
        resultData.miner = block.coinbase;

        const result = {
            id: data.id,
            jsonrpc: data.jsonrpc,
            result: resultData,
        };

        res.end(JSON.stringify(result));
    }

    async sendGetBalance(res: ServerResponse, data: RpcRequest) {
        const blockNumber = data.params[1];
        let block: Block = null;

        if (blockNumber === 'latest') {
            block = await Block.getLatest();
        } else {
            block = await Block.getByNumber(parseInt(blockNumber));
        }

        if (!block) {
            Logger.error('RPC Api failed with block', blockNumber);
        }

        const state = await GlobalState.create(block.stateRoot);
        const account = await state.findOrCreateAccount(data.params[0]);

        const result = {
            id: data.id,
            jsonrpc: data.jsonrpc,
            result: '0x' + account.balance.toString('hex'),
        };

        res.writeHead(200, {
            'Content-Type': 'application/json',
        });

        res.end(JSON.stringify(result));
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

        res.writeHead(200, {
            'Content-Type': 'application/json',
        });

        res.end(JSON.stringify(result));
    }

    async sendRawTransaction(res: ServerResponse, data: RpcRequest) {
        const transaction = Transaction.fromBuffer(data.params[0]);

        this.chain.addTransaction(transaction, '');

        const result = {
            id: data.id,
            jsonrpc: data.jsonrpc,
            result: transaction.id,
        };

        res.writeHead(200, {
            'Content-Type': 'application/json',
        });

        res.end(JSON.stringify(result));
    }

    async sendGetCode(res: ServerResponse, data: RpcRequest) {
        const result = {
            id: data.id,
            jsonrpc: data.jsonrpc,
            result: '',
        };

        res.writeHead(200, {
            'Content-Type': 'application/json',
        });

        res.end(JSON.stringify(result));
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
                    // @ts-ignore
                    blockHash: block.id,
                    // @ts-ignore
                    blockNumber: block.number,
                    from: addresses.from,
                    gas: txInBlock.gasLimit,
                    gasPrice: txInBlock.gasPrice,
                    hash: txInBlock.hash(true),
                    input: txInBlock.data,
                    nonce: txInBlock.nonce,
                    to: txInBlock.to,
                    // @ts-ignore
                    transactionIndex: txInBlockIndex,
                    value: '0x' + txInBlock.value.toString('hex'),
                    v: numberToHex(txInBlock.v),
                    r: txInBlock.r,
                    s: txInBlock.s,
                },
            };
        } else {
            result.result = null;
        }

        res.writeHead(200, {
            'Content-Type': 'application/json',
        });

        res.end(JSON.stringify(result));
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

            result.result = {
                transactionHash: txInBlock.id,
                transactionIndex: txInBlockIndex,
                blockHash: block.id,
                blockNumber: block.number,
                from: addresses.from,
                to: addresses.to,
                cumulativeGasUsed: block.gasUsed,
                gasUsed: txInBlock.gasUsed,
                // @ts-ignore
                contractAddress: null,
                logs: [],
                logsBloom: '0x' + toHex(createZerosArray(32)),
                status: 1,
            };
        } else {
            result.result = null;
        }

        res.writeHead(200, {
            'Content-Type': 'application/json',
        });

        res.end(JSON.stringify(result));
    }

    async sendGasPrice(res: ServerResponse, data: RpcRequest) {
        let result = {
            id: data.id,
            jsonrpc: data.jsonrpc,
            result: '0x09184e72a000',
        }

        res.writeHead(200, {
            'Content-Type': 'application/json',
        });

        res.end(JSON.stringify(result));
    }

    async handleHttpRequest(req: IncomingMessage, res: ServerResponse) {
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
            default:
                Logger.warn('Missing method ', data.method, data);
                break;
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
