import { Router } from 'express';

export const integrationRouter = Router();

integrationRouter.get('/', (req, res) => {
  res.json({ message: 'Integration route' });
});
