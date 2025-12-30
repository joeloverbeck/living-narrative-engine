import {
  FALLBACK_APPLY_ORDER,
  FALLBACK_EFFECT_DEFINITIONS,
} from '../constants/fallbackEffectDefinitions.js';

class EffectDefinitionResolver {
  #statusEffectRegistry;
  #fallbackDefinitions;
  #fallbackApplyOrder;
  #warningTracker;

  constructor({
    statusEffectRegistry = null,
    fallbackDefinitions = FALLBACK_EFFECT_DEFINITIONS,
    fallbackApplyOrder = FALLBACK_APPLY_ORDER,
    warningTracker,
  }) {
    if (!warningTracker || typeof warningTracker.warnOnce !== 'function') {
      throw new Error(
        'EffectDefinitionResolver: warningTracker with warnOnce is required.'
      );
    }

    this.#statusEffectRegistry = statusEffectRegistry;
    this.#fallbackDefinitions = fallbackDefinitions;
    this.#fallbackApplyOrder = fallbackApplyOrder;
    this.#warningTracker = warningTracker;
  }

  resolveEffectDefinition(effectType) {
    const fallback = this.#fallbackDefinitions[effectType];
    const registryDef = this.#statusEffectRegistry
      ?.getAll?.()
      ?.find((effect) => effect?.effectType === effectType);

    if (!registryDef) {
      this.#warningTracker.warnOnce(
        'missingDefinition',
        effectType,
        `EffectDefinitionResolver: Missing status-effect registry entry for ${effectType}, using fallback defaults.`
      );
      return fallback;
    }

    const mergedDefaults = this.mergeDefaults(
      fallback?.defaults ?? {},
      registryDef.defaults ?? {}
    );

    const componentId = registryDef.componentId ?? fallback?.componentId;

    return {
      ...fallback,
      ...registryDef,
      id: registryDef.id ?? fallback?.id ?? effectType,
      componentId: componentId ?? fallback?.componentId,
      startedEventId: registryDef.startedEventId ?? fallback?.startedEventId,
      stoppedEventId: registryDef.stoppedEventId ?? fallback?.stoppedEventId,
      defaults: mergedDefaults,
    };
  }

  resolveApplyOrder() {
    const effectDefinitions = {};

    for (const effectType of Object.keys(this.#fallbackDefinitions)) {
      const fallback = this.#fallbackDefinitions[effectType];
      const registryDef = this.#statusEffectRegistry
        ?.getAll?.()
        ?.find((effect) => effect?.effectType === effectType);

      effectDefinitions[effectType] = {
        id: registryDef?.id ?? fallback?.id ?? effectType,
      };
    }

    const registryOrder = this.#statusEffectRegistry?.getApplyOrder?.() ?? [];
    const knownIds = new Set();
    const fallbackIds = [];

    for (const def of Object.values(effectDefinitions)) {
      if (def?.id) {
        knownIds.add(def.id);
      }
    }

    for (const fallbackId of this.#fallbackApplyOrder) {
      const matching = Object.values(effectDefinitions).find(
        (def) => def?.id === fallbackId
      );
      fallbackIds.push(matching?.id ?? fallbackId);
    }

    const mappedRegistryOrder = [];
    if (registryOrder.length === 0) {
      return fallbackIds;
    }

    for (const id of registryOrder) {
      if (knownIds.has(id)) {
        mappedRegistryOrder.push(id);
      } else {
        const existsInRegistry = this.#statusEffectRegistry?.get?.(id) !== undefined;
        if (!existsInRegistry) {
          this.#warningTracker.warnOnce(
            'missingOrder',
            id,
            `EffectDefinitionResolver: Unknown status-effect id in registry applyOrder: ${id}`
          );
        }
      }
    }

    for (const fallbackId of fallbackIds) {
      if (!mappedRegistryOrder.includes(fallbackId) && knownIds.has(fallbackId)) {
        mappedRegistryOrder.push(fallbackId);
      }
    }

    return mappedRegistryOrder;
  }

  mergeDefaults(fallbackDefaults = {}, registryDefaults = {}) {
    const merged = { ...fallbackDefaults };

    for (const [key, value] of Object.entries(registryDefaults)) {
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        typeof fallbackDefaults[key] === 'object' &&
        fallbackDefaults[key] !== null &&
        !Array.isArray(fallbackDefaults[key])
      ) {
        merged[key] = this.mergeDefaults(fallbackDefaults[key], value);
      } else {
        merged[key] = value;
      }
    }

    return merged;
  }
}

export default EffectDefinitionResolver;
