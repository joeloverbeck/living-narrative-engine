import { deepClone } from '../utils/cloneUtils.js';

/**
 * Creates a cache adapter that wraps an IDataRegistry to provide clear, snapshot, and restore methods.
 *
 * @param {import('../data/inMemoryDataRegistry.js').default} registry - The registry to wrap
 * @returns {import('../interfaces/loadContracts.js').ILoadCache} A cache object with clear, snapshot, and restore methods
 */
export function makeRegistryCache(registry) {
  return {
    clear: () => registry.clear(),
    snapshot: () => {
      const snapshot = {};
      for (const [type, typeMap] of registry.data.entries()) {
        snapshot[type] = {};
        for (const [id, data] of typeMap.entries()) {
          snapshot[type][id] = deepClone(data);
        }
      }
      return snapshot;
    },
    restore: snap => {
      registry.clear();
      for (const [type, typeData] of Object.entries(snap)) {
        for (const [id, data] of Object.entries(typeData)) {
          registry.store(type, id, deepClone(data));
        }
      }
    },
  };
} 