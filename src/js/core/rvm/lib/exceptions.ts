import { tsConstructorType } from "@babel/types";

export enum VM_ERROR {
    REVERT = 'revert',
    OUT_OF_GAS = 'out of gas',
}

export class VmError extends Error {
    error: string;
    errorType: string;

    constructor(error: VM_ERROR) {
        super();
        this.error = error;
        this.errorType = 'VmError';
    }
}

export class FinishExecution extends Error {
    message: string;
    name: string;
    errorType: string;

    constructor(message: string) {
        super();
        this.message = message;
        this.name = this.errorType = 'FinishExecution';
    }
}
