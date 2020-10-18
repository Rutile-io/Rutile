import { ApolloServer, gql } from 'apollo-server';
import * as block from './Block';

import Chain from "../chain/Chain";
import * as Logger from 'js-logger';

export default async function bootGraphQlServer(chain: Chain, ipfsNode: any) {
    Logger.info('🚀 Booting GraphQL server');
    const typeDef = gql`
        type Query
    `;

    const server = new ApolloServer({
        typeDefs: [typeDef, block.typeDef],
        resolvers: [block.resolvers],
    });

    const serverInfo = await server.listen();
    Logger.info(`🚀 GraphQL listening on ${serverInfo.url}`);
}
