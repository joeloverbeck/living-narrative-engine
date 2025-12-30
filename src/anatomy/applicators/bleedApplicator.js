/**
 * @file BleedApplicator - Applies bleeding effects to body parts.
 * Extracted from DamageTypeEffectsService for testability and single responsibility.
 * @see damageTypeEffectsService.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../services/eventDispatchStrategy.js').IEventDispatchStrategy} IEventDispatchStrategy */

/**
 * @typedef {object} BleedConfig
 * @property {string} [severity] - Severity level override ('minor', 'moderate', 'severe')
 * @property {number} [baseDurationTurns] - Duration override
 */

/**
 * @typedef {object} SeverityData
 * @property {number} tickDamage - Damage per tick for this severity
 */

/**
 * @typedef {object} EffectDefinition
 * @property {string} [componentId] - Component ID to add
 * @property {string} [startedEventId] - Event to dispatch
 * @property {object} [defaults] - Default values
 * @property {number} [defaults.baseDurationTurns] - Default duration
 * @property {Object<string, SeverityData>} [defaults.severity] - Severity map
 */

/**
 * Default component ID for bleeding body parts.
 *
 * @type {string}
 */
const BLEEDING_COMPONENT_ID = 'anatomy:bleeding';

/**
 * Default event ID for bleeding start notification.
 *
 * @type {string}
 */
const BLEEDING_STARTED_EVENT = 'anatomy:bleeding_started';

/**
 * Default duration in turns for bleeding effect.
 *
 * @type {number}
 */
const DEFAULT_BASE_DURATION_TURNS = 2;

/**
 * Default severity map for bleeding tick damage.
 *
 * @type {Object<string, SeverityData>}
 */
const BLEED_SEVERITY_MAP = {
  minor: { tickDamage: 1 },
  moderate: { tickDamage: 3 },
  severe: { tickDamage: 5 },
};

/**
 * Applicator class responsible for applying bleeding effects to body parts.
 * Bleeding adds a status component that deals damage over time based on severity.
 */
class BleedApplicator {
  /** @type {ILogger} */
  #logger;

  /** @type {EntityManager} */
  #entityManager;

  /**
   * Creates a new BleedApplicator instance.
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
   * Get tick damage for a given severity level.
   * Falls back to 'minor' severity if the given severity is not found.
   *
   * @param {string} severity - Severity level ('minor', 'moderate', 'severe')
   * @param {Object<string, SeverityData>} severityMap - Map of severity to tick damage data
   * @returns {number} The tick damage value for the severity
   */
  getTickDamageForSeverity(severity, severityMap) {
    // Handle empty or null severity map
    if (!severityMap || Object.keys(severityMap).length === 0) {
      return 0;
    }

    // Try to get the requested severity, fallback to minor
    const severityData = severityMap[severity] ?? severityMap.minor;

    // Handle case where even minor doesn't exist
    if (!severityData) {
      return 0;
    }

    return severityData.tickDamage ?? 0;
  }

  /**
   * Apply bleeding effect to a body part.
   *
   * @param {object} params - Application parameters
   * @param {string} params.entityId - Owner entity ID
   * @param {string} params.partId - Target part ID
   * @param {EffectDefinition} [params.effectDefinition] - Resolved effect definition from registry
   * @param {BleedConfig} [params.damageEntryConfig] - Config from damageEntry.bleed
   * @param {IEventDispatchStrategy} params.dispatchStrategy - Strategy for event dispatch
   * @param {object} [params.sessionContext] - Session context for dispatch strategy
   * @returns {Promise<{applied: boolean}>} Whether bleeding was applied
   */
  async apply({
    entityId,
    partId,
    effectDefinition,
    damageEntryConfig,
    dispatchStrategy,
    sessionContext,
  }) {
    // Get severity from config, default to 'minor'
    const severity = damageEntryConfig?.severity ?? 'minor';

    // Get base duration from config or definition defaults
    const baseDuration =
      damageEntryConfig?.baseDurationTurns ??
      effectDefinition?.defaults?.baseDurationTurns ??
      DEFAULT_BASE_DURATION_TURNS;

    // Get severity map from definition defaults or fallback
    const severityMap =
      effectDefinition?.defaults?.severity ?? BLEED_SEVERITY_MAP;

    // Get tick damage for this severity
    const tickDamage = this.getTickDamageForSeverity(severity, severityMap);

    // Resolve component and event IDs
    const componentId = effectDefinition?.componentId ?? BLEEDING_COMPONENT_ID;
    const startedEventId =
      effectDefinition?.startedEventId ?? BLEEDING_STARTED_EVENT;

    // Add bleeding component to part
    await this.#entityManager.addComponent(partId, componentId, {
      severity,
      remainingTurns: baseDuration,
      tickDamage,
    });

    // Build event payload
    const eventPayload = {
      entityId,
      partId,
      severity,
      timestamp: Date.now(),
    };

    // Dispatch event via strategy
    dispatchStrategy.dispatch(startedEventId, eventPayload, sessionContext);

    // Record effect in session if applicable
    dispatchStrategy.recordEffect(partId, 'bleeding', sessionContext);

    this.#logger.debug(
      `BleedApplicator: Bleeding (${severity}) applied to part ${partId}.`
    );

    return { applied: true };
  }
}

export default BleedApplicator;
export {
  BleedApplicator,
  BLEEDING_COMPONENT_ID,
  BLEEDING_STARTED_EVENT,
  DEFAULT_BASE_DURATION_TURNS,
  BLEED_SEVERITY_MAP,
};
