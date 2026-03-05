export class AutoSignalRepo {
  constructor(store) {
    this.store = store;
  }

  async wasSent(dayUtc, dedupeKey) {
    const data = await this.store.read();
    return Boolean(data.dedupe?.[dayUtc]?.[dedupeKey]);
  }

  async markSent(dayUtc, dedupeKey) {
    await this.store.update((data) => {
      data.dedupe ||= {};
      data.dedupe[dayUtc] ||= {};
      data.dedupe[dayUtc][dedupeKey] = true;
      return data;
    });
  }

  async getDailySendCount(dayUtc) {
    const data = await this.store.read();
    return data.sendsByDay?.[dayUtc] || 0;
  }

  async incrementDailySend(dayUtc) {
    let next = 0;
    await this.store.update((data) => {
      data.sendsByDay ||= {};
      next = (data.sendsByDay[dayUtc] || 0) + 1;
      data.sendsByDay[dayUtc] = next;
      return data;
    });
    return next;
  }

  async pruneBefore(cutoffDayUtc) {
    await this.store.update((data) => {
      const dedupe = {};
      const sendsByDay = {};

      Object.entries(data.dedupe || {}).forEach(([day, value]) => {
        if (day >= cutoffDayUtc) {
          dedupe[day] = value;
        }
      });

      Object.entries(data.sendsByDay || {}).forEach(([day, value]) => {
        if (day >= cutoffDayUtc) {
          sendsByDay[day] = value;
        }
      });

      return { dedupe, sendsByDay };
    });
  }
}
