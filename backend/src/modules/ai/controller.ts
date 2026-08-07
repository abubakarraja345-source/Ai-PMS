import { Request, Response } from 'express';
import { AiService } from './service';

export class AiController {
  static async getAll(req: Request, res: Response) {
    const items = await AiService.getAll();
    res.json(items);
  }
}
