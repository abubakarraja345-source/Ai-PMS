import { Router } from 'express';
import { ReservationsController } from './controller';

export const ReservationsRouter = Router();

ReservationsRouter.get('/', ReservationsController.getAll);
