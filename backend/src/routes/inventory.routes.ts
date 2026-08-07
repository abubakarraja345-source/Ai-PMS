import { Router } from 'express';

export const inventoryRouter = Router();

inventoryRouter.get('/', (req, res) => {
  res.json({ message: 'Inventory route' });
});
