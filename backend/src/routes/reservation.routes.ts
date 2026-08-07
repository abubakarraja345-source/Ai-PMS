import { Router } from 'express';

export const reservationRouter = Router();

reservationRouter.get('/', (req, res) => {
  res.json({ message: 'Reservation route' });
});
