import { ReservationsRepository } from './repository';

export class ReservationsService {
  static async getAll() {
    return ReservationsRepository.findAll();
  }
}
