import { Request, Response } from 'express';
import { IntegrationsService } from './service';

export class IntegrationsController {
  static async getAll(req: Request, res: Response) {
    const items = await IntegrationsService.getAll();
    res.json(items);
  }
}
