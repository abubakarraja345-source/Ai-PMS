import { Request, Response, NextFunction } from 'express';

export function validateIntegrations(req: Request, res: Response, next: NextFunction) {
  next();
}
