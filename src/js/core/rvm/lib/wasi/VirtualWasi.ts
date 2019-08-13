import File from "./file/File";
import IWasi from "./IWasi";
import { WASI_RIGHT_FD_WRITE } from "./Codes";

class VirtualWasi implements IWasi {
    file: File;

    constructor() {
        this.file = new File(this);
    }

    fd_write(fd: number, iovs: number, iovsLen: number, nwritten: number) {
        console.log('[] fd -> ', fd);
        const stats = this.file.checkFd(fd, WASI_RIGHT_FD_WRITE);
    }

    environ_get(...args: any[]) {
        console.log('[] args -> ', args);
    }

    getExposedFunctions() {
        // return {};

        return {
            args_sizes_get: () => { console.log('Args sizes get') },
            args_get: () => { console.log('Get') },
            environ_get: () => this.environ_get.bind(this),
            environ_sizes_get: () => { console.log('hi') },
            proc_exit: () => { console.log('Exist'); },
            fd_write: () => { console.log('fd_write') },
            // fd_write: this.fd_write.bind(this),
            path_open: () => { console.log('Path open') }
        }
    }
}

export default VirtualWasi;
