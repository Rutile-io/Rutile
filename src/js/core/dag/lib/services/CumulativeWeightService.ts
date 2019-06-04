import * as Logger from 'js-logger';
import getAllBlocksStream from '../transaction/getAllBlocksStream';
import Block from '../../../../models/Block';
import { getBlockById } from './BlockService';
const toposort = require('toposort');

function getBlocksInTopologicalOrder(): Promise<string[]> {
    return new Promise((resolve) => {
        const graph: [string, string][] = [];
        const blocks = getAllBlocksStream();

        blocks.on('data', (blockBuffer: Buffer) => {
            const block = Block.fromRaw(blockBuffer.toString());
            block.parents.forEach((parentBlockId) => {
                graph.push([block.id, parentBlockId]);
            });
        });

        blocks.on('end', () => {
            const sorted: string[] = toposort(graph);

            // Make sure we don't get any undefined items.
            const filtered = sorted.filter((item) => item);

            resolve(filtered);
        });
    });
}

async function updateApprovers(blockApprovers: Map<string, string[]>, blockId: string): Promise<Map<string, string[]>>  {
    const approvers = blockApprovers.get(blockId);
    const block = await getBlockById(blockId);

    if (!block) {
        Logger.debug(`Missing block ${blockId}`);
        return blockApprovers;
    }

    block.parents.forEach((parentBlockId) => {
        const parentApprovers = createApprovers(blockApprovers, blockId, approvers, parentBlockId);
        blockApprovers.set(parentBlockId, parentApprovers);
    });

    // We've already calculated this transactionId. We can forget it.
    blockApprovers.delete(blockId);

    return blockApprovers;
}

function createApprovers(blockApprovers: Map<string, string[]>, blockId: string, approvers: string[], trunkHash: string): string[] {
    const approverSet: string[] = (approvers && approvers.length) ? approvers : [];
    const hashesToAdd = blockApprovers.get(trunkHash);

    if (hashesToAdd) {
        for (let i = 0; i < hashesToAdd.length; i++) {
            if (!approverSet.includes(hashesToAdd[i])) {
                approverSet.push(hashesToAdd[i]);
            }
        }
    }

    // Since the block that points to it confirms this block
    approverSet.push(blockId);

    return approverSet;
}

function updateCumulativeWeight(blockApprovers: Map<string, string[]>, blockCumulativeWeights: Map<string, number>, blockId: string): Map<string, number> {
    const approvers = blockApprovers.get(blockId);
    let cumulativeWeight = (approvers ? approvers.length : 0) + 1;

    blockCumulativeWeights.set(blockId, cumulativeWeight);
    return blockCumulativeWeights;
}

async function calculateCumulativeWeight(blockIds: string[]) {
    let blockApprovers = new Map<string, string[]>();
    let blockCumulativeWeights = new Map<string, number>();

    for (const blockId of blockIds) {
        blockCumulativeWeights = updateCumulativeWeight(blockApprovers, blockCumulativeWeights, blockId);
        blockApprovers = await updateApprovers(blockApprovers, blockId);
    }

    return blockCumulativeWeights;
}

export default async function getBlocksCumulativeWeights() {
    Logger.debug(`Calculating cumulative weight`);
    const sortedBlocks = await getBlocksInTopologicalOrder();
    return calculateCumulativeWeight(sortedBlocks);
}
