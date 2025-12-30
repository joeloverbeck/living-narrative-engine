/**
 * @file BurnApplicator - Applies burning effects to body parts.
 * Extracted from DamageTypeEffectsService for testability and single responsibility.
 * Handles stacking logic (accumulate damage vs refresh duration).
 * @see damageTypeEffectsService.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../services/eventDispatchStrategy.js').IEventDispatchStrategy} IEventDispatchStrategy */

/**
 * @typedef {object} BurnConfig
 * @property {number} [dps] - Damage per tick (damage per second)
 * @property {number} [durationTurns] - Duration in turns
 * @property {boolean} [canStack] - Whether burn can stack
 */

/**
 * @typedef {object} StackingConfig
 * @property {boolean} [canStack] - Whether burn can stack
 * @property {number} [defaultStacks] - Base stack count
 */

/**
 * @typedef {object} EffectDefinition
 * @property {string} [componentId] - Component ID to add
 * @property {string} [startedEventId] - Event to dispatch
 * @property {object} [defaults] - Default values
 * @property {number} [defaults.tickDamage] - Default tick damage
 * @property {number} [defaults.durationTurns] - Default duration
 * @property {StackingConfig} [defaults.stacking] - Stacking configuration
 */

/**
 * @typedef {object} ExistingBurnData
 * @property {number} remainingTurns - Turns remaining
 * @property {number} tickDamage - Current tick damage
 * @property {number} [stackedCount] - Current stack count
 */

/**
 * Default component ID for burning body parts.
 *
 * @type {string}
 */
const BURNING_COMPONENT_ID = 'anatomy:burning';

/**
 * Default event ID for burning start notification.
 *
 * @type {string}
 */
const BURNING_STARTED_EVENT = 'anatomy:burning_started';

/**
 * Default burn tick damage per turn.
 *
 * @type {number}
 */
const DEFAULT_TICK_DAMAGE = 1;

/**
 * Default duration in turns for burning effect.
 *
 * @type {number}
 */
const DEFAULT_DURATION_TURNS = 2;

/**
 * Default stack count for new burns.
 *
 * @type {number}
 */
const DEFAULT_BURN_STACK_COUNT = 1;

/**
 * Applicator class responsible for applying burning effects to body parts.
 * Burning adds a status component that deals damage over time with optional stacking.
 */
class BurnApplicator {
  /** @type {ILogger} */
  #logger;

  /** @type {EntityManager} */
  #entityManager;

  /**
   * Creates a new BurnApplicator instance.
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
      requiredMethods: ['addComponent', 'hasComponent', 'getComponentData'],
    });

    this.#logger = logger;
    this.#entityManager = entityManager;
  }

  /**
   * Handle stacking logic for existing burn.
   * NOTE: The actual code does NOT enforce maxStackCount - stacking increments without limit.
   *
   * @param {ExistingBurnData} existingBurn - Current burn component data
   * @param {boolean} canStack - Whether stacking is enabled
   * @param {number} baseDamage - Base tick damage (dps)
   * @param {number} duration - Duration in turns
   * @param {number} baseStackCount - Default stack count
   * @returns {{tickDamage: number, stackedCount: number, remainingTurns: number}} Updated burn data
   */
  applyStacking(existingBurn, canStack, baseDamage, duration, baseStackCount) {
    const existingStackedCount = existingBurn.stackedCount ?? baseStackCount;

    if (canStack) {
      // Stack: increase damage and stack count (no maxStackCount check)
      return {
        tickDamage: existingBurn.tickDamage + baseDamage,
        stackedCount: existingStackedCount + 1,
        remainingTurns: duration,
      };
    }

    // No stack: refresh duration only, keep existing values
    return {
      tickDamage: existingBurn.tickDamage,
      stackedCount: existingStackedCount,
      remainingTurns: duration,
    };
  }

  /**
   * Apply burn effect to a body part.
   * NOTE: The currentHealth <= 0 check is performed by the caller (applyEffectsForDamage).
   *
   * @param {object} params - Application parameters
   * @param {string} params.entityId - Owner entity ID
   * @param {string} params.partId - Target part ID
   * @param {EffectDefinition} [params.effectDefinition] - Resolved effect definition from registry
   * @param {BurnConfig} [params.damageEntryConfig] - Config from damageEntry.burn
   * @param {IEventDispatchStrategy} params.dispatchStrategy - Strategy for event dispatch
   * @param {object} [params.sessionContext] - Session context for dispatch strategy
   * @returns {Promise<{applied: boolean, stacked: boolean, stackedCount: number}>} Application result
   */
  async apply({
    entityId,
    partId,
    effectDefinition,
    damageEntryConfig,
    dispatchStrategy,
    sessionContext,
  }) {
    // Get base tick damage (dps) from config or definition defaults
    const dps =
      damageEntryConfig?.dps ??
      effectDefinition?.defaults?.tickDamage ??
      DEFAULT_TICK_DAMAGE;

    // Get duration from config or definition defaults
    const durationTurns =
      damageEntryConfig?.durationTurns ??
      effectDefinition?.defaults?.durationTurns ??
      DEFAULT_DURATION_TURNS;

    // Get stacking configuration
    const stackingDefaults = effectDefinition?.defaults?.stacking ?? {};
    const baseStackCount =
      stackingDefaults.defaultStacks ?? DEFAULT_BURN_STACK_COUNT;
    const canStack =
      damageEntryConfig?.canStack ?? stackingDefaults.canStack ?? false;

    // Resolve component and event IDs
    const componentId = effectDefinition?.componentId ?? BURNING_COMPONENT_ID;
    const startedEventId =
      effectDefinition?.startedEventId ?? BURNING_STARTED_EVENT;

    // Check for existing burn component
    const hasExisting = this.#entityManager.hasComponent(partId, componentId);
    const existingBurn = hasExisting
      ? this.#entityManager.getComponentData(partId, componentId)
      : null;

    let newTickDamage = dps;
    let newStackedCount = baseStackCount;
    let stacked = false;

    if (existingBurn) {
      // Apply stacking logic
      const stackedData = this.applyStacking(
        existingBurn,
        canStack,
        dps,
        durationTurns,
        baseStackCount
      );
      newTickDamage = stackedData.tickDamage;
      newStackedCount = stackedData.stackedCount;
      stacked = canStack;
    }

    // Add/update burning component
    await this.#entityManager.addComponent(partId, componentId, {
      remainingTurns: durationTurns,
      tickDamage: newTickDamage,
      stackedCount: newStackedCount,
    });

    // Build event payload
    const eventPayload = {
      entityId,
      partId,
      stackedCount: newStackedCount,
      timestamp: Date.now(),
    };

    // Dispatch event via strategy
    dispatchStrategy.dispatch(startedEventId, eventPayload, sessionContext);

    // Record effect in session if applicable
    dispatchStrategy.recordEffect(partId, 'burning', sessionContext);

    this.#logger.debug(
      `BurnApplicator: Burning applied to part ${partId}. Stack: ${newStackedCount}`
    );

    return { applied: true, stacked, stackedCount: newStackedCount };
  }
}

export default BurnApplicator;
export {
  BurnApplicator,
  BURNING_COMPONENT_ID,
  BURNING_STARTED_EVENT,
  DEFAULT_TICK_DAMAGE,
  DEFAULT_DURATION_TURNS,
  DEFAULT_BURN_STACK_COUNT,
};
