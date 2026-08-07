import { Request, Response, NextFunction } from 'express';

export function validateAi(req: Request, res: Response, next: NextFunction) {
  next();
}
