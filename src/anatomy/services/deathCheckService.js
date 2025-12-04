/**
 * @file DeathCheckService - Monitors vital organ damage and manages dying/death state transitions.
 * @see specs/injury-reporting-and-user-interface.md section 5.3
 */

import { BaseService } from '../../utils/serviceBase.js';
import { NAME_COMPONENT_ID } from '../../constants/componentIds.js';

// --- Component ID Constants ---
const VITAL_ORGAN_COMPONENT_ID = 'anatomy:vital_organ';
const DYING_COMPONENT_ID = 'anatomy:dying';
const DEAD_COMPONENT_ID = 'anatomy:dead';
const PART_HEALTH_COMPONENT_ID = 'anatomy:part_health';
const POSITION_COMPONENT_ID = 'core:position';

// --- Threshold Constants ---
const CRITICAL_HEALTH_THRESHOLD = 10; // Below 10% triggers dying state
const DEFAULT_DYING_TURNS = 3;

// --- Vital Organ Types That Cause Immediate Death ---
const IMMEDIATE_DEATH_ORGANS = ['brain', 'heart', 'spine'];

/**
 * @typedef {object} DeathCheckResult
 * @property {boolean} isDead - Whether the entity is now dead
 * @property {boolean} isDying - Whether the entity is now in dying state
 * @property {object|null} deathInfo - Death details if isDead is true
 * @property {string} [deathInfo.causeOfDeath] - What killed the entity
 * @property {string|null} [deathInfo.vitalOrganDestroyed] - Vital organ destroyed if applicable
 * @property {string|null} [deathInfo.killedBy] - Killer entity ID if applicable
 */

/**
 * @typedef {object} VitalOrganDestructionInfo
 * @property {string} organType - Type of vital organ (brain, heart, spine)
 * @property {string} partEntityId - Entity ID of the destroyed body part
 */

/**
 * Service that monitors vital organ damage and manages dying/death state transitions.
 *
 * Death can occur in two ways:
 * 1. Immediate death when brain, heart, or spine are destroyed
 * 2. Gradual death through the dying state when overall health falls below 10%
 *
 * @augments BaseService
 */
class DeathCheckService extends BaseService {
  /** @type {import('../../interfaces/coreServices.js').ILogger} */
  #logger;

  /** @type {import('../../entities/entityManager.js').default} */
  #entityManager;

  /** @type {import('../../events/safeEventDispatcher.js').default} */
  #eventBus;

  /** @type {import('./injuryAggregationService.js').default} */
  #injuryAggregationService;

  /** @type {import('../bodyGraphService.js').default} */
  #bodyGraphService;

  /**
   * Creates a new DeathCheckService instance.
   *
   * @param {object} dependencies - The service dependencies
   * @param {import('../../interfaces/coreServices.js').ILogger} dependencies.logger - Logger instance
   * @param {import('../../entities/entityManager.js').default} dependencies.entityManager - Entity manager for component access
   * @param {import('../../events/safeEventDispatcher.js').default} dependencies.eventBus - Event bus for dispatching death events
   * @param {import('./injuryAggregationService.js').default} dependencies.injuryAggregationService - Service for aggregating injury data
   * @param {import('../bodyGraphService.js').default} dependencies.bodyGraphService - Service for traversing body part hierarchy
   */
  constructor({
    logger,
    entityManager,
    eventBus,
    injuryAggregationService,
    bodyGraphService,
  }) {
    super();
    this.#logger = this._init('DeathCheckService', logger, {
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData', 'hasComponent', 'addComponent'],
      },
      eventBus: {
        value: eventBus,
        requiredMethods: ['dispatch'],
      },
      injuryAggregationService: {
        value: injuryAggregationService,
        requiredMethods: ['aggregateInjuries'],
      },
      bodyGraphService: {
        value: bodyGraphService,
        requiredMethods: ['getAllDescendants'],
      },
    });
    this.#entityManager = entityManager;
    this.#eventBus = eventBus;
    this.#injuryAggregationService = injuryAggregationService;
    this.#bodyGraphService = bodyGraphService;
  }

  /**
   * Checks all death conditions after damage is applied.
   * Should be called after any damage event.
   *
   * This method checks:
   * 1. If any vital organs (brain, heart, spine) are destroyed → immediate death
   * 2. If overall health is below 10% → enters dying state
   *
   * @param {string} entityId - Entity to check
   * @param {string|null} [damageCauserId=null] - Entity that caused the damage (for killedBy)
   * @returns {DeathCheckResult} Result with isDead, isDying, deathInfo
   */
  checkDeathConditions(entityId, damageCauserId = null) {
    this.#logger.debug(`Checking death conditions for entity: ${entityId}`);

    // Check if already dead
    if (this.#entityManager.hasComponent(entityId, DEAD_COMPONENT_ID)) {
      this.#logger.debug(`Entity ${entityId} is already dead`);
      return { isDead: true, isDying: false, deathInfo: null };
    }

    // Check for vital organ destruction (immediate death)
    const vitalOrganInfo = this.#checkVitalOrganDestruction(entityId);
    if (vitalOrganInfo) {
      this.#logger.info(
        `Entity ${entityId} died from vital organ destruction: ${vitalOrganInfo.organType}`
      );
      this.#finalizeDeath(
        entityId,
        'vital_organ_destroyed',
        damageCauserId,
        vitalOrganInfo.organType
      );
      return {
        isDead: true,
        isDying: false,
        deathInfo: {
          causeOfDeath: 'vital_organ_destroyed',
          vitalOrganDestroyed: vitalOrganInfo.organType,
          killedBy: damageCauserId,
        },
      };
    }

    // Check for critical overall health (dying state)
    if (this.#checkOverallHealthCritical(entityId)) {
      // Only add dying component if not already dying
      if (!this.#entityManager.hasComponent(entityId, DYING_COMPONENT_ID)) {
        this.#logger.info(
          `Entity ${entityId} entering dying state due to critical health`
        );
        this.#addDyingComponent(entityId, 'overall_health_critical');
        return {
          isDead: false,
          isDying: true,
          deathInfo: null,
        };
      }
      // Already in dying state
      return { isDead: false, isDying: true, deathInfo: null };
    }

    // Entity is not dead or dying
    return { isDead: false, isDying: false, deathInfo: null };
  }

  /**
   * Processes dying state at turn end.
   * Decrements counter, triggers death if expired.
   *
   * @param {string} entityId - Entity in dying state
   * @returns {boolean} True if entity died this turn, false otherwise
   */
  processDyingTurn(entityId) {
    this.#logger.debug(`Processing dying turn for entity: ${entityId}`);

    // Check if entity is in dying state
    if (!this.#entityManager.hasComponent(entityId, DYING_COMPONENT_ID)) {
      this.#logger.debug(`Entity ${entityId} is not in dying state`);
      return false;
    }

    // Get dying component data
    const dyingData = this.#entityManager.getComponentData(
      entityId,
      DYING_COMPONENT_ID
    );
    if (!dyingData) {
      this.#logger.warn(
        `Entity ${entityId} has dying component but no data, removing component`
      );
      return false;
    }

    // Skip processing if stabilized
    if (dyingData.stabilizedBy) {
      this.#logger.debug(
        `Entity ${entityId} is stabilized by ${dyingData.stabilizedBy}, skipping countdown`
      );
      return false;
    }

    // Decrement turns remaining
    const newTurnsRemaining = Math.max(0, dyingData.turnsRemaining - 1);

    if (newTurnsRemaining <= 0) {
      // Entity dies from bleeding out / not being stabilized
      this.#logger.info(
        `Entity ${entityId} died from ${dyingData.causeOfDying} (dying countdown expired)`
      );
      this.#finalizeDeath(entityId, 'bleeding_out', null, null);
      return true;
    }

    // Update the dying component with new turns remaining
    this.#entityManager.addComponent(entityId, DYING_COMPONENT_ID, {
      turnsRemaining: newTurnsRemaining,
      causeOfDying: dyingData.causeOfDying,
      stabilizedBy: dyingData.stabilizedBy,
    });

    this.#logger.debug(
      `Entity ${entityId} dying countdown: ${newTurnsRemaining} turns remaining`
    );
    return false;
  }

  /**
   * Checks if any vital organs are destroyed, including organs nested inside destroyed parts.
   * When a body part is destroyed/dismembered, all its descendants (children, grandchildren, etc.)
   * are effectively destroyed as well.
   *
   * @param {string} entityId - Entity to check
   * @returns {VitalOrganDestructionInfo|null} Info about destroyed vital organ, or null if none
   * @private
   */
  #checkVitalOrganDestruction(entityId) {
    try {
      // Get injury summary which includes destroyed parts
      const summary =
        this.#injuryAggregationService.aggregateInjuries(entityId);
      if (!summary || !summary.destroyedParts) {
        return null;
      }

      // Check each destroyed part for vital organ component
      for (const partInfo of summary.destroyedParts) {
        // Check the destroyed part itself
        const directResult = this.#checkPartForVitalOrgan(partInfo.partEntityId);
        if (directResult) {
          return directResult;
        }

        // Check all descendants of the destroyed part (e.g., brain inside dismembered head)
        // Only trigger death if the vital organ itself is destroyed, not just its container
        const descendants = this.#bodyGraphService.getAllDescendants(
          partInfo.partEntityId
        );
        for (const descendantId of descendants) {
          // Only consider descendants that are ALSO destroyed (health = 0)
          const descendantHealth = this.#entityManager.getComponentData(
            descendantId,
            PART_HEALTH_COMPONENT_ID
          );

          // Skip if descendant has health > 0 (not destroyed)
          if (descendantHealth && descendantHealth.currentHealth > 0) {
            continue;
          }

          const descendantResult = this.#checkPartForVitalOrgan(descendantId);
          if (descendantResult) {
            this.#logger.debug(
              `Found vital organ '${descendantResult.organType}' destroyed in descendant '${descendantId}' ` +
                `of destroyed part '${partInfo.partEntityId}'`
            );
            return descendantResult;
          }
        }
      }

      return null;
    } catch (err) {
      this.#logger.warn(
        `Failed to check vital organ destruction for ${entityId}: ${err.message}`
      );
      return null;
    }
  }

  /**
   * Checks if a specific body part entity has a vital organ component that causes immediate death.
   *
   * @param {string} partEntityId - The body part entity ID to check
   * @returns {VitalOrganDestructionInfo|null} Info about vital organ, or null if not a vital organ
   * @private
   */
  #checkPartForVitalOrgan(partEntityId) {
    if (!this.#entityManager.hasComponent(partEntityId, VITAL_ORGAN_COMPONENT_ID)) {
      return null;
    }

    const vitalOrganData = this.#entityManager.getComponentData(
      partEntityId,
      VITAL_ORGAN_COMPONENT_ID
    );

    if (vitalOrganData && IMMEDIATE_DEATH_ORGANS.includes(vitalOrganData.organType)) {
      return {
        organType: vitalOrganData.organType,
        partEntityId,
      };
    }

    return null;
  }

  /**
   * Checks if overall health is critically low.
   *
   * @param {string} entityId - Entity to check
   * @returns {boolean} True if below 10% threshold
   * @private
   */
  #checkOverallHealthCritical(entityId) {
    try {
      const summary =
        this.#injuryAggregationService.aggregateInjuries(entityId);
      if (!summary) {
        return false;
      }
      return summary.overallHealthPercentage < CRITICAL_HEALTH_THRESHOLD;
    } catch (err) {
      this.#logger.warn(
        `Failed to check overall health for ${entityId}: ${err.message}`
      );
      return false;
    }
  }

  /**
   * Finalizes death: adds dead component, removes dying component, dispatches event.
   *
   * @param {string} entityId - Entity that died
   * @param {string} causeOfDeath - What killed them
   * @param {string|null} killedBy - Killer entity ID
   * @param {string|null} vitalOrganDestroyed - If applicable
   * @private
   */
  #finalizeDeath(entityId, causeOfDeath, killedBy, vitalOrganDestroyed) {
    const timestamp = Date.now();

    // Add dead component
    this.#entityManager.addComponent(entityId, DEAD_COMPONENT_ID, {
      causeOfDeath,
      vitalOrganDestroyed: vitalOrganDestroyed || null,
      killedBy: killedBy || null,
      deathTimestamp: timestamp,
    });

    // Get entity name for event
    const entityName = this.#getEntityName(entityId);

    // Build final message
    const finalMessage = this.#buildDeathMessage(
      entityName,
      causeOfDeath,
      vitalOrganDestroyed
    );

    // Dispatch death event
    this.#eventBus.dispatch('anatomy:entity_died', {
      entityId,
      entityName,
      causeOfDeath,
      vitalOrganDestroyed: vitalOrganDestroyed || null,
      killedBy: killedBy || null,
      finalMessage,
      timestamp,
    });

    // Dispatch perceptible event for observers
    const positionData = this.#entityManager.getComponentData(
      entityId,
      POSITION_COMPONENT_ID
    );
    if (positionData && positionData.locationId) {
      this.#eventBus.dispatch('core:perceptible_event', {
        eventName: 'core:perceptible_event',
        locationId: positionData.locationId,
        descriptionText: finalMessage,
        timestamp: new Date().toISOString(),
        perceptionType: 'entity_died',
        actorId: entityId,
        targetId: null,
        involvedEntities: [],
        contextualData: {
          skipRuleLogging: false,
        },
      });
    }

    this.#logger.info(`Death event dispatched for entity ${entityId}`);
  }

  /**
   * Adds the dying component to an entity and dispatches the dying event.
   *
   * @param {string} entityId - Entity entering dying state
   * @param {string} causeOfDying - What triggered the dying state
   * @private
   */
  #addDyingComponent(entityId, causeOfDying) {
    const timestamp = Date.now();

    // Add dying component
    this.#entityManager.addComponent(entityId, DYING_COMPONENT_ID, {
      turnsRemaining: DEFAULT_DYING_TURNS,
      causeOfDying,
      stabilizedBy: null,
    });

    // Get entity name for event
    const entityName = this.#getEntityName(entityId);

    // Dispatch dying event
    this.#eventBus.dispatch('anatomy:entity_dying', {
      entityId,
      entityName,
      turnsRemaining: DEFAULT_DYING_TURNS,
      causeOfDying,
      timestamp,
    });

    this.#logger.info(`Dying event dispatched for entity ${entityId}`);
  }

  /**
   * Gets the entity name from the core:name component.
   *
   * @param {string} entityId - Entity ID
   * @returns {string} Entity name or 'Unknown'
   * @private
   */
  #getEntityName(entityId) {
    try {
      const nameData = this.#entityManager.getComponentData(
        entityId,
        NAME_COMPONENT_ID
      );
      return nameData?.text || 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  /**
   * Builds a narrative death message.
   *
   * @param {string} entityName - Name of the deceased
   * @param {string} causeOfDeath - Cause of death
   * @param {string|null} vitalOrganDestroyed - If applicable
   * @returns {string} Narrative death message
   * @private
   */
  #buildDeathMessage(entityName, causeOfDeath, vitalOrganDestroyed) {
    return `${entityName} falls dead from their injuries.`;
  }
}

export default DeathCheckService;
