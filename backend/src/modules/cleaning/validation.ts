import { Request, Response, NextFunction } from 'express';

export function validateCleaning(req: Request, res: Response, next: NextFunction) {
  next();
}
