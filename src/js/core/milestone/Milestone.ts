import Block from "../../models/Block";
import Dag from "../dag/Dag";

/**
 * Milestone represents the main chain inside the network.
 * All shards originate from this chain
 *
 * @class Milestone
 */
class Milestone {
    currentBlock: Block;
    dag: Dag;

    constructor(dag: Dag) {
        this.dag = dag;
    }

    onBlockAdded(block: Block) {
        console.log('[Milestone] block -> ', block);

        if (block.number > this.currentBlock.number) {
            console.log('Block number changed, someone mined it');
        }
    }

    async prepareNextBlock() {
        // Looking for blocks..
        const block = new Block({
            number: this.currentBlock.number + 1,
        });

        // TODO: Should add transactions that change the state of the shards..

        const randomReferenceBlock = await this.dag.walker.getBlocksToValidate(this.currentBlock.number, 1);
        const blocksToAdd = [this.currentBlock];
        blocksToAdd.push(...randomReferenceBlock);

        block.addParents(blocksToAdd);
        block.proofOfWork(true);
    }

    start() {
        // Let the rest of the application know it's valid.
        this.dag.on('blockAdded', (block: Block) => this.onBlockAdded(block));
    }
}

export default Milestone;
