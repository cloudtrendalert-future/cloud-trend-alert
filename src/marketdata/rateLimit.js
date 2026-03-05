export class AsyncLimiter {
  constructor(maxConcurrent = 2) {
    this.maxConcurrent = maxConcurrent;
    this.active = 0;
    this.queue = [];
  }

  async run(task) {
    if (this.active >= this.maxConcurrent) {
      await new Promise((resolve) => this.queue.push(resolve));
    }

    this.active += 1;

    try {
      return await task();
    } finally {
      this.active -= 1;
      const next = this.queue.shift();
      if (next) {
        next();
      }
    }
  }
}
