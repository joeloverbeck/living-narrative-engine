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
    const latest = entries[entries.length - 1];

    if (!latest) {
      this.#logger.warn(
        'StatusEffectRegistry: No status-effect registry entries found in data registry.'
      );
      this.#cache = { effects: new Map(), applyOrder: [] };
      return;
    }

    const effects = new Map();
    if (Array.isArray(latest.effects)) {
      for (const effect of latest.effects) {
        if (effect?.id) {
          effects.set(effect.id, effect);
        }
      }
    }

    this.#cache = {
      effects,
      applyOrder: Array.isArray(latest.applyOrder)
        ? [...latest.applyOrder]
        : [],
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
