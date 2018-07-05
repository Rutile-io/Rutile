import Program from "./Program";
import Executable from "./Executable";

const program = new Program('HelloWorld');
const executable = new Executable(() => {
    postMessage(JSON.stringify({
        type: 'success',
        value: 'TEST',
    }));
});

program.addExecutable(executable);

program.execAll().then((results) => {
    console.log(results);
});
