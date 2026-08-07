import { GuestsRepository } from './repository';

export class GuestsService {
  static async getAll() {
    return GuestsRepository.findAll();
  }
}
