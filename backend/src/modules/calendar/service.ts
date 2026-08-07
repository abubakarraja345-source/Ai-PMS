import { CalendarRepository } from './repository';

export class CalendarService {
  static async getAll() {
    return CalendarRepository.findAll();
  }
}
