import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export class JsonStore {
  constructor(filePath, initialValue = {}) {
    this.filePath = filePath;
    this.initialValue = initialValue;
    this.writeQueue = Promise.resolve();
  }

  async ensureFile() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      const payload = `${JSON.stringify(this.initialValue, null, 2)}\n`;
      await fs.writeFile(this.filePath, payload, 'utf8');
    }
  }

  async read() {
    await this.ensureFile();

    const raw = await fs.readFile(this.filePath, 'utf8');
    if (!raw.trim()) {
      return structuredClone(this.initialValue);
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      throw new Error(`Invalid JSON in ${this.filePath}: ${error.message}`);
    }
  }

  async write(value) {
    await this.ensureFile();

    const tmpFile = `${this.filePath}.${randomUUID()}.tmp`;
    const payload = `${JSON.stringify(value, null, 2)}\n`;
    await fs.writeFile(tmpFile, payload, 'utf8');
    await fs.rename(tmpFile, this.filePath);
  }

  async update(mutator) {
    this.writeQueue = this.writeQueue.catch(() => undefined).then(async () => {
      const current = await this.read();
      const next = await mutator(current);
      await this.write(next);
      return next;
    });

    return this.writeQueue;
  }
}
