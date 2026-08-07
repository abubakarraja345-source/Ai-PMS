import { Request, Response } from 'express';
import { PropertyService } from './service';

export class PropertyController {
  static async getAll(req: Request, res: Response) {
    const properties = await PropertyService.getAll();
    res.json(properties);
  }
}
