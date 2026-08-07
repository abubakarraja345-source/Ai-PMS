import { Request, Response } from 'express';
import { AuthService } from './service';

export class AuthController {
  static async getAll(req: Request, res: Response) {
    const items = await AuthService.getAll();
    res.json(items);
  }
}
