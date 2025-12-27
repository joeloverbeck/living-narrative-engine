import { BaseService } from '../../utils/serviceBase.js';

/**
 * Provides access to status-effect registry entries loaded via the content pipeline.
 */
class StatusEffectRegistry extends BaseService {
  /** @type {import('../../interfaces/coreServices.js').IDataRegistry} */
  #dataRegistry;
  /** @type {import('../../interfaces/coreServices.js').ILogger} */
  #logger;
  /** @type {{effects: Map<string, any>, applyOrder: string[]}|null} */
  #cache;

  constructor({ dataRegistry, logger }) {
    super();
    this.#logger = this._init('StatusEffectRegistry', logger, {
      dataRegistry: {
        value: dataRegistry,
        requiredMethods: ['getAll'],
      },
    });

    this.#dataRegistry = dataRegistry;
    this.#cache = null;
  }

  #ensureCache() {
    if (this.#cache) {
      return;
    }

    const entries = this.#dataRegistry.getAll('statusEffects');

    if (!entries || entries.length === 0) {
      this.#logger.warn(
        'StatusEffectRegistry: No status-effect registry entries found in data registry.'
      );
      this.#cache = { effects: new Map(), applyOrder: [] };
      return;
    }

    // Aggregate effects from ALL registries, not just the last one.
    // Later entries override earlier ones if they have the same effect ID.
    const effects = new Map();
    const applyOrderSet = new Set();

    for (const registry of entries) {
      if (Array.isArray(registry.effects)) {
        for (const effect of registry.effects) {
          if (effect?.id) {
            effects.set(effect.id, effect);
          }
        }
      }
      // Merge applyOrder arrays, preserving order and avoiding duplicates
      if (Array.isArray(registry.applyOrder)) {
        for (const effectId of registry.applyOrder) {
          applyOrderSet.add(effectId);
        }
      }
    }

    this.#cache = {
      effects,
      applyOrder: Array.from(applyOrderSet),
    };
  }

  /**
   * Returns a status-effect definition by ID.
   * @param {string} effectId
   * @returns {any | undefined}
   */
  get(effectId) {
    this.#ensureCache();
    return this.#cache?.effects.get(effectId);
  }

  /**
   * Returns all status-effect definitions.
   * @returns {any[]}
   */
  getAll() {
    this.#ensureCache();
    return Array.from(this.#cache?.effects.values() ?? []);
  }

  /**
   * Returns the apply order array, if provided.
   * @returns {string[]}
   */
  getApplyOrder() {
    this.#ensureCache();
    return this.#cache?.applyOrder ?? [];
  }

  /**
   * Clears cached entries (useful for tests or reload scenarios).
   */
  clearCache() {
    this.#cache = null;
  }
}

export default StatusEffectRegistry;
