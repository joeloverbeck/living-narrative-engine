export default class ModsLoadSession {
  /**
   * @param {object} deps
   * @param {Array<import('../interfaces/loadContracts.js').IPhase>} deps.phases
   * @param {import('../interfaces/loadContracts.js').ILoadCache} deps.cache
   * @param {import('../interfaces/coreServices.js').ILogger} deps.logger
   */
  constructor({ phases, cache, logger }) {
    this._phases = phases;
    this._cache = cache;
    this._log = logger;
  }

  /** @param {import('./LoadContext.js').LoadContext} ctx */
  async run(ctx) {
    let current = ctx;
    for (const phase of this._phases) {
      this._log.debug(`Phase ${phase.name} start`);
      current = await phase.execute(current);
      this._log.debug(`Phase ${phase.name} done`);
    }
    return current;
  }
} 