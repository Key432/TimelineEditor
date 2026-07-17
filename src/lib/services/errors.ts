export class ServiceError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 404 | 409,
    readonly code: string,
    readonly issues?: unknown,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
