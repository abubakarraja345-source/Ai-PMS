import { Request, Response, NextFunction } from 'express';

export function validateCalendar(req: Request, res: Response, next: NextFunction) {
  next();
}
