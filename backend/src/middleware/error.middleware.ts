import { Request, Response, NextFunction } from "express";

/**
 * Last-resort safety net. Every route already wraps its own logic in
 * try/catch and returns the standard {success,error} shape itself, so
 * in practice this only fires for something outside a controller's
 * own try/catch (e.g. a synchronous throw in middleware) — but without
 * it, that case would fall through to Express's default HTML error
 * page instead of the JSON shape every client integration expects.
 * The 4-arg signature is what makes Express treat this as error-
 * handling middleware; it must be registered last, after all routes.
 */
export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) {
  console.error(err);
  res.status(500).json({ success: false, error: "Internal server error" });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ success: false, error: "Not found" });
}
