import { makeAutoObservable } from 'mobx';

export class AuthStore {
  isAuthenticated = false;
  user = null;

  constructor() {
    makeAutoObservable(this);
  }

  signIn(user: any) {
    this.isAuthenticated = true;
    this.user = user;
  }

  signOut() {
    this.isAuthenticated = false;
    this.user = null;
  }
}

export const authStore = new AuthStore();
