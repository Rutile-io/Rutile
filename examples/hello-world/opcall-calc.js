const fs = require('fs');

async function run() {
    const buf = fs.readFileSync('./main.wasm');
    const instance = (await WebAssembly.instantiate(new Uint8Array(buf), {})).instance;
    
    console.log('[] lib -> ', instance.exports.add(3, 10));
}

run();