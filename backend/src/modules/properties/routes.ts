import { Router } from 'express';
import { PropertyController } from './controller';

export const propertyRouter = Router();

propertyRouter.get('/', PropertyController.getAll);
