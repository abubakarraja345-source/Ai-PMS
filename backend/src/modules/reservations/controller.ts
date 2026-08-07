import { Request, Response } from 'express';
import { ReservationsService } from './service';

export class ReservationsController {
  static async getAll(req: Request, res: Response) {
    const items = await ReservationsService.getAll();
    res.json(items);
  }
}
