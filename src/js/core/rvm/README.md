# Rutile Virtual Machine

The RVM is a virtual machine that runs WASM programs. It exposes multiple functions following the [ewasm](https://github.com/ewasm/design) design spec.
Because we are using WASM, a developer can write in any programming language.

## How does it work?

Since the RVM is written in JavaScript a single threaded programming language, we had to make a few changes. 

- The RVM runs inside a Worker (Node.js uses the expiremental Worker)
- RVM uses SharedArrayBuffers and Atomics. (Both were disabled in browser, but are slowely coming back)
- To make sure no mallicious code can be executed we are sandboxing the WASM execution via Nodejs VM (For the browser that will be an iframe without any context or window API's)

## Getting started

The RVM is designed to be used with the Rutile code base. (We will however decouple the code in the future). For now this is the best way of testing:

```JavaScript
import Rutile from './Rutile';

async function run() {
    // Deploy the WASM code
    const file = fs.readFileSync('PATH_TO_WASM');
    const wasm = new Uint8Array(file);
    const hash = await rutile.deploy(wasm);

    const transaction = new Rutile.Transaction({
        to: hash,
        data: '0x00000001',
        value: 0,
        transIndex: 1,
    });

    await transaction.execute();
}

run();
```

This will trigger the RVM to execute the `main()` function inside your WASM.








