export class TtlCache {
  constructor({ ttlMs }) {
    this.ttlMs = ttlMs;
    this.map = new Map();
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) {
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value) {
    this.map.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs
    });
    return value;
  }

  clear() {
    this.map.clear();
  }
}
