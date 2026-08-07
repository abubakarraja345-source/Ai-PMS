import { Router } from 'express';

export const settingsRouter = Router();

settingsRouter.get('/', (req, res) => {
  res.json({ message: 'Settings route' });
});
