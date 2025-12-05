/**
 * @file InjuryAggregationService - Collects injury data from all body parts into an InjurySummaryDTO.
 * @see specs/injury-reporting-and-user-interface.md section 5.1
 */

import { BaseService } from '../../utils/serviceBase.js';
import { NAME_COMPONENT_ID } from '../../constants/componentIds.js';
import {
  BLEEDING_COMPONENT_ID,
  BURNING_COMPONENT_ID,
  POISONED_COMPONENT_ID,
  DISMEMBERED_COMPONENT_ID,
} from './damageTypeEffectsService.js';
import { HEALTH_STATE_REGISTRY } from '../../anatomy/registries/healthStateRegistry.js';

// --- Component ID Constants ---
const PART_HEALTH_COMPONENT_ID = 'anatomy:part_health';
const PART_COMPONENT_ID = 'anatomy:part';
const FRACTURED_COMPONENT_ID = 'anatomy:fractured';
const STUNNED_COMPONENT_ID = 'anatomy:stunned';
const DYING_COMPONENT_ID = 'anatomy:dying';
const DEAD_COMPONENT_ID = 'anatomy:dead';
const BODY_COMPONENT_ID = 'anatomy:body';
const GENDER_COMPONENT_ID = 'core:gender';

// --- Vital Organ Component ID ---
const VITAL_ORGAN_COMPONENT_ID = 'anatomy:vital_organ';

// --- Pronoun Mapping ---
const PRONOUN_MAP = {
  male: 'he',
  female: 'she',
  neutral: 'they',
  unknown: 'they',
};

/**
 * @typedef {object} InjuredPartInfo
 * @property {string} partEntityId - Entity ID of the injured part
 * @property {string} partType - Type of part (arm, leg, torso, head, etc.)
 * @property {string|null} orientation - left, right, or null
 * @property {string} state - Current health state (scratched, wounded, injured, critical, destroyed)
 * @property {number} healthPercentage - 0-100
 * @property {number} currentHealth - Current health points
 * @property {number} maxHealth - Maximum health points
 * @property {boolean} isBleeding - Has anatomy:bleeding component
 * @property {string|null} bleedingSeverity - minor, moderate, severe, or null
 * @property {boolean} isBurning - Has anatomy:burning component
 * @property {boolean} isPoisoned - Has anatomy:poisoned component
 * @property {boolean} isFractured - Has anatomy:fractured component
 * @property {boolean} isDismembered - Has anatomy:dismembered component
 * @property {boolean} isStunned - Has anatomy:stunned component
 * @property {boolean} isVitalOrgan - Has anatomy:vital_organ component
 */

/**
 * @typedef {object} InjurySummaryDTO
 * @property {string} entityId - Owner entity ID
 * @property {string} entityName - Name of the entity
 * @property {string} entityPronoun - Pronoun (he/she/they/it)
 * @property {InjuredPartInfo[]} injuredParts - All parts not in 'healthy' state
 * @property {InjuredPartInfo[]} bleedingParts - Parts with active bleeding
 * @property {InjuredPartInfo[]} burningParts - Parts with active burning
 * @property {InjuredPartInfo[]} poisonedParts - Parts with poison
 * @property {InjuredPartInfo[]} fracturedParts - Parts with fractures
 * @property {InjuredPartInfo[]} dismemberedParts - Parts that are dismembered
 * @property {InjuredPartInfo[]} destroyedParts - Parts that are destroyed
 * @property {number} overallHealthPercentage - Weighted average health (0-100)
 * @property {boolean} isDying - Has anatomy:dying component
 * @property {number|null} dyingTurnsRemaining - If dying, turns until death
 * @property {string|null} dyingCause - If dying, what caused it
 * @property {boolean} isDead - Has anatomy:dead component
 * @property {string|null} causeOfDeath - If dead, what killed them
 */

/**
 * Service that collects injury data from all body parts into an InjurySummaryDTO structure.
 *
 * @augments BaseService
 */
class InjuryAggregationService extends BaseService {
  /** @type {import('../../interfaces/coreServices.js').ILogger} */
  #logger;

  /** @type {import('../../entities/entityManager.js').default} */
  #entityManager;

  /** @type {import('../bodyGraphService.js').default} */
  #bodyGraphService;

  /**
   * Creates a new InjuryAggregationService instance.
   *
   * @param {object} dependencies - The service dependencies
   * @param {import('../../interfaces/coreServices.js').ILogger} dependencies.logger - Logger instance
   * @param {import('../../entities/entityManager.js').default} dependencies.entityManager - Entity manager for component access
   * @param {import('../bodyGraphService.js').default} dependencies.bodyGraphService - Body graph service for part traversal
   */
  constructor({ logger, entityManager, bodyGraphService }) {
    super();
    this.#logger = this._init('InjuryAggregationService', logger, {
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData', 'hasComponent'],
      },
      bodyGraphService: {
        value: bodyGraphService,
        requiredMethods: ['getAllParts'],
      },
    });
    this.#entityManager = entityManager;
    this.#bodyGraphService = bodyGraphService;
  }

  /**
   * Aggregates all injury data for an entity into a comprehensive summary.
   *
   * @param {string} entityId - The entity ID to aggregate injuries for
   * @returns {InjurySummaryDTO} Complete injury summary for the entity
   */
  aggregateInjuries(entityId) {
    this.#logger.debug(`Aggregating injuries for entity: ${entityId}`);

    // Get entity metadata
    const entityName = this.#getEntityName(entityId);
    const entityPronoun = this.#getEntityPronoun(entityId);

    // Get dying/dead state from the owner entity
    const dyingData = this.#getDyingData(entityId);
    const deadData = this.#getDeadData(entityId);

    // Get all body parts and build part info array
    const allPartInfos = this.#buildAllPartInfos(entityId);

    // Filter parts into categories
    const injuredParts = allPartInfos.filter(
      (part) => part.state !== HEALTH_STATE_REGISTRY.healthy.id
    );
    const bleedingParts = allPartInfos.filter((part) => part.isBleeding);
    const burningParts = allPartInfos.filter((part) => part.isBurning);
    const poisonedParts = allPartInfos.filter((part) => part.isPoisoned);
    const fracturedParts = allPartInfos.filter((part) => part.isFractured);
    const dismemberedParts = allPartInfos.filter((part) => part.isDismembered);
    const destroyedParts = allPartInfos.filter(
      (part) => part.state === HEALTH_STATE_REGISTRY.destroyed.id
    );

    // Calculate weighted overall health
    const overallHealthPercentage =
      this.#calculateOverallHealth(allPartInfos);

    /** @type {InjurySummaryDTO} */
    const summary = {
      entityId,
      entityName,
      entityPronoun,
      injuredParts,
      bleedingParts,
      burningParts,
      poisonedParts,
      fracturedParts,
      dismemberedParts,
      destroyedParts,
      overallHealthPercentage,
      isDying: dyingData.isDying,
      dyingTurnsRemaining: dyingData.turnsRemaining,
      dyingCause: dyingData.cause,
      isDead: deadData.isDead,
      causeOfDeath: deadData.cause,
    };

    this.#logger.debug(
      `Injury aggregation complete for ${entityId}: ${injuredParts.length} injured parts, overall health: ${overallHealthPercentage}%`
    );

    return summary;
  }

  /**
   * Gets the entity name from the core:name component.
   *
   * @param {string} entityId - Entity ID
   * @returns {string} Entity name or 'Unknown' if not found
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
   * Gets the entity pronoun based on the core:gender component.
   *
   * @param {string} entityId - Entity ID
   * @returns {string} Pronoun (he/she/they)
   * @private
   */
  #getEntityPronoun(entityId) {
    try {
      const genderData = this.#entityManager.getComponentData(
        entityId,
        GENDER_COMPONENT_ID
      );
      const gender = genderData?.value || 'neutral';
      return PRONOUN_MAP[gender] || PRONOUN_MAP.neutral;
    } catch {
      return PRONOUN_MAP.neutral;
    }
  }

  /**
   * Gets dying state data from the entity.
   *
   * @param {string} entityId - Entity ID
   * @returns {{isDying: boolean, turnsRemaining: number|null, cause: string|null}} Dying state
   * @private
   */
  #getDyingData(entityId) {
    try {
      if (!this.#entityManager.hasComponent(entityId, DYING_COMPONENT_ID)) {
        return { isDying: false, turnsRemaining: null, cause: null };
      }
      const dyingData = this.#entityManager.getComponentData(
        entityId,
        DYING_COMPONENT_ID
      );
      return {
        isDying: true,
        turnsRemaining: dyingData?.turnsRemaining ?? null,
        cause: dyingData?.causeOfDying ?? null,
      };
    } catch {
      return { isDying: false, turnsRemaining: null, cause: null };
    }
  }

  /**
   * Gets dead state data from the entity.
   *
   * @param {string} entityId - Entity ID
   * @returns {{isDead: boolean, cause: string|null}} Dead state
   * @private
   */
  #getDeadData(entityId) {
    try {
      if (!this.#entityManager.hasComponent(entityId, DEAD_COMPONENT_ID)) {
        return { isDead: false, cause: null };
      }
      const deadData = this.#entityManager.getComponentData(
        entityId,
        DEAD_COMPONENT_ID
      );
      return {
        isDead: true,
        cause: deadData?.causeOfDeath ?? null,
      };
    } catch {
      return { isDead: false, cause: null };
    }
  }

  /**
   * Builds InjuredPartInfo for all body parts of an entity.
   *
   * @param {string} entityId - Entity ID
   * @returns {InjuredPartInfo[]} Array of part info objects
   * @private
   */
  #buildAllPartInfos(entityId) {
    const partIds = this.#findAllBodyParts(entityId);
    const partInfos = [];

    for (const partId of partIds) {
      const partInfo = this.#buildPartInfo(partId);
      if (partInfo) {
        partInfos.push(partInfo);
      }
    }

    return partInfos;
  }

  /**
   * Finds all body part entity IDs for an entity.
   *
   * @param {string} entityId - Entity ID
   * @returns {string[]} Array of body part entity IDs
   * @private
   */
  #findAllBodyParts(entityId) {
    try {
      const bodyComponent = this.#entityManager.getComponentData(
        entityId,
        BODY_COMPONENT_ID
      );
      if (!bodyComponent) {
        this.#logger.warn(`No body component found for entity ${entityId}`);
        return [];
      }
      return this.#bodyGraphService.getAllParts(bodyComponent, entityId);
    } catch (err) {
      this.#logger.warn(
        `Failed to find body parts for entity ${entityId}: ${err.message}`
      );
      return [];
    }
  }

  /**
   * Builds InjuredPartInfo for a single body part.
   *
   * @param {string} partEntityId - Body part entity ID
   * @returns {InjuredPartInfo|null} Part info or null if no health component
   * @private
   */
  #buildPartInfo(partEntityId) {
    // Get part_health component - required for injury info
    const healthData = this.#getPartHealthData(partEntityId);
    if (!healthData) {
      return null;
    }

    // Get part metadata (subType, orientation, healthCalculationWeight)
    const partData = this.#getPartMetadata(partEntityId);

    // Get vital organ data if present
    const vitalOrganData = this.#getVitalOrganData(partEntityId);

    // Get status effect states
    const bleedingData = this.#getBleedingData(partEntityId);

    return {
      partEntityId,
      partType: partData.subType,
      orientation: partData.orientation,
      state: healthData.state,
      healthPercentage: this.#calculateHealthPercentage(
        healthData.currentHealth,
        healthData.maxHealth
      ),
      currentHealth: healthData.currentHealth,
      maxHealth: healthData.maxHealth,
      healthCalculationWeight: partData.healthCalculationWeight,
      vitalOrganCap: vitalOrganData
        ? {
            threshold: vitalOrganData.healthCapThreshold,
            capValue: vitalOrganData.healthCapValue,
          }
        : null,
      isVitalOrgan: Boolean(vitalOrganData),
      isBleeding: bleedingData.isBleeding,
      bleedingSeverity: bleedingData.severity,
      isBurning: this.#entityManager.hasComponent(
        partEntityId,
        BURNING_COMPONENT_ID
      ),
      isPoisoned: this.#entityManager.hasComponent(
        partEntityId,
        POISONED_COMPONENT_ID
      ),
      isFractured: this.#entityManager.hasComponent(
        partEntityId,
        FRACTURED_COMPONENT_ID
      ),
      isDismembered: this.#entityManager.hasComponent(
        partEntityId,
        DISMEMBERED_COMPONENT_ID
      ),
      isStunned: this.#entityManager.hasComponent(
        partEntityId,
        STUNNED_COMPONENT_ID
      ),
    };
  }

  /**
   * Gets part_health component data.
   *
   * @param {string} partEntityId - Part entity ID
   * @returns {{currentHealth: number, maxHealth: number, state: string}|null} Health data or null
   * @private
   */
  #getPartHealthData(partEntityId) {
    try {
      if (
        !this.#entityManager.hasComponent(partEntityId, PART_HEALTH_COMPONENT_ID)
      ) {
        return null;
      }
      const data = this.#entityManager.getComponentData(
        partEntityId,
        PART_HEALTH_COMPONENT_ID
      );
      return {
        currentHealth: data?.currentHealth ?? 0,
        maxHealth: data?.maxHealth ?? 1,
        state: data?.state ?? HEALTH_STATE_REGISTRY.healthy.id,
      };
    } catch {
      return null;
    }
  }

  /**
   * Gets part metadata (subType, orientation, healthCalculationWeight) from anatomy:part component.
   *
   * @param {string} partEntityId - Part entity ID
   * @returns {{subType: string, orientation: string|null, healthCalculationWeight: number}} Part metadata
   * @private
   */
  #getPartMetadata(partEntityId) {
    try {
      const partData = this.#entityManager.getComponentData(
        partEntityId,
        PART_COMPONENT_ID
      );
      return {
        subType: partData?.subType ?? 'unknown',
        orientation: partData?.orientation ?? null,
        healthCalculationWeight: partData?.health_calculation_weight ?? 1,
      };
    } catch {
      return { subType: 'unknown', orientation: null, healthCalculationWeight: 1 };
    }
  }

  /**
   * Gets vital organ component data if present.
   *
   * @param {string} partEntityId - Part entity ID
   * @returns {{organType: string, healthCapThreshold: number, healthCapValue: number}|null}
   * @private
   */
  #getVitalOrganData(partEntityId) {
    try {
      if (!this.#entityManager.hasComponent(partEntityId, VITAL_ORGAN_COMPONENT_ID)) {
        return null;
      }
      const data = this.#entityManager.getComponentData(
        partEntityId,
        VITAL_ORGAN_COMPONENT_ID
      );
      return {
        organType: data?.organType ?? null,
        healthCapThreshold: data?.healthCapThreshold ?? 20,
        healthCapValue: data?.healthCapValue ?? 30,
      };
    } catch {
      return null;
    }
  }

  /**
   * Gets bleeding data for a part.
   *
   * @param {string} partEntityId - Part entity ID
   * @returns {{isBleeding: boolean, severity: string|null}} Bleeding data
   * @private
   */
  #getBleedingData(partEntityId) {
    try {
      if (
        !this.#entityManager.hasComponent(partEntityId, BLEEDING_COMPONENT_ID)
      ) {
        return { isBleeding: false, severity: null };
      }
      const bleedingData = this.#entityManager.getComponentData(
        partEntityId,
        BLEEDING_COMPONENT_ID
      );
      return {
        isBleeding: true,
        severity: bleedingData?.severity ?? null,
      };
    } catch {
      return { isBleeding: false, severity: null };
    }
  }

  /**
   * Calculates health percentage from current and max health.
   *
   * @param {number} currentHealth - Current health points
   * @param {number} maxHealth - Maximum health points
   * @returns {number} Health percentage (0-100)
   * @private
   */
  #calculateHealthPercentage(currentHealth, maxHealth) {
    if (maxHealth <= 0) {
      return 0;
    }
    const percentage = (currentHealth / maxHealth) * 100;
    return Math.round(Math.max(0, Math.min(100, percentage)));
  }

  /**
   * Calculates overall health percentage from weighted part health.
   *
   * @param {InjuredPartInfo[]} partInfos - Array of part info objects
   * @returns {number} Overall health percentage (0-100)
   * @private
   */
  #calculateOverallHealth(partInfos) {
    if (partInfos.length === 0) {
      return 100;
    }

    let totalWeightedHealth = 0;
    let totalWeight = 0;

    for (const part of partInfos) {
      const weight = this.#getPartWeight(part);
      totalWeightedHealth += part.healthPercentage * weight;
      totalWeight += weight;
    }

    if (totalWeight === 0) {
      return 100;
    }

    let calculatedHealth = Math.round(totalWeightedHealth / totalWeight);

    // Apply data-driven vital organ caps
    for (const part of partInfos) {
      if (part.vitalOrganCap) {
        const { threshold, capValue } = part.vitalOrganCap;
        if (part.healthPercentage <= threshold) {
          calculatedHealth = Math.min(calculatedHealth, capValue);
        }
      }
    }

    return calculatedHealth;
  }

  /**
   * Gets weight for health calculation from part info.
   *
   * @param {Object} partInfo - Part info object with healthCalculationWeight
   * @returns {number} Weight value (defaults to 1 if not specified)
   * @private
   */
  #getPartWeight(partInfo) {
    const weight = partInfo.healthCalculationWeight;
    return typeof weight === 'number' && weight >= 0 ? weight : 1;
  }
}

export default InjuryAggregationService;
