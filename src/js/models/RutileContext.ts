class RutileContext {
    public data: any[];
    public state: any;
    public funcToExecute: string;

    constructor(state: any, data: any[]) {
        this.data = data;
        this.state = state;
    }
}

export default RutileContext;
