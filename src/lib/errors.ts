export class HttpError extends Error {
  constructor(
    public status: number,
    public messageKey: string,
  ) {
    super(messageKey);
  }
}

export const badRequest = (key = "errors.badRequest") => new HttpError(400, key);
export const unauthorized = (key = "errors.unauthorized") => new HttpError(401, key);
export const forbidden = (key = "errors.forbidden") => new HttpError(403, key);
export const notFound = (key = "errors.notFound") => new HttpError(404, key);
export const conflict = (key = "errors.conflict") => new HttpError(409, key);
