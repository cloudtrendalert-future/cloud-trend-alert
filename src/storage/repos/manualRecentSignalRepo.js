export class ManualRecentSignalRepo {
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
}

