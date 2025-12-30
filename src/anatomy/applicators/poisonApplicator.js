/**
 * @file PoisonApplicator - Applies poison effects to body parts or entities.
 * Extracted from DamageTypeEffectsService for testability and single responsibility.
 * Supports scope-based targeting: 'part' targets the body part, 'entity' targets the owner.
 * @see damageTypeEffectsService.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../services/eventDispatchStrategy.js').IEventDispatchStrategy} IEventDispatchStrategy */

/**
 * @typedef {object} PoisonConfig
 * @property {number} [tick] - Damage per tick override
 * @property {number} [durationTurns] - Duration in turns override
 * @property {string} [scope] - 'part' or 'entity' scope override
 */

/**
 * @typedef {object} EffectDefinition
 * @property {string} [componentId] - Component ID to add
 * @property {string} [startedEventId] - Event to dispatch
 * @property {object} [defaults] - Default values
 * @property {number} [defaults.tickDamage] - Default tick damage
 * @property {number} [defaults.durationTurns] - Default duration
 * @property {string} [defaults.scope] - Default scope ('part' or 'entity')
 */

/**
 * Default component ID for poisoned entities/parts.
 *
 * @type {string}
 */
const POISONED_COMPONENT_ID = 'anatomy:poisoned';

/**
 * Default event ID for poison start notification.
 *
 * @type {string}
 */
const POISONED_STARTED_EVENT = 'anatomy:poisoned_started';

/**
 * Default tick damage for poison effect.
 *
 * @type {number}
 */
const DEFAULT_TICK_DAMAGE = 1;

/**
 * Default duration in turns for poison effect.
 *
 * @type {number}
 */
const DEFAULT_DURATION_TURNS = 3;

/**
 * Default scope for poison application.
 *
 * @type {string}
 */
const DEFAULT_SCOPE = 'part';

/**
 * Applicator class responsible for applying poison effects to body parts or entities.
 * Poison adds a status component that deals damage over time.
 * Supports scope-based targeting: 'part' targets the body part, 'entity' targets the owner.
 */
class PoisonApplicator {
  /** @type {ILogger} */
  #logger;

  /** @type {EntityManager} */
  #entityManager;

  /**
   * Creates a new PoisonApplicator instance.
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
   * Apply poison effect to a body part or entity.
   * NOTE: The currentHealth <= 0 check is performed by the caller (applyEffectsForDamage).
   *
   * @param {object} params - Application parameters
   * @param {string} params.entityId - Owner entity ID
   * @param {string} params.partId - Target part ID (used when scope is 'part')
   * @param {EffectDefinition} [params.effectDefinition] - Resolved effect definition from registry
   * @param {PoisonConfig} [params.damageEntryConfig] - Config from damageEntry.poison
   * @param {IEventDispatchStrategy} params.dispatchStrategy - Strategy for event dispatch
   * @param {object} [params.sessionContext] - Session context for dispatch strategy
   * @returns {Promise<{applied: boolean, scope: string, targetId: string}>} Application result
   */
  async apply({
    entityId,
    partId,
    effectDefinition,
    damageEntryConfig,
    dispatchStrategy,
    sessionContext,
  }) {
    // Get tick damage from config (tick) or definition defaults (tickDamage)
    const tickDamage =
      damageEntryConfig?.tick ??
      effectDefinition?.defaults?.tickDamage ??
      DEFAULT_TICK_DAMAGE;

    // Get duration from config or definition defaults
    const durationTurns =
      damageEntryConfig?.durationTurns ??
      effectDefinition?.defaults?.durationTurns ??
      DEFAULT_DURATION_TURNS;

    // Get scope from config or definition defaults
    const scope =
      damageEntryConfig?.scope ??
      effectDefinition?.defaults?.scope ??
      DEFAULT_SCOPE;

    // Resolve component and event IDs
    const componentId = effectDefinition?.componentId ?? POISONED_COMPONENT_ID;
    const startedEventId =
      effectDefinition?.startedEventId ?? POISONED_STARTED_EVENT;

    // Determine target based on scope
    const targetId = scope === 'entity' ? entityId : partId;

    // Add poison component to target
    await this.#entityManager.addComponent(targetId, componentId, {
      remainingTurns: durationTurns,
      tickDamage,
    });

    // Build event payload
    // Note: partId is only included when scope is 'part'
    const eventPayload = {
      entityId,
      partId: scope === 'part' ? partId : undefined,
      scope,
      timestamp: Date.now(),
    };

    // Dispatch event via strategy
    dispatchStrategy.dispatch(startedEventId, eventPayload, sessionContext);

    // Record effect in session if applicable
    dispatchStrategy.recordEffect(partId, 'poisoned', sessionContext);

    this.#logger.debug(
      `PoisonApplicator: Poison applied to ${scope === 'entity' ? 'entity' : 'part'} ${targetId}.`
    );

    return { applied: true, scope, targetId };
  }
}

export default PoisonApplicator;
export {
  PoisonApplicator,
  POISONED_COMPONENT_ID,
  POISONED_STARTED_EVENT,
  DEFAULT_TICK_DAMAGE,
  DEFAULT_DURATION_TURNS,
  DEFAULT_SCOPE,
};
