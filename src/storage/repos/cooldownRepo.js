export class CooldownRepo {
  constructor(store) {
    this.store = store;
  }

  makeKey(scopeKey, action) {
    return `${scopeKey}:${action}`;
  }

  async touch(scopeKey, action, atMs = Date.now()) {
    const key = this.makeKey(scopeKey, action);
    await this.store.update((data) => {
      data[key] = atMs;
      return data;
    });
    return atMs;
  }

  async getLast(scopeKey, action) {
    const key = this.makeKey(scopeKey, action);
    const data = await this.store.read();
    return data[key] || 0;
  }

  async getRemainingSeconds(scopeKey, action, cooldownSeconds, nowMs = Date.now()) {
    const last = await this.getLast(scopeKey, action);
    if (!last) {
      return 0;
    }
    const expiresAt = last + cooldownSeconds * 1000;
    return Math.max(0, Math.ceil((expiresAt - nowMs) / 1000));
  }
}
