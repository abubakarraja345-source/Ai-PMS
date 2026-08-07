import { Router } from 'express';
import { CleaningController } from './controller';

export const CleaningRouter = Router();

CleaningRouter.get('/', CleaningController.getAll);
