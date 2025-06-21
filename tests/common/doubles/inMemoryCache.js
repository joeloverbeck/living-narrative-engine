/**
 * Creates a lightweight in-memory cache double for testing.
 *
 * @returns {import('../../../src/interfaces/loadContracts.js').ILoadCache} A cache object with clear, snapshot, restore, and _data methods.
 */
export function createInMemoryCache() {
  let data = {};
  return {
    clear: () => { data = {}; },
    snapshot: () => JSON.parse(JSON.stringify(data)),
    restore: snap => { data = snap; },
    _data: () => data,
  };
} 