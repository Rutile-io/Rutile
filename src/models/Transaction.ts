interface TransactionConstructor {
    from: string,
    to: string,
    gasPrice: string,
    gasLimit: string,
    nonce: string,
    value: string,
    data: string,
}

class Transaction {
    from: string;
    to: string;
    value: string;
    gasPrice: string;
    gasLimit: string;
    nonce: string;
    data: string;

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
