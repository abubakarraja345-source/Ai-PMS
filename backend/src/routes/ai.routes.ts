import { Router } from 'express';

export const aiRouter = Router();

aiRouter.get('/', (req, res) => {
  res.json({ message: 'AI route' });
});
