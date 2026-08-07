import { Request, Response } from 'express';
import { CalendarService } from './service';

export class CalendarController {
  static async getAll(req: Request, res: Response) {
    const items = await CalendarService.getAll();
    res.json(items);
  }
}
