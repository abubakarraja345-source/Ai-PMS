import { CleaningRepository } from './repository';

export class CleaningService {
  static async getAll() {
    return CleaningRepository.findAll();
  }
}
