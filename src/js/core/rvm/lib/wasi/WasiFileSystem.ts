import { WasmFs } from "@wasmer/wasmfs";

interface OpenFiles {
    fd: number;
    path: string;
    buffer?: Buffer;
}

class WasiFileSystem {
    wasmFs: WasmFs;
    env: {
        [key: string]: string;
    };

    openFiles: OpenFiles[];

    preopenDirectories: {
        [key: string]: string;
    };

    constructor(env: any) {
        this.env = env;
    }

    private overwriteFunctions() {
        const originalOpen = this.wasmFs.fs.openSync;
        this.wasmFs.fs.openSync = (path: any, flags: any, mode?: any) => {
            const fd =  originalOpen(path, flags, mode);

            // Keep the open files in mind, so we can make sure what the key->value pairs are
            this.openFiles.push({
                fd,
                path,
            });

            return fd;
        };

        const originalWriteFileSync = this.wasmFs.fs.writeFileSync;
        this.wasmFs.fs.writeFileSync = (path, text) => {
            originalWriteFileSync(path, text);
        };

        const originalWriteFile = this.wasmFs.fs.writeFile;
        this.wasmFs.fs.writeFile = (id: any, data: any, callback: any) => {
            originalWriteFile(id, data, callback);
        };

        const originalWriteSync = this.wasmFs.fs.writeSync;
        this.wasmFs.fs.writeSync = (fd: any, buffer: any, offset?: any, length?: any, position?: any) => {


            return originalWriteSync(fd, buffer, offset, length, position);
        };
    }

    public async create() {
        this.wasmFs = new WasmFs();

        this.wasmFs.fs.mkdirSync(this.env["$HOME"], {
            recursive: true
        });

        this.preopenDirectories = {
            [this.env["$HOME"]]: this.env["$HOME"]
        };

        this.overwriteFunctions();

        return this.wasmFs;
    }
}

export default WasiFileSystem;
