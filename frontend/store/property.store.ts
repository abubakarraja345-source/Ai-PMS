import { makeAutoObservable } from 'mobx';

export class PropertyStore {
  properties: any[] = [];

  constructor() {
    makeAutoObservable(this);
  }

  setProperties(properties: any[]) {
    this.properties = properties;
  }
}

export const propertyStore = new PropertyStore();
