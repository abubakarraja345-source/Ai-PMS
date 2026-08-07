import { Router } from 'express';

export const maintenanceRouter = Router();

maintenanceRouter.get('/', (req, res) => {
  res.json({ message: 'Maintenance route' });
});
