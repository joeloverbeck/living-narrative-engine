/**
 * @file Centralized prototype registry access service
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {import('../types.js').Prototype} Prototype
 * @typedef {import('../types.js').PrototypeRef} PrototypeRef
 */

class PrototypeRegistryService {
  /** @type {object} */
  #dataRegistry;

  /**
   * Create a registry service for prototype lookups.
   *
   * @param {object} deps - Service dependencies.
   * @param {object} deps.dataRegistry - IDataRegistry instance
   * @param {object} deps.logger - ILogger instance
   */
  constructor({ dataRegistry, logger }) {
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get', 'getLookupData'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#dataRegistry = dataRegistry;
  }

  /**
   * Get all prototypes of a specific type.
   *
   * @param {string} type - 'emotion' | 'sexual'
   * @returns {Prototype[]} Prototypes in the registry for the requested type.
   */
  getPrototypesByType(type) {
    const lookupKey =
      type === 'emotion' ? 'core:emotion_prototypes' : 'core:sexual_prototypes';
    const lookup = this.#dataRegistry.getLookupData(lookupKey);

    if (!lookup?.entries) {
      return [];
    }

    return Object.entries(lookup.entries).map(([id, proto]) => ({
      id,
      type,
      weights: proto.weights || {},
      gates: proto.gates || [],
    }));
  }

  /**
   * Get prototypes from multiple types.
   *
   * @param {object} [typesToFetch] - Prototype type flags from detection.
   * @returns {Prototype[]} Combined list of prototypes.
   */
  getAllPrototypes(typesToFetch) {
    const result = [];

    // Default to fetching emotions only (backward compatibility)
    const fetchEmotions = !typesToFetch || typesToFetch.hasEmotions !== false;
    const fetchSexual = typesToFetch?.hasSexualStates === true;

    if (fetchEmotions) {
      result.push(...this.getPrototypesByType('emotion'));
    }

    if (fetchSexual) {
      result.push(...this.getPrototypesByType('sexual'));
    }

    return result;
  }

  /**
   * Resolve prototype references to definitions.
   *
   * @param {PrototypeRef[]} refs - Prototype references to resolve.
   * @returns {Record<string, {weights: Record<string, number>, gates: string[]}>} Definitions keyed by qualified ID.
   */
  getPrototypeDefinitions(refs) {
    const definitions = {};
    if (!Array.isArray(refs)) {
      return definitions;
    }

    for (const ref of refs) {
      const prototypes = this.getPrototypesByType(ref.type);
      const proto = prototypes.find((p) => p.id === ref.id);
      if (proto) {
        const key =
          ref.type === 'emotion' ? `emotions:${ref.id}` : `sexualStates:${ref.id}`;
        definitions[key] = {
          weights: proto.weights ?? {},
          gates: proto.gates ?? [],
        };
      }
    }
    return definitions;
  }

  /**
   * Get single prototype by ID and type.
   *
   * @param {string} id - Prototype id.
   * @param {string} type - Prototype type.
   * @returns {Prototype|null} Prototype if found, otherwise null.
   */
  getPrototype(id, type) {
    return this.getPrototypesByType(type).find((proto) => proto.id === id) ?? null;
  }
}

export default PrototypeRegistryService;
