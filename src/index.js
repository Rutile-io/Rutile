import Program from "./Program";
import Executable from "./Executable";
import Node from "./node/Node";

// Setup a node in this instance..
const node = new Node();
node.connect();

console.log(node);

// // Execute a program
// const program = new Program('HelloWorld');
// const executable = new Executable(() => {
//     postMessage(JSON.stringify({
//         type: 'success',
//         value: 'TEST',
//     }));
// });

// program.addExecutable(executable);

// program.execAll().then((results) => {
//     console.log(results);
// });
