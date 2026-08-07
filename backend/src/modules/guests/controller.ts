import { Request, Response } from 'express';
import { GuestsService } from './service';

export class GuestsController {
  static async getAll(req: Request, res: Response) {
    const items = await GuestsService.getAll();
    res.json(items);
  }
}
