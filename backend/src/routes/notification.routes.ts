import { Router } from 'express';

export const notificationRouter = Router();

notificationRouter.get('/', (req, res) => {
  res.json({ message: 'Notification route' });
});
