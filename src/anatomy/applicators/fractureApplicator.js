/**
 * @file FractureApplicator - Applies fracture effects to body parts.
 * Extracted from DamageTypeEffectsService for testability and single responsibility.
 * @see damageTypeEffectsService.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../services/eventDispatchStrategy.js').IEventDispatchStrategy} IEventDispatchStrategy */

/**
 * @typedef {object} FractureConfig
 * @property {boolean} [enabled] - Whether fracture is enabled
 * @property {number} [thresholdFraction] - Threshold fraction of maxHealth (0-1)
 * @property {number} [stunChance] - Probability of stun (0-1)
 * @property {number} [stunDuration] - Duration of stun in turns
 */

/**
 * @typedef {object} EffectDefinition
 * @property {string} [componentId] - Component ID to add for fracture
 * @property {string} [startedEventId] - Event to dispatch
 * @property {object} [defaults] - Default values
 * @property {number} [defaults.thresholdFraction] - Default threshold fraction
 * @property {object} [defaults.stun] - Stun configuration
 * @property {string} [defaults.stun.componentId] - Component ID for stun
 * @property {number} [defaults.stun.chance] - Default stun chance
 * @property {number} [defaults.stun.durationTurns] - Default stun duration
 */

/**
 * Default component ID for fractured body parts.
 *
 * @type {string}
 */
const FRACTURED_COMPONENT_ID = 'anatomy:fractured';

/**
 * Default component ID for stunned entities.
 *
 * @type {string}
 */
const STUNNED_COMPONENT_ID = 'anatomy:stunned';

/**
 * Default event ID for fracture notification.
 *
 * @type {string}
 */
const FRACTURED_EVENT = 'anatomy:fractured';

/**
 * Default threshold fraction for fracture (50% of max health).
 *
 * @type {number}
 */
const DEFAULT_THRESHOLD_FRACTION = 0.5;

/**
 * Default stun duration in turns.
 *
 * @type {number}
 */
const DEFAULT_STUN_DURATION = 1;

/**
 * Applicator class responsible for checking and applying fracture effects.
 * Fracture occurs when damage exceeds a threshold fraction of max health.
 * May also trigger stun as a secondary effect based on RNG.
 */
class FractureApplicator {
  /** @type {ILogger} */
  #logger;

  /** @type {EntityManager} */
  #entityManager;

  /**
   * Creates a new FractureApplicator instance.
   *
   * @param {object} deps - Dependencies
   * @param {ILogger} deps.logger - Logger for debug/info output
   * @param {EntityManager} deps.entityManager - Entity manager for component operations
   * @throws {Error} If required dependencies are missing
   */
  constructor({ logger, entityManager }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['addComponent'],
    });

    this.#logger = logger;
    this.#entityManager = entityManager;
  }

  /**
   * Calculate if damage exceeds the threshold for fracture.
   *
   * @param {number} damageAmount - The amount of damage dealt
   * @param {number} maxHealth - The maximum health of the part
   * @param {number} thresholdFraction - The fraction of maxHealth required (0-1)
   * @returns {boolean} True if damage meets or exceeds the threshold
   */
  meetsThreshold(damageAmount, maxHealth, thresholdFraction) {
    // Edge case: if maxHealth is 0 or negative, no threshold can be met
    if (maxHealth <= 0) {
      return false;
    }

    // Edge case: if threshold is 0, any damage triggers fracture
    if (thresholdFraction <= 0) {
      return damageAmount > 0;
    }

    // Edge case: if threshold is 1 (or greater), damage must be >= full health
    const effectiveThreshold = Math.min(thresholdFraction, 1);
    const threshold = effectiveThreshold * maxHealth;

    return damageAmount >= threshold;
  }

  /**
   * Roll for stun based on chance.
   *
   * @param {number} stunChance - Probability of stun (0-1)
   * @param {function} rng - RNG function returning 0-1
   * @returns {boolean} True if stun should be applied
   */
  rollForStun(stunChance, rng) {
    if (stunChance <= 0) {
      return false;
    }
    if (stunChance >= 1) {
      return true;
    }
    return rng() < stunChance;
  }

  /**
   * Check if fracture should trigger and apply it if so.
   *
   * @param {object} params - Application parameters
   * @param {string} params.entityId - Owner entity ID
   * @param {string} params.partId - Target part ID
   * @param {number} params.damageAmount - Damage dealt
   * @param {string} params.damageTypeId - Damage type ID (e.g., 'bludgeoning')
   * @param {number} params.maxHealth - Part max health
   * @param {number} params.currentHealth - Part health after damage
   * @param {EffectDefinition} [params.effectDefinition] - Resolved effect definition from registry
   * @param {FractureConfig} [params.damageEntryConfig] - Config from damageEntry.fracture
   * @param {IEventDispatchStrategy} params.dispatchStrategy - Strategy for event dispatch
   * @param {object} [params.sessionContext] - Session context for dispatch strategy
   * @param {function} [params.rng] - RNG function for stun roll (defaults to Math.random)
   * @returns {Promise<{triggered: boolean, stunApplied: boolean}>} Result of application
   */
  async apply({
    entityId,
    partId,
    damageAmount,
    damageTypeId,
    maxHealth,
    currentHealth,
    effectDefinition,
    damageEntryConfig,
    dispatchStrategy,
    sessionContext,
    rng,
  }) {
    // Check if fracture is enabled in config
    if (!damageEntryConfig?.enabled) {
      return { triggered: false, stunApplied: false };
    }

    // Calculate threshold fraction from config or definition
    const thresholdFraction =
      damageEntryConfig.thresholdFraction ??
      effectDefinition?.defaults?.thresholdFraction ??
      DEFAULT_THRESHOLD_FRACTION;

    // Check if damage meets threshold
    if (!this.meetsThreshold(damageAmount, maxHealth, thresholdFraction)) {
      return { triggered: false, stunApplied: false };
    }

    // Resolve component and event IDs
    const componentId =
      effectDefinition?.componentId ?? FRACTURED_COMPONENT_ID;
    const stunComponentId =
      effectDefinition?.defaults?.stun?.componentId ?? STUNNED_COMPONENT_ID;
    const startedEventId =
      effectDefinition?.startedEventId ?? FRACTURED_EVENT;

    // Add fractured component to part
    await this.#entityManager.addComponent(partId, componentId, {
      sourceDamageType: damageTypeId,
      appliedAtHealth: currentHealth,
    });

    // Roll for stun
    const stunChance =
      damageEntryConfig.stunChance ??
      effectDefinition?.defaults?.stun?.chance ??
      0;
    const rngProvider = typeof rng === 'function' ? rng : Math.random;
    const stunApplied = this.rollForStun(stunChance, rngProvider);

    // Apply stun if rolled
    if (stunApplied) {
      const stunDuration =
        damageEntryConfig.stunDuration ??
        effectDefinition?.defaults?.stun?.durationTurns ??
        DEFAULT_STUN_DURATION;

      await this.#entityManager.addComponent(entityId, stunComponentId, {
        remainingTurns: stunDuration,
        sourcePartId: partId,
      });
    }

    // Build event payload
    const eventPayload = {
      entityId,
      partId,
      damageTypeId,
      stunApplied,
      timestamp: Date.now(),
    };

    // Dispatch event via strategy
    dispatchStrategy.dispatch(startedEventId, eventPayload, sessionContext);

    // Record effect in session if applicable
    dispatchStrategy.recordEffect(partId, 'fractured', sessionContext);

    this.#logger.debug(
      `FractureApplicator: Part ${partId} fractured by ${damageTypeId}. Stun: ${stunApplied}`
    );

    return { triggered: true, stunApplied };
  }
}

export default FractureApplicator;
export {
  FractureApplicator,
  FRACTURED_COMPONENT_ID,
  STUNNED_COMPONENT_ID,
  FRACTURED_EVENT,
  DEFAULT_THRESHOLD_FRACTION,
  DEFAULT_STUN_DURATION,
};
