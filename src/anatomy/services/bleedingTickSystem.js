/**
 * @file BleedingTickSystem - Turn-based processor for bleeding effects
 *
 * Processes entities with the anatomy:bleeding component each turn,
 * applying tick damage and decrementing duration. Removes the component
 * and emits stopped events when duration expires or part is destroyed.
 *
 * @see specs/damage-types-and-special-effects.md
 */

import { BaseService } from '../../utils/serviceBase.js';
import { TURN_ENDED_ID } from '../../constants/eventIds.js';
import {
  BLEEDING_COMPONENT_ID,
  BLEEDING_STOPPED_EVENT,
} from './damageTypeEffectsService.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */

// Component IDs
const PART_HEALTH_COMPONENT_ID = 'anatomy:part_health';
const PART_COMPONENT_ID = 'anatomy:part';

/**
 * System responsible for processing bleeding effects each turn.
 * Subscribes to turn ended events and applies tick damage to bleeding parts.
 */
class BleedingTickSystem extends BaseService {
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

    this.#logger = this._init('BleedingTickSystem', logger, {
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
   * Handle turn ended event - process all bleeding effects.
   * @private
   */
  async #handleTurnEnded() {
    await this.processTick();
  }

  /**
   * Process all entities with bleeding components.
   * Applies tick damage, decrements duration, and handles expiration.
   */
  async processTick() {
    const bleedingParts = this.#entityManager.getEntitiesWithComponent(
      BLEEDING_COMPONENT_ID
    );

    if (!bleedingParts || bleedingParts.length === 0) {
      return;
    }

    this.#logger.debug(
      `BleedingTickSystem: Processing ${bleedingParts.length} bleeding parts.`
    );

    for (const partId of bleedingParts) {
      await this.#processBleedingPart(partId);
    }
  }

  /**
   * Process a single bleeding part.
   *
   * @param {string} partId - The part entity ID with bleeding
   * @private
   */
  async #processBleedingPart(partId) {
    // Get bleeding component data
    const bleedingData = this.#entityManager.getComponentData(
      partId,
      BLEEDING_COMPONENT_ID
    );
    if (!bleedingData) {
      return;
    }

    const { severity, remainingTurns, tickDamage } = bleedingData;

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

    // If part is destroyed, remove bleeding and emit stopped event
    if (partDestroyed) {
      await this.#stopBleeding(
        partId,
        severity,
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
        `BleedingTickSystem: Part ${partId} took ${tickDamage} bleed damage. Health: ${newHealth}`
      );
    }

    // Decrement remaining turns
    const newRemainingTurns = (remainingTurns ?? 1) - 1;

    if (newRemainingTurns <= 0) {
      // Duration expired - stop bleeding
      await this.#stopBleeding(
        partId,
        severity,
        ownerEntityId,
        'duration_expired'
      );
    } else {
      // Update component with decremented duration
      await this.#entityManager.addComponent(partId, BLEEDING_COMPONENT_ID, {
        severity,
        remainingTurns: newRemainingTurns,
        tickDamage,
      });
    }
  }

  /**
   * Stop bleeding on a part and emit stopped event.
   *
   * @param {string} partId - The part entity ID
   * @param {string} severity - The bleeding severity
   * @param {string|null} entityId - The owner entity ID
   * @param {string} reason - Reason for stopping ('duration_expired' | 'part_destroyed')
   * @private
   */
  async #stopBleeding(partId, severity, entityId, reason) {
    await this.#entityManager.removeComponent(partId, BLEEDING_COMPONENT_ID);

    this.#dispatcher.dispatch(BLEEDING_STOPPED_EVENT, {
      entityId,
      partId,
      severity,
      reason,
      timestamp: Date.now(),
    });

    this.#logger.debug(
      `BleedingTickSystem: Bleeding stopped on part ${partId}. Reason: ${reason}`
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

export default BleedingTickSystem;
