import { Request, Response, NextFunction } from 'express';

export function validateGuests(req: Request, res: Response, next: NextFunction) {
  next();
}
