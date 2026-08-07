import { makeAutoObservable } from 'mobx';

export class UIStore {
  isSidebarOpen = true;

  constructor() {
    makeAutoObservable(this);
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }
}

export const uiStore = new UIStore();
