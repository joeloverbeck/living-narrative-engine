/**
 * @file DamageTypeEffectsService - Applies immediate damage type effects
 *
 * Handles the application of special effects (bleed, fracture, burn, poison,
 * dismemberment) based on damage type definitions when damage is applied.
 *
 * Processing order (per spec):
 * 1. Dismemberment check - if triggered, skip all other effects
 * 2. Fracture check - may trigger stun
 * 3. Bleed attach
 * 4. Burn attach
 * 5. Poison attach
 *
 * @see specs/damage-types-and-special-effects.md
 */

import { BaseService } from '../../utils/serviceBase.js';
import { classifyDamageSeverity } from '../constants/damageSeverity.js';
import { createDispatchStrategy } from './eventDispatchStrategy.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */

// Component IDs - exported for use by tick systems
export const BLEEDING_COMPONENT_ID = 'anatomy:bleeding';
export const BURNING_COMPONENT_ID = 'anatomy:burning';
export const POISONED_COMPONENT_ID = 'anatomy:poisoned';
export const DISMEMBERED_COMPONENT_ID = 'anatomy:dismembered';

// Event types - stopped events (exported for use by tick systems)
export const BLEEDING_STOPPED_EVENT = 'anatomy:bleeding_stopped';
export const BURNING_STOPPED_EVENT = 'anatomy:burning_stopped';
export const POISONED_STOPPED_EVENT = 'anatomy:poisoned_stopped';

/**
 * Service responsible for applying immediate damage type effects.
 * Called synchronously from ApplyDamageHandler after damage is applied.
 */
class DamageTypeEffectsService extends BaseService {
  /** @type {ILogger} */ #logger;
  /** @type {EntityManager} */ #entityManager;
  /** @type {ISafeEventDispatcher} */ #dispatcher;
  /** @type {() => number} */ #rngProvider;
  /** @type {import('./effectDefinitionResolver.js').default} */ #effectDefinitionResolver;
  /** @type {import('../applicators/dismembermentApplicator.js').default} */ #dismembermentApplicator;
  /** @type {import('../applicators/fractureApplicator.js').default} */ #fractureApplicator;
  /** @type {import('../applicators/bleedApplicator.js').default} */ #bleedApplicator;
  /** @type {import('../applicators/burnApplicator.js').default} */ #burnApplicator;
  /** @type {import('../applicators/poisonApplicator.js').default} */ #poisonApplicator;

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger
   * @param {EntityManager} deps.entityManager
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher
   * @param {() => number} [deps.rngProvider] - Injectable RNG for deterministic testing
   * @param {import('./effectDefinitionResolver.js').default} deps.effectDefinitionResolver
   * @param {import('../applicators/dismembermentApplicator.js').default} deps.dismembermentApplicator
   * @param {import('../applicators/fractureApplicator.js').default} deps.fractureApplicator
   * @param {import('../applicators/bleedApplicator.js').default} deps.bleedApplicator
   * @param {import('../applicators/burnApplicator.js').default} deps.burnApplicator
   * @param {import('../applicators/poisonApplicator.js').default} deps.poisonApplicator
   */
  constructor({
    logger,
    entityManager,
    safeEventDispatcher,
    rngProvider,
    effectDefinitionResolver,
    dismembermentApplicator,
    fractureApplicator,
    bleedApplicator,
    burnApplicator,
    poisonApplicator,
  }) {
    super();

    this.#logger = this._init('DamageTypeEffectsService', logger, {
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData', 'addComponent', 'hasComponent'],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
      effectDefinitionResolver: {
        value: effectDefinitionResolver,
        requiredMethods: ['resolveEffectDefinition', 'resolveApplyOrder'],
      },
      dismembermentApplicator: {
        value: dismembermentApplicator,
        requiredMethods: ['apply'],
      },
      fractureApplicator: {
        value: fractureApplicator,
        requiredMethods: ['apply'],
      },
      bleedApplicator: {
        value: bleedApplicator,
        requiredMethods: ['apply'],
      },
      burnApplicator: {
        value: burnApplicator,
        requiredMethods: ['apply'],
      },
      poisonApplicator: {
        value: poisonApplicator,
        requiredMethods: ['apply'],
      },
    });

    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
    this.#rngProvider =
      typeof rngProvider === 'function' ? rngProvider : Math.random;
    this.#effectDefinitionResolver = effectDefinitionResolver;
    this.#dismembermentApplicator = dismembermentApplicator;
    this.#fractureApplicator = fractureApplicator;
    this.#bleedApplicator = bleedApplicator;
    this.#burnApplicator = burnApplicator;
    this.#poisonApplicator = poisonApplicator;
  }

  /**
   * Applies immediate effects for a damage event based on damage entry object.
   *
   * @param {object} params
   * @param {string} params.entityId - Owner entity ID
   * @param {string} [params.entityName] - Name of the entity (for events)
   * @param {string} [params.entityPronoun] - Pronoun (for events)
   * @param {string} params.partId - Target part entity ID
   * @param {string} [params.partType] - Type of part (for events)
   * @param {string} [params.orientation] - Orientation (for events)
   * @param {object} params.damageEntry - Complete damage entry object from weapon
   * @param {string} params.damageEntry.name - Damage type name
   * @param {number} params.damageEntry.amount - Damage amount
   * @param {number} [params.damageEntry.penetration] - Penetration value (0-1)
   * @param {object} [params.damageEntry.bleed] - Bleed effect configuration
   * @param {object} [params.damageEntry.fracture] - Fracture effect configuration
   * @param {object} [params.damageEntry.burn] - Burn effect configuration
   * @param {object} [params.damageEntry.poison] - Poison effect configuration
   * @param {object} [params.damageEntry.dismember] - Dismember effect configuration
   * @param {number} params.maxHealth - Part's max health
   * @param {number} params.currentHealth - Part's health AFTER damage was applied
   * @param {object} [params.damageSession] - Optional damage accumulation session
   * @param {object} [params.executionContext] - Execution context for tracing
   * @param {() => number} [params.rng] - Optional RNG override for deterministic runs
   * @returns {Promise<void>}
   */
  async applyEffectsForDamage({
    entityId,
    entityName,
    entityPronoun,
    partId,
    partType,
    orientation,
    damageEntry,
    maxHealth,
    currentHealth,
    damageSession,
    executionContext,
    rng,
  }) {
    const addTrace = (phase, message, data = {}) => {
      if (executionContext?.trace) {
        executionContext.trace.push({
          timestamp: Date.now(),
          phase,
          message,
          data,
          context: { entityId, partId, service: 'DamageTypeEffectsService' },
        });
      }
    };

    // Validate damageEntry is provided
    if (!damageEntry) {
      this.#logger.warn(
        'DamageTypeEffectsService: No damage entry provided, skipping effects.',
        {
          entityId,
          partId,
        }
      );
      addTrace('warn', 'No damage entry provided');
      return;
    }

    const amount = damageEntry.amount ?? 0;
    const partDestroyed = currentHealth <= 0;
    const rngToUse = typeof rng === 'function' ? rng : this.#rngProvider;
    const severity =
      damageEntry.severity ??
      classifyDamageSeverity(amount, maxHealth);

    // Extract flag to suppress body part spawning (e.g., in damage simulator)
    const suppressBodyPartSpawning = executionContext?.suppressPerceptibleEvents ?? false;

    const effectDefinitions = {
      dismember: this.#effectDefinitionResolver.resolveEffectDefinition('dismember'),
      fracture: this.#effectDefinitionResolver.resolveEffectDefinition('fracture'),
      bleed: this.#effectDefinitionResolver.resolveEffectDefinition('bleed'),
      burn: this.#effectDefinitionResolver.resolveEffectDefinition('burn'),
      poison: this.#effectDefinitionResolver.resolveEffectDefinition('poison'),
    };

    const effectTypeById = new Map();
    for (const def of Object.values(effectDefinitions)) {
      if (def?.id) {
        effectTypeById.set(def.id, def.effectType);
      }
    }

    const applyOrder = this.#effectDefinitionResolver.resolveApplyOrder();
    const dispatchStrategy = createDispatchStrategy(this.#dispatcher, damageSession);
    const skipWhenDestroyed = new Set(
      ['bleed', 'burn', 'poison'].map(
        (effectType) => effectDefinitions[effectType]?.effectType
      )
    );

    const effectHandlers = {};

    if (effectDefinitions.dismember?.id) {
      effectHandlers[effectDefinitions.dismember.id] = async () => {
        const result = await this.#dismembermentApplicator.apply({
          entityId,
          entityName,
          entityPronoun,
          partId,
          partType,
          orientation,
          damageAmount: amount,
          damageTypeId: damageEntry.name,
          maxHealth,
          currentHealth,
          effectDefinition: effectDefinitions.dismember,
          damageEntryConfig: damageEntry.dismember,
          dispatchStrategy,
          sessionContext: damageSession,
          suppressBodyPartSpawning,
        });
        if (result.triggered) {
          addTrace('effect_dismember', 'Dismemberment applied');
        }
      };
    }

    if (effectDefinitions.fracture?.id) {
      effectHandlers[effectDefinitions.fracture.id] = async () => {
        const result = await this.#fractureApplicator.apply({
          entityId,
          partId,
          damageAmount: amount,
          damageTypeId: damageEntry.name,
          maxHealth,
          currentHealth,
          effectDefinition: effectDefinitions.fracture,
          damageEntryConfig: damageEntry.fracture,
          dispatchStrategy,
          sessionContext: damageSession,
          rng: rngToUse,
        });
        if (result.triggered) {
          addTrace('effect_fracture', 'Fracture applied', { stunApplied: result.stunApplied });
        }
      };
    }

    if (effectDefinitions.bleed?.id) {
      effectHandlers[effectDefinitions.bleed.id] = async () => {
        if (damageEntry.bleed?.enabled) {
          await this.#bleedApplicator.apply({
            entityId,
            partId,
            effectDefinition: effectDefinitions.bleed,
            damageEntryConfig: damageEntry.bleed,
            dispatchStrategy,
            sessionContext: damageSession,
          });
          addTrace('effect_bleed', 'Bleed effect applied');
        }
      };
    }

    if (effectDefinitions.burn?.id) {
      effectHandlers[effectDefinitions.burn.id] = async () => {
        if (damageEntry.burn?.enabled) {
          const result = await this.#burnApplicator.apply({
            entityId,
            partId,
            effectDefinition: effectDefinitions.burn,
            damageEntryConfig: damageEntry.burn,
            dispatchStrategy,
            sessionContext: damageSession,
          });
          addTrace('effect_burn', 'Burn effect applied', { stacked: result.stacked, stackedCount: result.stackedCount });
        }
      };
    }

    if (effectDefinitions.poison?.id) {
      effectHandlers[effectDefinitions.poison.id] = async () => {
        if (damageEntry.poison?.enabled) {
          const result = await this.#poisonApplicator.apply({
            entityId,
            partId,
            effectDefinition: effectDefinitions.poison,
            damageEntryConfig: damageEntry.poison,
            dispatchStrategy,
            sessionContext: damageSession,
          });
          addTrace('effect_poison', 'Poison effect applied', { scope: result.scope, targetId: result.targetId });
        }
      };
    }

    let destroyedLogged = false;

    for (const effectId of applyOrder) {
      const effectType = effectTypeById.get(effectId);
      if (partDestroyed && skipWhenDestroyed.has(effectType)) {
        if (!destroyedLogged) {
          addTrace(
            'info',
            'Part destroyed, skipping ongoing effects (bleed/burn/poison)'
          );
          destroyedLogged = true;
        }
        continue;
      }

      const handler = effectHandlers[effectId];
      if (handler) {
        await handler();
      }
    }

    return { severity };
  }
}

export default DamageTypeEffectsService;
