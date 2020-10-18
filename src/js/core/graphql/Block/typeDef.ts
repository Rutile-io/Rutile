import { gql } from 'apollo-server';

const typeDef = gql`
    type Block {
        id: String
        number: Int
        timestamp: Int
        nonce: Int
        stateRoot: String
        gasUsed: Int
        gasLimit: Int
        coinbase: String
        s: String
        r: String
        v: String
        parent: String
    }

    extend type Query {
        block(ID: String!): Block
        getBlockByNumber(id: Int!): Block
    }
`;

export default typeDef;
