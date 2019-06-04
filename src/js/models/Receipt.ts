class Receipt {
    blockHash: string;
    blockNumber: number;
    transactionHash: string;
    transactionIndex: number;
    from: string;
    to: string;
    cumulativeGasUsed: number;
    gasUsed: number;
    status: string;
    contractAddress: string;
    logs: any[];
    result: string;

    encode() {

    }

    decode() {

    }
}

export default Receipt;
