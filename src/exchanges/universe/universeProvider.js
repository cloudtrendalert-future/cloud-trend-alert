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
      const adapter = this.adapters[index];
      if (result.status === 'fulfilled') {
        if (adapter) {
          adapter.universeReady = true;
        }
        rows.push(...result.value);
      } else {
        if (adapter) {
          adapter.universeReady = false;
        }
        const adapterId = adapter?.id || `adapter_${index}`;
        this.logger.warn?.(`[universe] ${adapterId} fetchTopSymbols failed: ${result.reason?.message || result.reason}`);
      }
    });

    return mergeVolumeRows(rows).slice(0, 100);
  }
}
