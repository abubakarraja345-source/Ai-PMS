import { AiRepository } from './repository';

export class AiService {
  static async getAll() {
    return AiRepository.findAll();
  }
}
