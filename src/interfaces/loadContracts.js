/**
 * @typedef {object} IPhase
 * @property {string} name A short phase identifier (e.g. "schemas").
 * @property {(ctx: import('../loaders/LoadContext.js').LoadContext) => Promise<import('../loaders/LoadContext.js').LoadContext>} execute
 */

/**
 * @typedef {object} ILoadCache
 * @property {() => void} clear
 * @property {() => any} snapshot
 * @property {(snap: any) => void} restore
 */

/**
 * @typedef {Readonly<{finalModOrder:string[], totals:import('../loaders/LoadResultAggregator.js').TotalResultsSummary, incompatibilities:number}>} LoadReport
 */
