import { Request, Response, NextFunction } from 'express';

export function validateAuth(req: Request, res: Response, next: NextFunction) {
  next();
}
