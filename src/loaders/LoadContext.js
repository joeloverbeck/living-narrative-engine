/**
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('./LoadResultAggregator.js').TotalResultsSummary} TotalResultsSummary
 */

/**
 * @param {Object} params
 * @param {string} params.worldName
 * @param {string[]} [params.requestedMods]
 * @param {IDataRegistry} params.registry
 */
export function createLoadContext({ worldName, requestedMods = [], registry }) {
  if (!worldName) throw new Error('worldName is required');
  if (!registry) throw new Error('registry is required');
  /** @type {LoadContext} */
  const ctx = {
    worldName,
    requestedMods,
    finalModOrder: [],
    registry,
    totals: /** @type {TotalResultsSummary} */ ({}),
    incompatibilities: 0,
  };
  return ctx;
}

/**
 * @typedef {Object} LoadContext
 * @property {string} worldName
 * @property {string[]} requestedMods
 * @property {string[]} finalModOrder
 * @property {IDataRegistry} registry
 * @property {TotalResultsSummary} totals
 * @property {number} incompatibilities
 */ 