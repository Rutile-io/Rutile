# ![](./res/img/Rutile.png)

Rutile is a fee-less decentralized application platform. You can store files, create smart contracts and transfer tokens.
Rutile is Ethereum compatible, it works with your current wallets. Just adjust the provider to localhost:8545

Rutile is currently in development but is actively worked on.

## Running Rutile

Rutile is developed in TypeScript and requires node.js.

```JavaScript
npm install
```

For testing the node server:
```JavaScript
npm run start:node
```

You can use wallets like Metamask and use the custom provider (localhost:8545) to transfer value around.

## Features of Rutile:

- Create and run smart contracts (using WebAssembly) & be compatible with Ethereum smart contracts
- RUT Token transfer
- Store files in the Rutile network using IPFS
- Re-use your Ethereum private keys & addresses in Rutile

## More info

- [Rutile Virtual Machine](https://github.com/Rutile-io/Rutile/tree/develop/src/js/core/rvm)

Currently testing is done in `src/js/index.ts`.

## Contributing to Rutile


For contributing create a PR or contact Franklin Waller: f.waller@rutile.io

For more information see: https://rutile.io

If you want to support the project by donating to Rutile you can use the address: `0x42b904bcA15eb96488912456C17475ce33e0d3cF`
