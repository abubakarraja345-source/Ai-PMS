import { Router } from 'express';

export const cleaningRouter = Router();

cleaningRouter.get('/', (req, res) => {
  res.json({ message: 'Cleaning route' });
});
