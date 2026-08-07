import { Router } from 'express';

export const calendarRouter = Router();

calendarRouter.get('/', (req, res) => {
  res.json({ message: 'Calendar route' });
});
