const { spawn } = require('child_process');
const http = require('http');
/**
 * Pool testing script
 *
 * Creates a pool of nodes to use for testing
 */

const configs = [
    {
        port: 1234,
        databaseName: 'db_rutile1234',
    },
    {
        port: 1236,
        databaseName: 'db_rutile1236',
    },
    {
        port: 1235,
        databaseName: 'db_rutile1235',
    },
    {
        port: 1237,
        databaseName: 'db_rutile1237',
    },
    {
        port: 1238,
        databaseName: 'db_rutile1238',
    },
    {
        port: 1239,
        databaseName: 'db_rutile1239',
    },
    {
        port: 1230,
        databaseName: 'db_rutile1230',
    },
];

const nodes = [];

function spawnNode(port, dbName) {
    const node = spawn('node', ['./build/rutile.js', '--port', port, '--databaseName', dbName]);
    nodes.push(node);

    node.stdout.on('data', (data) => {
        console.log(`Node[${port}] -> ${data}`);
    });

    node.stderr.on('data', (data) => {
        console.error(`Node[${port}] -> ${data}`);
    });
}

async function startPool() {
    configs.forEach((config) => {
        spawnNode(config.port, config.databaseName);
    });

    const httpServer = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.writeHead(200, {
            'Content-Type': 'application/json',
        });

        const result = configs.map((config) => {
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


startPool();
