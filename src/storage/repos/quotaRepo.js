export class QuotaRepo {
  constructor(store) {
    this.store = store;
  }

  makeKey(userId, command, dayUtc) {
    return `${userId}:${command}:${dayUtc}`;
  }

  async getUsage(userId, command, dayUtc) {
    const data = await this.store.read();
    return data[this.makeKey(userId, command, dayUtc)] || 0;
  }

  async incrementUsage(userId, command, dayUtc) {
    const key = this.makeKey(userId, command, dayUtc);
    let next = 0;

    await this.store.update((data) => {
      next = (data[key] || 0) + 1;
      data[key] = next;
      return data;
    });

    return next;
  }

  async pruneBefore(cutoffDayUtc) {
    await this.store.update((data) => {
      const next = {};
      Object.entries(data).forEach(([key, count]) => {
        const dayUtc = key.split(':').pop();
        if (dayUtc >= cutoffDayUtc) {
          next[key] = count;
        }
      });
      return next;
    });
  }
}
