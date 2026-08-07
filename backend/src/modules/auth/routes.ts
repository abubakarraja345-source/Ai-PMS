import { Router } from 'express';
import { AuthController } from './controller';

export const AuthRouter = Router();

AuthRouter.get('/', AuthController.getAll);
