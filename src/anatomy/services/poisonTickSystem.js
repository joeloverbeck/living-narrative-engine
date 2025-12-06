/**
 * @file PoisonTickSystem - Turn-based processor for poison effects
 *
 * Processes entities with the anatomy:poisoned component each turn,
 * applying tick damage and decrementing duration. Removes the component
 * and emits stopped events when duration expires.
 *
 * Poison can be scoped to part or entity level. When scoped to entity,
 * the component is on the root entity rather than an individual part.
 *
 * @see specs/damage-types-and-special-effects.md
 */

import { BaseService } from '../../utils/serviceBase.js';
import { TURN_ENDED_ID } from '../../constants/eventIds.js';
import {
  POISONED_COMPONENT_ID,
  POISONED_STOPPED_EVENT,
} from './damageTypeEffectsService.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */

// Component ID for part health and entity health
const PART_HEALTH_COMPONENT_ID = 'anatomy:part_health';
const ENTITY_HEALTH_COMPONENT_ID = 'core:health';

/**
 * System responsible for processing poison effects each turn.
 * Subscribes to turn ended events and applies tick damage to poisoned targets.
 */
class PoisonTickSystem extends BaseService {
  /** @type {ILogger} */ #logger;
  /** @type {EntityManager} */ #entityManager;
  /** @type {ISafeEventDispatcher} */ #dispatcher;
  /** @type {IValidatedEventDispatcher} */ #eventSubscriber;
  /** @type {Array<Function>} */ #unsubscribeFunctions = [];

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger
   * @param {EntityManager} deps.entityManager
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher
   * @param {IValidatedEventDispatcher} deps.validatedEventDispatcher
   */
  constructor({
    logger,
    entityManager,
    safeEventDispatcher,
    validatedEventDispatcher,
  }) {
    super();

    this.#logger = this._init('PoisonTickSystem', logger, {
      entityManager: {
        value: entityManager,
        requiredMethods: [
          'getComponentData',
          'addComponent',
          'removeComponent',
          'hasComponent',
          'getEntitiesWithComponent',
        ],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
      validatedEventDispatcher: {
        value: validatedEventDispatcher,
        requiredMethods: ['subscribe'],
      },
    });

    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
    this.#eventSubscriber = validatedEventDispatcher;

    this.#subscribeToEvents();
  }

  /**
   * Subscribe to turn ended events.
   * @private
   */
  #subscribeToEvents() {
    const unsub = this.#eventSubscriber.subscribe(
      TURN_ENDED_ID,
      this.#handleTurnEnded.bind(this)
    );
    if (unsub) {
      this.#unsubscribeFunctions.push(unsub);
    }
  }

  /**
   * Handle turn ended event - process all poison effects.
   * @private
   */
  async #handleTurnEnded() {
    await this.processTick();
  }

  /**
   * Process all entities with poisoned components.
   * Applies tick damage, decrements duration, and handles expiration.
   */
  async processTick() {
    const poisonedTargets = this.#entityManager.getEntitiesWithComponent(
      POISONED_COMPONENT_ID
    );

    if (!poisonedTargets || poisonedTargets.length === 0) {
      return;
    }

    this.#logger.debug(
      `PoisonTickSystem: Processing ${poisonedTargets.length} poisoned targets.`
    );

    for (const targetId of poisonedTargets) {
      await this.#processPoisonedTarget(targetId);
    }
  }

  /**
   * Process a single poisoned target.
   * Target can be either a part (scope: 'part') or an entity (scope: 'entity').
   *
   * @param {string} targetId - The target entity ID with poison
   * @private
   */
  async #processPoisonedTarget(targetId) {
    // Get poisoned component data
    const poisonData = this.#entityManager.getComponentData(
      targetId,
      POISONED_COMPONENT_ID
    );
    if (!poisonData) {
      return;
    }

    const { remainingTurns, tickDamage } = poisonData;

    // Determine scope by checking which health component exists
    const isEntityScope = this.#entityManager.hasComponent(
      targetId,
      ENTITY_HEALTH_COMPONENT_ID
    );
    const scope = isEntityScope ? 'entity' : 'part';

    // Get target health
    const healthComponentId = isEntityScope
      ? ENTITY_HEALTH_COMPONENT_ID
      : PART_HEALTH_COMPONENT_ID;
    const targetHealth = this.#entityManager.hasComponent(
      targetId,
      healthComponentId
    )
      ? this.#entityManager.getComponentData(targetId, healthComponentId)
      : null;

    const targetDestroyed =
      !targetHealth ||
      (targetHealth.currentHealth !== undefined &&
        targetHealth.currentHealth <= 0);

    // If target is destroyed, remove poison and emit stopped event
    if (targetDestroyed) {
      await this.#stopPoison(targetId, scope, 'target_destroyed');
      return;
    }

    // Apply tick damage to target health
    if (tickDamage > 0 && targetHealth) {
      const newHealth = Math.max(
        0,
        (targetHealth.currentHealth ?? 0) - tickDamage
      );
      await this.#entityManager.addComponent(targetId, healthComponentId, {
        ...targetHealth,
        currentHealth: newHealth,
      });

      this.#logger.debug(
        `PoisonTickSystem: ${scope === 'entity' ? 'Entity' : 'Part'} ${targetId} took ${tickDamage} poison damage. Health: ${newHealth}`
      );
    }

    // Decrement remaining turns
    const newRemainingTurns = (remainingTurns ?? 1) - 1;

    if (newRemainingTurns <= 0) {
      // Duration expired - stop poison
      await this.#stopPoison(targetId, scope, 'duration_expired');
    } else {
      // Update component with decremented duration
      await this.#entityManager.addComponent(targetId, POISONED_COMPONENT_ID, {
        remainingTurns: newRemainingTurns,
        tickDamage,
      });
    }
  }

  /**
   * Stop poison on a target and emit stopped event.
   *
   * @param {string} targetId - The target entity ID
   * @param {string} scope - The poison scope ('part' | 'entity')
   * @param {string} reason - Reason for stopping ('duration_expired' | 'target_destroyed')
   * @private
   */
  async #stopPoison(targetId, scope, reason) {
    await this.#entityManager.removeComponent(targetId, POISONED_COMPONENT_ID);

    // Build event payload based on scope
    const eventPayload = {
      scope,
      reason,
      timestamp: Date.now(),
    };

    // Add partId only if scope is 'part'
    if (scope === 'part') {
      eventPayload.partId = targetId;
    } else {
      eventPayload.entityId = targetId;
    }

    this.#dispatcher.dispatch(POISONED_STOPPED_EVENT, eventPayload);

    this.#logger.debug(
      `PoisonTickSystem: Poison stopped on ${scope} ${targetId}. Reason: ${reason}`
    );
  }

  /**
   * Clean up subscriptions.
   */
  destroy() {
    this.#unsubscribeFunctions.forEach((fn) => fn?.());
    this.#unsubscribeFunctions = [];
  }
}

export default PoisonTickSystem;
