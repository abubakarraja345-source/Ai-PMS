import { PropertyRepository } from './repository';

export class PropertyService {
  static async getAll() {
    return PropertyRepository.findAll();
  }
}
