import Block from "../../../models/Block";

const resolvers = {
    Query: {
        block: async (parent: any, args: any, context: any, info: any) => {
            const block = await Block.getById(args.ID);
            return block;
        },

        getBlockByNumber: async (parent: any, args: any, context: any, info: any) => {
            const block = await Block.getByNumber(args.id);
            return block;
        }
    }
};

export default resolvers;
