import { WasmFs } from "@wasmer/wasmfs";
import VirtualContext from "../VirtualContext";
import Logger = require("js-logger");

interface OpenFiles {
    fd: number;
    path: string;
    buffer?: Buffer;
}

class WasiFileSystem {
    wasmFs: WasmFs;
    virtualContext: VirtualContext;
    isExecuting: boolean = false;
    env: {
        [key: string]: string;
    };

    openFiles: OpenFiles[] = [];

    preopenDirectories: {
        [key: string]: string;
    };

    constructor(env: any, virtualContext: VirtualContext) {
        this.env = env;
        this.virtualContext = virtualContext;
    }

    private overwriteFunctions() {
        const originalOpen = this.wasmFs.fs.openSync;
        this.wasmFs.fs.openSync = (path: string, flags: any, mode?: any) => {
            try {
                // The path we are opening is a storage key->value pair
                // We need to preload it..
                if (path.includes(this.env['$HOME']) && this.isExecuting) {
                    const key = path.replace(this.env['$HOME'] + '/', '');

                    // Make sure we got a key to work with
                    if (key) {
                        const value = this.virtualContext.callContext('storageLoad', [key]);
                        this.wasmFs.fs.writeFileSync(path, value);
                    }
                }

                const fd = originalOpen(path, flags, mode);

                // Keep the open files in mind, so we can make sure what the key->value pairs are
                this.openFiles.push({
                    fd,
                    path,
                });

                return fd;
            } catch(err) {
                console.error('Error ->', path, err);
            }
        };

        const originalWriteSync = this.wasmFs.fs.writeSync;
        this.wasmFs.fs.writeSync = (fd: number, buffer: any, offset?: any, length?: any, position?: any) => {
            // Since everything is synchronous but setting of values is
            const openFile = this.openFiles.find(openFile => openFile.fd === fd);

            // It's possible that it's writing to the stdout file
            // We should not do anything with it then.
            if (openFile) {
                openFile.buffer = buffer;

                // Extract the "key" from the path
                const splittedPath = openFile.path.split('/');
                const key = splittedPath[splittedPath.length - 1];

                // Call the method on the WasiContext side
                // this blocks the worker thread and waits for a result
                this.virtualContext.callContext('storageStore', [
                    key,
                    buffer,
                ]);
            }

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
