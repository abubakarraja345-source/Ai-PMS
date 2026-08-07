import { Request, Response, NextFunction } from 'express';

export function validateReservations(req: Request, res: Response, next: NextFunction) {
  next();
}
