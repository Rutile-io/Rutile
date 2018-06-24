import Program from "./Program";
import Executable from "./Executable";

const program = new Program('HelloWorld');
const executable = new Executable((process) => {
    while (true) {
        console.log(100);
    }

    // process.wavePoint('CALCULATED_VALUE', calculatingValue);

});

program.addExecutable(executable);

program.execAll();
