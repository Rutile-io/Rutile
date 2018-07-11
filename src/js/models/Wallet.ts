const WALLET_LOCATION = 'wallet_storage';

export interface WalletConstructor {
    new (privateKey: string): Wallet;
    getFromStorage(): Wallet;
}

export interface Wallet {
    getBalance(): Promise<string>;
    sign(transaction: any): Promise<void>;
}