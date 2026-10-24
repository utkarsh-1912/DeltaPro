/** Error with an HTTP status, thrown by services and mapped to JSON by the API layer. */
export class HttpError extends Error {
    constructor(public status: number, message: string, public details?: unknown) {
        super(message);
    }
}
