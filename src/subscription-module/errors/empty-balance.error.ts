export class EmptyBalanceException extends Error {
    constructor(message: string) {
        super();
        this.message = message;
    }
}