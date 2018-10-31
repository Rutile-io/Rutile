interface ITerminalController {
    write(output: string): void;
    writeLine(output: string): void;
    reset(): void;
    input(inputQuestion?: string): Promise<string>;
}

export default ITerminalController;