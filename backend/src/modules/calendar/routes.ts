import { Router } from 'express';
import { CalendarController } from './controller';

export const CalendarRouter = Router();

CalendarRouter.get('/', CalendarController.getAll);
