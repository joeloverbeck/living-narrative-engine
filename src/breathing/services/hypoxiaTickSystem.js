/**
 * @file HypoxiaTickSystem - Turn-based processor for hypoxia (oxygen deprivation) effects
 *
 * Processes entities with the breathing:hypoxic component each turn,
 * escalating severity based on duration and applying unconsciousness
 * and brain damage when thresholds are exceeded.
 *
 * Severity escalation thresholds:
 * - mild: turnsInState 0-2
 * - moderate: turnsInState 3-4
 * - severe: turnsInState 5-6
 * - unconscious: turnsInState 7+
 *
 * @see brainstorming/oxygen-drowning-system.md
 */

import { BaseService } from '../../utils/serviceBase.js';
import { TURN_ENDED_ID } from '../../constants/eventIds.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */

// Component IDs
const HYPOXIC_COMPONENT_ID = 'breathing:hypoxic';
const UNCONSCIOUS_ANOXIA_COMPONENT_ID = 'breathing:unconscious_anoxia';
const PART_COMPONENT_ID = 'anatomy:part';
const VITAL_ORGAN_COMPONENT_ID = 'anatomy:vital_organ';
const PART_HEALTH_COMPONENT_ID = 'anatomy:part_health';

// Event IDs
const ANOXIC_UNCONSCIOUSNESS_STARTED_EVENT =
  'breathing:anoxic_unconsciousness_started';
const BRAIN_DAMAGE_STARTED_EVENT = 'breathing:brain_damage_started';

// Severity thresholds (turnsInState values)
const MODERATE_THRESHOLD = 3;
const SEVERE_THRESHOLD = 5;
const UNCONSCIOUS_THRESHOLD = 7;
const BRAIN_DAMAGE_THRESHOLD = 2; // turns unconscious before brain damage

// Anoxic damage per turn
const ANOXIC_DAMAGE_AMOUNT = 5;

/**
 * System responsible for processing hypoxia effects each turn.
 * Subscribes to turn ended events and escalates severity, applies
 * unconsciousness, and applies brain damage based on duration thresholds.
 */
class HypoxiaTickSystem extends BaseService {
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

    this.#logger = this._init('HypoxiaTickSystem', logger, {
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
   * Handle turn ended event - process all hypoxia effects.
   * @private
   */
  async #handleTurnEnded() {
    await this.processTick();
  }

  /**
   * Process all entities with hypoxic components.
   * Escalates severity, applies unconsciousness, and applies brain damage.
   */
  async processTick() {
    const hypoxicEntities = this.#entityManager.getEntitiesWithComponent(
      HYPOXIC_COMPONENT_ID
    );

    if (!hypoxicEntities || hypoxicEntities.length === 0) {
      return;
    }

    this.#logger.debug(
      `HypoxiaTickSystem: Processing ${hypoxicEntities.length} hypoxic entities.`
    );

    for (const entityId of hypoxicEntities) {
      await this.#processHypoxicEntity(entityId);
    }
  }

  /**
   * Process a single hypoxic entity.
   *
   * @param {string} entityId - The entity ID with hypoxia
   * @private
   */
  async #processHypoxicEntity(entityId) {
    // Get hypoxic component data
    const hypoxicData = this.#entityManager.getComponentData(
      entityId,
      HYPOXIC_COMPONENT_ID
    );
    if (!hypoxicData) {
      return;
    }

    let { severity, turnsInState, actionPenalty } = hypoxicData;

    // Increment turns in state
    turnsInState = (turnsInState ?? 0) + 1;

    // Determine new severity based on thresholds
    let newSeverity = severity ?? 'mild';
    let newActionPenalty = actionPenalty ?? 0;

    if (turnsInState >= UNCONSCIOUS_THRESHOLD) {
      // Already at max severity, handle unconsciousness
      await this.#handleUnconsciousness(entityId);
    } else if (turnsInState >= SEVERE_THRESHOLD && newSeverity !== 'severe') {
      newSeverity = 'severe';
      newActionPenalty = 4;
      this.#logger.debug(
        `HypoxiaTickSystem: Entity ${entityId} hypoxia escalated to severe.`
      );
    } else if (
      turnsInState >= MODERATE_THRESHOLD &&
      newSeverity === 'mild'
    ) {
      newSeverity = 'moderate';
      newActionPenalty = 2;
      this.#logger.debug(
        `HypoxiaTickSystem: Entity ${entityId} hypoxia escalated to moderate.`
      );
    }

    // Update hypoxic component
    await this.#entityManager.addComponent(entityId, HYPOXIC_COMPONENT_ID, {
      severity: newSeverity,
      turnsInState,
      actionPenalty: newActionPenalty,
    });

    // If entity is already unconscious, check for brain damage
    if (this.#entityManager.hasComponent(entityId, UNCONSCIOUS_ANOXIA_COMPONENT_ID)) {
      await this.#processUnconsciousEntity(entityId);
    }
  }

  /**
   * Handle transition to unconsciousness.
   *
   * @param {string} entityId - The entity becoming unconscious
   * @private
   */
  async #handleUnconsciousness(entityId) {
    // Check if already unconscious
    if (this.#entityManager.hasComponent(entityId, UNCONSCIOUS_ANOXIA_COMPONENT_ID)) {
      return;
    }

    // Add unconscious component
    await this.#entityManager.addComponent(
      entityId,
      UNCONSCIOUS_ANOXIA_COMPONENT_ID,
      {
        turnsUnconscious: 0,
        brainDamageStarted: false,
      }
    );

    // Dispatch event
    this.#dispatcher.dispatch(ANOXIC_UNCONSCIOUSNESS_STARTED_EVENT, {
      entityId,
      timestamp: Date.now(),
    });

    this.#logger.debug(
      `HypoxiaTickSystem: Entity ${entityId} has lost consciousness from hypoxia.`
    );
  }

  /**
   * Process an already unconscious entity for brain damage.
   *
   * @param {string} entityId - The unconscious entity
   * @private
   */
  async #processUnconsciousEntity(entityId) {
    const unconsciousData = this.#entityManager.getComponentData(
      entityId,
      UNCONSCIOUS_ANOXIA_COMPONENT_ID
    );
    if (!unconsciousData) {
      return;
    }

    let { turnsUnconscious, brainDamageStarted } = unconsciousData;

    // Increment turns unconscious
    turnsUnconscious = (turnsUnconscious ?? 0) + 1;

    // Check if brain damage should start
    if (turnsUnconscious >= BRAIN_DAMAGE_THRESHOLD) {
      // Apply brain damage
      await this.#applyBrainDamage(entityId, brainDamageStarted);

      // Mark brain damage as started if first time
      if (!brainDamageStarted) {
        brainDamageStarted = true;
      }
    }

    // Update unconscious component
    await this.#entityManager.addComponent(
      entityId,
      UNCONSCIOUS_ANOXIA_COMPONENT_ID,
      {
        turnsUnconscious,
        brainDamageStarted,
      }
    );
  }

  /**
   * Apply anoxic damage to the entity's brain.
   *
   * @param {string} entityId - The entity suffering brain damage
   * @param {boolean} alreadyStarted - Whether brain damage was already started
   * @private
   */
  async #applyBrainDamage(entityId, alreadyStarted) {
    // Find brain organ for this entity
    const brainPartId = await this.#findBrainOrgan(entityId);

    if (!brainPartId) {
      this.#logger.warn(
        `HypoxiaTickSystem: Could not find brain organ for entity ${entityId}.`
      );
      return;
    }

    // Get current brain health
    const partHealth = this.#entityManager.hasComponent(
      brainPartId,
      PART_HEALTH_COMPONENT_ID
    )
      ? this.#entityManager.getComponentData(brainPartId, PART_HEALTH_COMPONENT_ID)
      : null;

    if (!partHealth) {
      this.#logger.warn(
        `HypoxiaTickSystem: Brain organ ${brainPartId} has no health component.`
      );
      return;
    }

    // Apply anoxic damage
    const newHealth = Math.max(
      0,
      (partHealth.currentHealth ?? 0) - ANOXIC_DAMAGE_AMOUNT
    );
    await this.#entityManager.addComponent(brainPartId, PART_HEALTH_COMPONENT_ID, {
      ...partHealth,
      currentHealth: newHealth,
    });

    this.#logger.debug(
      `HypoxiaTickSystem: Brain ${brainPartId} took ${ANOXIC_DAMAGE_AMOUNT} anoxic damage. Health: ${newHealth}`
    );

    // Dispatch brain damage started event (only on first application)
    if (!alreadyStarted) {
      this.#dispatcher.dispatch(BRAIN_DAMAGE_STARTED_EVENT, {
        entityId,
        timestamp: Date.now(),
      });

      this.#logger.debug(
        `HypoxiaTickSystem: Brain damage started for entity ${entityId}.`
      );
    }
  }

  /**
   * Find the brain organ for an entity.
   *
   * @param {string} entityId - The entity to search for brain organ
   * @returns {Promise<string|null>} The brain part ID or null if not found
   * @private
   */
  async #findBrainOrgan(entityId) {
    // Get all entities with vital_organ component
    const vitalOrgans = this.#entityManager.getEntitiesWithComponent(
      VITAL_ORGAN_COMPONENT_ID
    );

    if (!vitalOrgans || vitalOrgans.length === 0) {
      return null;
    }

    for (const organId of vitalOrgans) {
      // Check if this organ belongs to the entity
      const partData = this.#entityManager.getComponentData(
        organId,
        PART_COMPONENT_ID
      );

      if (partData?.ownerEntityId !== entityId) {
        continue;
      }

      // Check if this is a brain
      const vitalOrganData = this.#entityManager.getComponentData(
        organId,
        VITAL_ORGAN_COMPONENT_ID
      );

      if (vitalOrganData?.organType === 'brain') {
        return organId;
      }
    }

    return null;
  }

  /**
   * Clean up subscriptions.
   */
  destroy() {
    this.#unsubscribeFunctions.forEach((fn) => fn?.());
    this.#unsubscribeFunctions = [];
  }
}

export default HypoxiaTickSystem;
