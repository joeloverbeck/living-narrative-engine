/**
 * @file OxygenAggregationService - Aggregates oxygen data from all respiratory organs.
 * @see specs/oxygen-bar-physical-condition-panel.md
 */

import { BaseService } from '../../utils/serviceBase.js';
import {
  RESPIRATORY_ORGAN_COMPONENT_ID,
  ANATOMY_PART_COMPONENT_ID,
} from '../../constants/componentIds.js';

/**
 * @typedef {object} OxygenSummaryDTO
 * @property {string} entityId - Owner entity ID
 * @property {number} totalCurrentOxygen - Sum of currentOxygen from all organs
 * @property {number} totalOxygenCapacity - Sum of oxygenCapacity from all organs
 * @property {number} percentage - Calculated percentage (0-100, clamped)
 * @property {number} organCount - Number of respiratory organs found
 * @property {boolean} hasRespiratoryOrgans - True if at least one organ exists
 */

/**
 * Service that aggregates oxygen data from all respiratory organs belonging to an entity.
 *
 * @augments BaseService
 */
class OxygenAggregationService extends BaseService {
  /** @type {import('../../interfaces/coreServices.js').ILogger} */
  #logger;

  /** @type {import('../../entities/entityManager.js').default} */
  #entityManager;

  /**
   * Creates a new OxygenAggregationService instance.
   *
   * @param {object} dependencies - The service dependencies
   * @param {import('../../interfaces/coreServices.js').ILogger} dependencies.logger - Logger instance
   * @param {import('../../entities/entityManager.js').default} dependencies.entityManager - Entity manager for component access
   */
  constructor({ logger, entityManager }) {
    super();
    this.#logger = this._init('OxygenAggregationService', logger, {
      entityManager: {
        value: entityManager,
        requiredMethods: [
          'getComponentData',
          'hasComponent',
          'getEntitiesWithComponent',
        ],
      },
    });
    this.#entityManager = entityManager;
  }

  /**
   * Aggregates oxygen data from all respiratory organs belonging to an entity.
   *
   * @param {string} entityId - The entity to aggregate oxygen for
   * @returns {OxygenSummaryDTO|null} Oxygen summary or null if no respiratory organs
   */
  aggregateOxygen(entityId) {
    this.#logger.debug(`Aggregating oxygen for entity: ${entityId}`);

    const organs = this.#findRespiratoryOrgans(entityId);

    if (organs.length === 0) {
      this.#logger.debug(
        `No respiratory organs found for entity: ${entityId}`
      );
      return null;
    }

    let totalCurrentOxygen = 0;
    let totalOxygenCapacity = 0;

    for (const { organData } of organs) {
      const currentOxygen = this.#getSafeNumber(organData.currentOxygen, 0);
      const oxygenCapacity = this.#getSafeNumber(organData.oxygenCapacity, 1);

      totalCurrentOxygen += currentOxygen;
      totalOxygenCapacity += oxygenCapacity;
    }

    const percentage = this.#calculatePercentage(
      totalCurrentOxygen,
      totalOxygenCapacity
    );

    /** @type {OxygenSummaryDTO} */
    const summary = {
      entityId,
      totalCurrentOxygen,
      totalOxygenCapacity,
      percentage,
      organCount: organs.length,
      hasRespiratoryOrgans: true,
    };

    this.#logger.debug(
      `Oxygen aggregation complete for ${entityId}: ${organs.length} organs, ${percentage}%`
    );

    return summary;
  }

  /**
   * Finds all respiratory organs belonging to an entity.
   *
   * @param {string} targetEntityId - Entity ID to find organs for
   * @returns {Array<{organEntityId: string, organData: object}>} Array of organ info
   * @private
   */
  #findRespiratoryOrgans(targetEntityId) {
    const organs = [];

    try {
      const entitiesWithOrgan = this.#entityManager.getEntitiesWithComponent(
        RESPIRATORY_ORGAN_COMPONENT_ID
      );

      for (const entity of entitiesWithOrgan) {
        const organEntityId = entity.id;

        if (
          !this.#entityManager.hasComponent(
            organEntityId,
            ANATOMY_PART_COMPONENT_ID
          )
        ) {
          continue;
        }

        const partComponent = this.#entityManager.getComponentData(
          organEntityId,
          ANATOMY_PART_COMPONENT_ID
        );

        // Skip organs with missing ownerEntityId
        if (!partComponent?.ownerEntityId) {
          this.#logger.debug(
            `Skipping organ ${organEntityId}: missing ownerEntityId`
          );
          continue;
        }

        if (partComponent.ownerEntityId !== targetEntityId) {
          continue;
        }

        const organData = this.#entityManager.getComponentData(
          organEntityId,
          RESPIRATORY_ORGAN_COMPONENT_ID
        );

        if (organData) {
          organs.push({ organEntityId, organData });
        }
      }
    } catch (err) {
      this.#logger.warn(
        `Failed to find respiratory organs for entity ${targetEntityId}: ${err.message}`
      );
    }

    return organs;
  }

  /**
   * Calculates percentage from current and capacity values.
   *
   * @param {number} current - Current oxygen total
   * @param {number} capacity - Total capacity
   * @returns {number} Percentage (0-100, clamped)
   * @private
   */
  #calculatePercentage(current, capacity) {
    if (capacity <= 0) {
      return 0;
    }
    const raw = (current / capacity) * 100;
    return Math.round(Math.max(0, Math.min(100, raw)));
  }

  /**
   * Gets a safe number value with fallback.
   *
   * @param {unknown} value - Value to check
   * @param {number} fallback - Fallback value if not a valid number
   * @returns {number} Safe number value
   * @private
   */
  #getSafeNumber(value, fallback) {
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value;
    }
    return fallback;
  }
}

export default OxygenAggregationService;
