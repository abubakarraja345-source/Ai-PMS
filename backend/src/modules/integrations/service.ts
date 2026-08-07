import { IntegrationsRepository } from './repository';

export class IntegrationsService {
  static async getAll() {
    return IntegrationsRepository.findAll();
  }
}
