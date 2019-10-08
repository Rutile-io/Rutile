import Block from "../../../../models/Block";
import GlobalState from "../../../../models/GlobalState";

/**
 * Gets the parent global state using the current block
 *
 * @export
 * @param {Block} block
 * @returns
 */
export default async function getParentGlobalStateByBlock(block: Block): Promise<GlobalState> {
    if (block.isGenesis()) {
        return GlobalState.create(null);
    }

    const parentBlock = await Block.getById(block.parent);
    return GlobalState.create(parentBlock.stateRoot);
}
