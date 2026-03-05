import { mergeVolumeRows } from './volumeAggregator.js';

export class UniverseProvider {
  constructor({ adapters, logger = console }) {
    this.adapters = adapters;
    this.logger = logger;
  }

  async fetchMergedTop100() {
    const results = await Promise.allSettled(this.adapters.map((adapter) => adapter.fetchTopSymbols(100)));
    const rows = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        rows.push(...result.value);
      } else {
        const adapterId = this.adapters[index]?.id || `adapter_${index}`;
        this.logger.warn?.(`[universe] ${adapterId} fetchTopSymbols failed: ${result.reason?.message || result.reason}`);
      }
    });

    return mergeVolumeRows(rows).slice(0, 100);
  }
}
