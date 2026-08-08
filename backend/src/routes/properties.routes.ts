import { Router } from 'express';

export const propertyRouter = Router();

propertyRouter.get('/', (req, res) => {
  res.json({ message: 'Property route' });
});
