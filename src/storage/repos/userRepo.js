import { PLAN } from '../../config/constants.js';

export class UserRepo {
  constructor(store) {
    this.store = store;
  }

  async getAll() {
    return this.store.read();
  }

  async getUser(userId) {
    const data = await this.store.read();
    return data[String(userId)] || null;
  }

  async upsertUser(userId, patch = {}) {
    const key = String(userId);
    const now = new Date().toISOString();

    await this.store.update((data) => {
      const existing = data[key] || {
        userId: Number(userId),
        plan: PLAN.FREE,
        followVerified: false,
        createdAtUtc: now
      };

      data[key] = {
        ...existing,
        ...patch,
        updatedAtUtc: now
      };

      return data;
    });

    return this.getUser(userId);
  }

  async setPlan(userId, plan) {
    return this.upsertUser(userId, { plan });
  }

  async setFollowVerified(userId, followVerified) {
    return this.upsertUser(userId, { followVerified: Boolean(followVerified) });
  }

  async listPremiumUsers() {
    const data = await this.store.read();
    return Object.values(data).filter((user) => user.plan === PLAN.PREMIUM);
  }
}
