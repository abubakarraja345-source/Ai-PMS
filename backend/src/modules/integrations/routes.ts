import { Router } from 'express';
import { IntegrationsController } from './controller';

export const IntegrationsRouter = Router();

IntegrationsRouter.get('/', IntegrationsController.getAll);
