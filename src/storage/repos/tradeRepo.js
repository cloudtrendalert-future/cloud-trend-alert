import { randomUUID } from 'node:crypto';
import { TRADE_STATUS } from '../../config/constants.js';

export class TradeRepo {
  constructor(store) {
    this.store = store;
  }

  async create(trade) {
    const id = trade.id || randomUUID();
    const payload = {
      ...trade,
      id,
      status: trade.status || TRADE_STATUS.PENDING_ENTRY,
      createdAtUtc: trade.createdAtUtc || new Date().toISOString(),
      updatedAtUtc: new Date().toISOString()
    };

    await this.store.update((data) => {
      data[id] = payload;
      return data;
    });

    return payload;
  }

  async get(id) {
    const data = await this.store.read();
    return data[id] || null;
  }

  async update(id, patch) {
    await this.store.update((data) => {
      if (!data[id]) {
        return data;
      }
      data[id] = {
        ...data[id],
        ...patch,
        updatedAtUtc: new Date().toISOString()
      };
      return data;
    });
    return this.get(id);
  }

  async listAll() {
    const data = await this.store.read();
    return Object.values(data);
  }

  async listOpen() {
    const all = await this.listAll();
    return all.filter((trade) => trade.status === TRADE_STATUS.PENDING_ENTRY || trade.status === TRADE_STATUS.ACTIVE);
  }

  async listClosedByDay(dayUtc) {
    const all = await this.listAll();
    return all.filter((trade) => {
      const day = trade.entryDayUtc || '';
      return day === dayUtc && (trade.status === TRADE_STATUS.CLOSED || trade.status === TRADE_STATUS.EXPIRED_UNFILLED || trade.status === TRADE_STATUS.EXPIRED_ACTIVE);
    });
  }

  async listByEntryDayRange(startDayUtc, endDayUtc) {
    const all = await this.listAll();
    return all.filter((trade) => {
      const day = trade.entryDayUtc || '';
      return day >= startDayUtc && day <= endDayUtc;
    });
  }

  async delete(id) {
    await this.store.update((data) => {
      delete data[id];
      return data;
    });
  }
}
