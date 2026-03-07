export class AutoSignalRepo {
  constructor(store) {
    this.store = store;
  }

  async getLastSentAt(signalIdentity) {
    const data = await this.store.read();
    return data.lastSentByIdentity?.[signalIdentity] || null;
  }

  async setLastSentAt(signalIdentity, sentAtUtc) {
    await this.store.update((data) => {
      data.lastSentByIdentity ||= {};
      data.lastSentByIdentity[signalIdentity] = sentAtUtc;
      return data;
    });
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
      const lastSentByIdentity = {};
      const cutoffMs = Date.parse(`${cutoffDayUtc}T00:00:00.000Z`);

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

      Object.entries(data.lastSentByIdentity || {}).forEach(([identity, sentAtUtc]) => {
        const sentAtMs = Date.parse(sentAtUtc);
        if (!Number.isFinite(cutoffMs) || !Number.isFinite(sentAtMs) || sentAtMs >= cutoffMs) {
          lastSentByIdentity[identity] = sentAtUtc;
        }
      });

      return { ...data, dedupe, sendsByDay, lastSentByIdentity };
    });
  }
}
