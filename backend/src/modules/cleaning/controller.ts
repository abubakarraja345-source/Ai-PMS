import { Request, Response } from 'express';
import { CleaningService } from './service';

export class CleaningController {
  static async getAll(req: Request, res: Response) {
    const items = await CleaningService.getAll();
    res.json(items);
  }
}
