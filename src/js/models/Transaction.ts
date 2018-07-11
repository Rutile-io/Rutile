interface TransactionConstructor {
    from: string | null,
    to: string,
    gasPrice: string | null,
    gasLimit: string | null,
    nonce: string,
    value: string,
    data: string | null,
}

class Transaction {
    from: string | null;
    to: string;
    value: string;
    gasPrice: string | null;
    gasLimit: string | null;
    nonce: string;
    data: string | null;

    constructor({
        gasLimit,
        gasPrice,
        data,
        nonce,
        value,
        to,
        from,
    }: TransactionConstructor) {
        this.from = from;
        this.to = to;
        this.gasPrice = gasPrice;
        this.gasLimit = gasLimit;
        this.data = data;
        this.nonce = nonce;
        this.value = value;
    }
}

export default Transaction;
