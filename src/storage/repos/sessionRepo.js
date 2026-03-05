export class SessionRepo {
  constructor(store) {
    this.store = store;
  }

  async get(userId) {
    const data = await this.store.read();
    return data[String(userId)] || null;
  }

  async set(userId, session) {
    await this.store.update((data) => {
      data[String(userId)] = {
        ...session,
        updatedAtUtc: new Date().toISOString()
      };
      return data;
    });
    return this.get(userId);
  }

  async clear(userId) {
    await this.store.update((data) => {
      delete data[String(userId)];
      return data;
    });
  }

  async clearExpired(maxAgeMs) {
    const now = Date.now();
    await this.store.update((data) => {
      Object.entries(data).forEach(([key, value]) => {
        const updatedAt = value?.updatedAtUtc ? new Date(value.updatedAtUtc).getTime() : 0;
        if (!updatedAt || now - updatedAt > maxAgeMs) {
          delete data[key];
        }
      });
      return data;
    });
  }
}
