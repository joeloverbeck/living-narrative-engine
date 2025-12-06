/**
 * @file BurningTickSystem - Turn-based processor for burning effects
 *
 * Processes entities with the anatomy:burning component each turn,
 * applying tick damage and decrementing duration. Removes the component
 * and emits stopped events when duration expires or part is destroyed.
 *
 * Burning supports stacking: stackedCount and tickDamage can accumulate
 * when canStack is true on the damage type definition.
 *
 * @see specs/damage-types-and-special-effects.md
 */

import { BaseService } from '../../utils/serviceBase.js';
import { TURN_ENDED_ID } from '../../constants/eventIds.js';
import {
  BURNING_COMPONENT_ID,
  BURNING_STOPPED_EVENT,
} from './damageTypeEffectsService.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */

// Component IDs
const PART_HEALTH_COMPONENT_ID = 'anatomy:part_health';
const PART_COMPONENT_ID = 'anatomy:part';

/**
 * System responsible for processing burning effects each turn.
 * Subscribes to turn ended events and applies tick damage to burning parts.
 */
class BurningTickSystem extends BaseService {
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

    this.#logger = this._init('BurningTickSystem', logger, {
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
   * Handle turn ended event - process all burning effects.
   * @private
   */
  async #handleTurnEnded() {
    await this.processTick();
  }

  /**
   * Process all entities with burning components.
   * Applies tick damage, decrements duration, and handles expiration.
   */
  async processTick() {
    const burningParts =
      this.#entityManager.getEntitiesWithComponent(BURNING_COMPONENT_ID);

    if (!burningParts || burningParts.length === 0) {
      return;
    }

    this.#logger.debug(
      `BurningTickSystem: Processing ${burningParts.length} burning parts.`
    );

    for (const partId of burningParts) {
      await this.#processBurningPart(partId);
    }
  }

  /**
   * Process a single burning part.
   *
   * @param {string} partId - The part entity ID with burning
   * @private
   */
  async #processBurningPart(partId) {
    // Get burning component data
    const burningData = this.#entityManager.getComponentData(
      partId,
      BURNING_COMPONENT_ID
    );
    if (!burningData) {
      return;
    }

    const { remainingTurns, tickDamage, stackedCount } = burningData;

    // Get owner entity ID from part component for event payload
    const partComponent = this.#entityManager.getComponentData(
      partId,
      PART_COMPONENT_ID
    );
    const ownerEntityId = partComponent?.ownerEntityId ?? null;

    // Check if part is destroyed (no health component or currentHealth <= 0)
    const partHealth = this.#entityManager.hasComponent(
      partId,
      PART_HEALTH_COMPONENT_ID
    )
      ? this.#entityManager.getComponentData(partId, PART_HEALTH_COMPONENT_ID)
      : null;

    const partDestroyed =
      !partHealth ||
      (partHealth.currentHealth !== undefined && partHealth.currentHealth <= 0);

    // If part is destroyed, remove burning and emit stopped event
    if (partDestroyed) {
      await this.#stopBurning(
        partId,
        stackedCount ?? 1,
        ownerEntityId,
        'part_destroyed'
      );
      return;
    }

    // Apply tick damage to part health
    if (tickDamage > 0 && partHealth) {
      const newHealth = Math.max(
        0,
        (partHealth.currentHealth ?? 0) - tickDamage
      );
      await this.#entityManager.addComponent(partId, PART_HEALTH_COMPONENT_ID, {
        ...partHealth,
        currentHealth: newHealth,
      });

      this.#logger.debug(
        `BurningTickSystem: Part ${partId} took ${tickDamage} burn damage (${stackedCount ?? 1} stacks). Health: ${newHealth}`
      );
    }

    // Decrement remaining turns
    const newRemainingTurns = (remainingTurns ?? 1) - 1;

    if (newRemainingTurns <= 0) {
      // Duration expired - stop burning
      await this.#stopBurning(
        partId,
        stackedCount ?? 1,
        ownerEntityId,
        'duration_expired'
      );
    } else {
      // Update component with decremented duration
      await this.#entityManager.addComponent(partId, BURNING_COMPONENT_ID, {
        remainingTurns: newRemainingTurns,
        tickDamage,
        stackedCount: stackedCount ?? 1,
      });
    }
  }

  /**
   * Stop burning on a part and emit stopped event.
   *
   * @param {string} partId - The part entity ID
   * @param {number} stackedCount - The number of burn stacks
   * @param {string|null} entityId - The owner entity ID
   * @param {string} reason - Reason for stopping ('duration_expired' | 'part_destroyed')
   * @private
   */
  async #stopBurning(partId, stackedCount, entityId, reason) {
    await this.#entityManager.removeComponent(partId, BURNING_COMPONENT_ID);

    this.#dispatcher.dispatch(BURNING_STOPPED_EVENT, {
      entityId,
      partId,
      stackedCount,
      reason,
      timestamp: Date.now(),
    });

    this.#logger.debug(
      `BurningTickSystem: Burning stopped on part ${partId}. Stacks: ${stackedCount}, Reason: ${reason}`
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

export default BurningTickSystem;
