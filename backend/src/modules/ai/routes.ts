import { Router } from 'express';
import { AiController } from './controller';

export const AiRouter = Router();

AiRouter.get('/', AiController.getAll);
