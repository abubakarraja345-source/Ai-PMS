import { Router } from 'express';

export const guestRouter = Router();

guestRouter.get('/', (req, res) => {
  res.json({ message: 'Guest route' });
});
