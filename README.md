# ![](./res/img/Rutile.png)

Rutile is a fee-less decentralized application platform. You can store files, create smart contracts and transfer tokens.
Rutile is not based on blockchain but rather on a Directed Acyclic Graph. This allows for fee less transactions, better scalibility and faster confirmations.

Rutile is currently in development but is actively worked on.

## Features of Rutile:

- Create and run smart contracts (using WebAssembly) & be compatible with Ethereum smart contracts
- Paralize execution (DAG)
- RUT Token transfer
- Store files in the Rutile network using IPFS
- Re-use your Ethereum private keys & addresses in Rutile

## Running Rutile

Rutile is developed in TypeScript and requires node.js.

```JavaScript
npm install
```

For testing the node server:
```JavaScript
npm run start:node
```
And for testing on the brower/client
```JavaScript
npm start
```

Currently testing is done in `src/js/index.ts`.

## Contributing to Rutile


For contributing create a PR or contact Franklin Waller: f.waller@rutile.io

For more information see: https://rutile.io
