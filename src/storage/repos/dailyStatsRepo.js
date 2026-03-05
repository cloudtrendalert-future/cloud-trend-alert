export class DailyStatsRepo {
  constructor(store) {
    this.store = store;
  }

  async getDay(dayUtc) {
    const data = await this.store.read();
    return data[dayUtc] || null;
  }

  async upsertDay(dayUtc, patch) {
    const base = {
      dayUtc,
      tp1Count: 0,
      tp2Count: 0,
      tp3Count: 0,
      slCount: 0,
      expiredCount: 0,
      entriesCount: 0,
      longCount: 0,
      shortCount: 0,
      updatedAtUtc: new Date().toISOString()
    };

    let row = null;
    await this.store.update((data) => {
      row = {
        ...(data[dayUtc] || base),
        ...patch,
        dayUtc,
        updatedAtUtc: new Date().toISOString()
      };
      data[dayUtc] = row;
      return data;
    });

    return row;
  }

  async increment(dayUtc, counters) {
    return this.upsertDay(dayUtc, counters);
  }

  async listRange(startDayUtc, endDayUtc) {
    const data = await this.store.read();
    return Object.values(data).filter((row) => row.dayUtc >= startDayUtc && row.dayUtc <= endDayUtc);
  }

  async pruneBefore(cutoffDayUtc) {
    await this.store.update((data) => {
      const next = {};
      Object.entries(data).forEach(([day, row]) => {
        if (day >= cutoffDayUtc) {
          next[day] = row;
        }
      });
      return next;
    });
  }
}
