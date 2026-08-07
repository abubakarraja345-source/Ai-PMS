import { AuthRepository } from './repository';

export class AuthService {
  static async getAll() {
    return AuthRepository.findAll();
  }
}
