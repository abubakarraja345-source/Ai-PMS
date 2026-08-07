import { Router } from 'express';
import { GuestsController } from './controller';

export const GuestsRouter = Router();

GuestsRouter.get('/', GuestsController.getAll);
