import { Router } from 'express';

export const authRouter = Router();

authRouter.get('/', (req, res) => {
  res.json({ message: 'Auth route' });
});
