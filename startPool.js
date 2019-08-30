const { spawn } = require('child_process');
const http = require('http');
/**
 * Pool testing script
 *
 * Creates a pool of nodes to use for testing
 */

const configs = [
    {
        port: 1240,
        databaseName: 'db_rutile',
        privateKey: 'C0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DE',
    },
    {
        port: 1234,
        databaseName: 'db_rutile1234',
        privateKey: '20DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DE',
    },
    {
        port: 1236,
        databaseName: 'db_rutile1236',
        privateKey: '30DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DE',
    },
    {
        port: 1235,
        databaseName: 'db_rutile1235',
        privateKey: '40DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DE',
    },
    {
        port: 1237,
        databaseName: 'db_rutile1237',
        privateKey: '50DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DE',
    },
    {
        port: 1238,
        databaseName: 'db_rutile1238',
        privateKey: '60DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DE',
    },
    {
        port: 1239,
        databaseName: 'db_rutile1239',
        privateKey: '70DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DE',
    },
    {
        port: 1230,
        databaseName: 'db_rutile1230',
        privateKey: '80DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DE',
    },
];

const nodes = [];

function spawnNode(port, dbName, pk) {
    const node = spawn('node', ['./build/rutile.js', '--port', port, '--databaseName', dbName, '--privateKey', pk, '--nodesListUrl', 'http://localhost:8903/examples/network-file/RutileNodes.json']);
    nodes.push(node);

    node.stdout.on('data', (data) => {
        console.log(`Node[${port}:${dbName}] -> ${data}`);
    });

    node.stderr.on('data', (data) => {
        console.error(`Node[${port}:${dbName}] -> ${data}`);
    });
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

const onlineNodes = [];

function startNodeListServer() {
    const httpServer = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.writeHead(200, {
            'Content-Type': 'application/json',
        });

        const result = onlineNodes.map((config) => {
            return {
                nodeId: config.databaseName,
                nodeUrl: `http://localhost:${config.port}`,
                dbUrl: `http://localhost:5984/${config.databaseName}`,
            };
        });

        res.end(JSON.stringify(result));
    });

    httpServer.listen(8903, '0.0.0.0');
}

async function startPool() {
    startNodeListServer();

    for (const config of configs) {
        await sleep(10000);
        onlineNodes.push(config);
        spawnNode(config.port, config.databaseName, config.privateKey);
    }

    // configs.forEach((config) => {
    // });


}


startPool();
