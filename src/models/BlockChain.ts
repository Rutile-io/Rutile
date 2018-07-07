import Block from './Block';
import Transaction from './Transaction';

class BlockChain {
    chain: Block[];
    nodes: string[];
    difficulty: number;
    pendingTransactions: Transaction[];
    miningReward: number;

    constructor(genesisNode: string) {
        this.chain = [this.createGenesisBlock()];
        this.nodes = [genesisNode];
        this.difficulty = 4;
        this.pendingTransactions = [];
        this.miningReward = 100;
    }

    registerNode(nodeUrl: string) {
        if (!this.nodes.includes(nodeUrl)) {
            this.nodes.push(nodeUrl);
        }
    }

    retrieveNodes() {
        return this.nodes;
    }

    updateBlockChain(newChain: Block[]) {
        this.chain = newChain;
    }

    getLatestBlock(): Block {
        return this.chain[this.chain.length - 1];
    }

    createGenesisBlock(): Block {
        return new Block(Date.parse('2017-01-01'), [], '0');
    }

    minePendingTransactions(mininRewardAddress: string) {
        const block = new Block(Date.now(), this.pendingTransactions, this.getLatestBlock().hash);
        block.mineBlock(this.difficulty);

        this.chain.push(block);

        this.pendingTransactions = [
            new Transaction({
                from: null,
                to: mininRewardAddress,
                data: null,
                gasLimit: null,
                gasPrice: null,
                nonce: block.nonce.toString(),
                value: this.miningReward.toString(),
            }),
        ];
    }

    createTransaction(transaction: Transaction) {
        this.pendingTransactions.push(transaction);
    }

    getBalanceOfAddress(address: string): number {
        let balance: number = 0;

        for (const block of this.chain) {
            for(const transaction of block.transactions) {
                if (transaction.from === address) {
                    balance -= parseInt(transaction.value);
                }

                if (transaction.to === address) {
                    balance += parseInt(transaction.value);
                }
            }
        }

        return balance;
    }

    isChainValid(): boolean {
        for(let i = 1; i < this.chain.length; i++) {
            const currentBlock = this.chain[i];
            const previousBlock = this.chain[i - 1];

            if (currentBlock.hash !== currentBlock.calculateHash()) {
                return false;
            }

            if (currentBlock.previousHash !== previousBlock.hash) {
                return false;
            }
        }

        return true;
    }
}

export default BlockChain;
