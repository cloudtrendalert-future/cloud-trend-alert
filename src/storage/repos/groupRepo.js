export class GroupRepo {
  constructor(store) {
    this.store = store;
  }

  async getAll() {
    return this.store.read();
  }

  async getGroup(groupId) {
    const data = await this.store.read();
    return data[String(groupId)] || null;
  }

  async setAllowed(groupId, allowed, meta = {}) {
    const key = String(groupId);
    const now = new Date().toISOString();
    await this.store.update((data) => {
      const current = data[key] || { groupId: Number(groupId), createdAtUtc: now };
      data[key] = {
        ...current,
        ...meta,
        allowed: Boolean(allowed),
        updatedAtUtc: now
      };
      return data;
    });
    return this.getGroup(groupId);
  }

  async touchSeen(groupId, meta = {}) {
    const key = String(groupId);
    const now = new Date().toISOString();
    await this.store.update((data) => {
      const current = data[key] || {
        groupId: Number(groupId),
        allowed: false,
        createdAtUtc: now
      };
      data[key] = {
        ...current,
        ...meta,
        lastSeenAtUtc: now,
        updatedAtUtc: now
      };
      return data;
    });
  }

  async listAllowedGroupIds() {
    const data = await this.store.read();
    return Object.values(data)
      .filter((group) => group.allowed)
      .map((group) => Number(group.groupId));
  }
}
