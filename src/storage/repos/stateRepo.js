export class StateRepo {
  constructor(store) {
    this.store = store;
  }

  async getAll() {
    return this.store.read();
  }

  async get(key, fallback = null) {
    const data = await this.store.read();
    return key in data ? data[key] : fallback;
  }

  async set(key, value) {
    await this.store.update((data) => {
      data[key] = value;
      return data;
    });
    return value;
  }
}
