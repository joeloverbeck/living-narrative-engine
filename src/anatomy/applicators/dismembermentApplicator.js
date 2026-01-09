/**
 * @file DismembermentApplicator - Applies dismemberment effects to body parts.
 * Extracted from DamageTypeEffectsService for testability and single responsibility.
 * @see damageTypeEffectsService.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../services/eventDispatchStrategy.js').IEventDispatchStrategy} IEventDispatchStrategy */

/**
 * @typedef {object} DismemberConfig
 * @property {boolean} [enabled] - Whether dismemberment is enabled
 * @property {number} [thresholdFraction] - Threshold fraction of maxHealth
 */

/**
 * @typedef {object} EffectDefinition
 * @property {string} [componentId] - Component ID to add
 * @property {string} [startedEventId] - Event to dispatch
 * @property {object} [defaults] - Default values
 * @property {number} [defaults.thresholdFraction] - Default threshold fraction
 */

/**
 * Default component ID for dismembered body parts.
 *
 * @type {string}
 */
const DISMEMBERED_COMPONENT_ID = 'anatomy:dismembered';

/**
 * Default event ID for dismemberment notification.
 *
 * @type {string}
 */
const DISMEMBERED_EVENT = 'anatomy:dismembered';

/**
 * Default threshold fraction for dismemberment (80% of max health).
 *
 * @type {number}
 */
const DEFAULT_THRESHOLD_FRACTION = 0.8;

/**
 * Applicator class responsible for checking and applying dismemberment effects.
 * Dismemberment occurs when damage exceeds a threshold fraction of max health
 * and the target part is not embedded.
 */
class DismembermentApplicator {
  /** @type {ILogger} */
  #logger;

  /** @type {EntityManager} */
  #entityManager;

  /**
   * Creates a new DismembermentApplicator instance.
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
      requiredMethods: ['hasComponent', 'addComponent'],
    });

    this.#logger = logger;
    this.#entityManager = entityManager;
  }

  /**
   * Check if a part is embedded (non-dismemberable).
   * Embedded parts are typically eyes, internal organs, etc.
   *
   * @param {string} partId - The part entity ID to check
   * @returns {boolean} True if the part has the anatomy:embedded component
   */
  isEmbedded(partId) {
    try {
      return this.#entityManager.hasComponent(partId, 'anatomy:embedded');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.#logger.warn(
        `DismembermentApplicator: Error checking embedded status for ${partId}: ${message}`
      );
      return false;
    }
  }

  /**
   * Calculate if damage exceeds the threshold for dismemberment.
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

    // Edge case: if threshold is 0, any damage triggers dismemberment
    if (thresholdFraction <= 0) {
      return damageAmount > 0;
    }

    // Edge case: if threshold is 1 (or greater), damage must be >= full health
    const effectiveThreshold = Math.min(thresholdFraction, 1);
    const threshold = effectiveThreshold * maxHealth;

    return damageAmount >= threshold;
  }

  /**
   * Check if dismemberment should trigger and apply it if so.
   *
   * @param {object} params - Application parameters
   * @param {string} params.entityId - Owner entity ID
   * @param {string} [params.entityName] - Entity name for event payload
   * @param {string} [params.entityPronoun] - Entity pronoun for event payload
   * @param {string} params.partId - Target part ID
   * @param {string} [params.partType] - Part type for event payload
   * @param {string} [params.orientation] - Part orientation for event payload
   * @param {number} params.damageAmount - Damage dealt
   * @param {string} params.damageTypeId - Damage type ID (e.g., 'slashing')
   * @param {number} params.maxHealth - Part max health
   * @param {number} [params.currentHealth] - Part health after damage (informational)
   * @param {EffectDefinition} [params.effectDefinition] - Resolved effect definition from registry
   * @param {DismemberConfig} [params.damageEntryConfig] - Config from damageEntry.dismember
   * @param {IEventDispatchStrategy} params.dispatchStrategy - Strategy for event dispatch
   * @param {object} [params.sessionContext] - Session context for dispatch strategy
   * @param {boolean} [params.suppressBodyPartSpawning] - If true, suppresses body part spawning (e.g., in damage simulator)
   * @returns {Promise<{triggered: boolean}>} Whether dismemberment was triggered
   */
  async apply({
    entityId,
    entityName,
    entityPronoun,
    partId,
    partType,
    orientation,
    damageAmount,
    damageTypeId,
    maxHealth,
    // eslint-disable-next-line no-unused-vars
    currentHealth,
    effectDefinition,
    damageEntryConfig,
    dispatchStrategy,
    sessionContext,
    suppressBodyPartSpawning = false,
  }) {
    // Check if dismemberment is enabled in config
    if (!damageEntryConfig?.enabled) {
      return { triggered: false };
    }

    // Check if part is embedded (non-dismemberable)
    if (this.isEmbedded(partId)) {
      this.#logger.debug(
        `DismembermentApplicator: Part ${partId} is embedded, skipping dismemberment.`
      );
      return { triggered: false };
    }

    // Calculate threshold fraction from config or definition
    const thresholdFraction =
      damageEntryConfig.thresholdFraction ??
      effectDefinition?.defaults?.thresholdFraction ??
      DEFAULT_THRESHOLD_FRACTION;

    // Check if damage meets threshold
    if (!this.meetsThreshold(damageAmount, maxHealth, thresholdFraction)) {
      return { triggered: false };
    }

    // Resolve component and event IDs
    const componentId =
      effectDefinition?.componentId ?? DISMEMBERED_COMPONENT_ID;
    const startedEventId =
      effectDefinition?.startedEventId ?? DISMEMBERED_EVENT;

    // Add dismembered component to part
    await this.#entityManager.addComponent(partId, componentId, {
      sourceDamageType: damageTypeId,
    });

    // Build event payload
    const eventPayload = {
      entityId,
      entityName,
      entityPronoun,
      partId,
      partType,
      orientation,
      damageTypeId,
      suppressBodyPartSpawning,
      timestamp: Date.now(),
    };

    // Dispatch event via strategy
    dispatchStrategy.dispatch(startedEventId, eventPayload, sessionContext);

    // Record effect in session if applicable
    dispatchStrategy.recordEffect(partId, 'dismembered', sessionContext);

    this.#logger.info(
      `DismembermentApplicator: Part ${partId} dismembered by ${damageTypeId} damage.`
    );

    return { triggered: true };
  }
}

export default DismembermentApplicator;
export {
  DismembermentApplicator,
  DISMEMBERED_COMPONENT_ID,
  DISMEMBERED_EVENT,
  DEFAULT_THRESHOLD_FRACTION,
};
