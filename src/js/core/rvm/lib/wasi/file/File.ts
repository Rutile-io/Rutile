import IWasi from "../IWasi";
import { WASI_EPERM } from "../Codes";

export default class File {
    wasi: IWasi;

    constructor(wasi: IWasi) {
        this.wasi = wasi;
    }

    stat(fd: number) {

    }

    checkFd(fd: number, rights: number) {
        const stats = this.stat(fd);

        if (rights !== 0) {
            throw WASI_EPERM;
        }

        return stats;
    }
}
