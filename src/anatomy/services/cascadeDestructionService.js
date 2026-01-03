/**
 * @file CascadeDestructionService - Handles cascading destruction of child body parts.
 */

import { BaseService } from '../../utils/serviceBase.js';
import {
  ANATOMY_PART_COMPONENT_ID,
  ANATOMY_PART_HEALTH_COMPONENT_ID,
  ANATOMY_VITAL_ORGAN_COMPONENT_ID,
} from '../../constants/componentIds.js';
import {
  CASCADE_DESTRUCTION_EVENT_ID,
  PART_DESTROYED_EVENT_ID,
} from '../constants/anatomyConstants.js';
import { calculateStateFromPercentage } from '../registries/healthStateRegistry.js';

/**
 * @typedef {object} CascadeDestructionResult
 * @property {string[]} destroyedPartIds - IDs of parts destroyed by the cascade.
 * @property {object[]} destroyedParts - Metadata about destroyed parts.
 * @property {boolean} vitalOrganDestroyed - True if a vital organ was destroyed.
 */

/**
 * Service that handles cascading destruction of body part descendants.
 *
 * @augments BaseService
 */
class CascadeDestructionService extends BaseService {
  /** @type {import('../../interfaces/coreServices.js').ILogger} */
  #logger;

  /** @type {import('../../entities/entityManager.js').default} */
  #entityManager;

  /** @type {import('../bodyGraphService.js').default} */
  #bodyGraphService;

  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */
  #dispatcher;

  /**
   * Create a CascadeDestructionService.
   *
   * @param {object} deps - Constructor dependencies.
   * @param {import('../../interfaces/coreServices.js').ILogger} deps.logger - Logger instance.
   * @param {import('../../entities/entityManager.js').default} deps.entityManager - Entity manager access.
   * @param {import('../bodyGraphService.js').default} deps.bodyGraphService - Body graph traversal.
   * @param {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} deps.safeEventDispatcher - Event dispatcher.
   */
  constructor({ logger, entityManager, bodyGraphService, safeEventDispatcher }) {
    super();
    this.#logger = this._init('CascadeDestructionService', logger, {
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData', 'hasComponent', 'addComponent'],
      },
      bodyGraphService: {
        value: bodyGraphService,
        requiredMethods: ['getAllDescendants'],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
    });
    this.#entityManager = entityManager;
    this.#bodyGraphService = bodyGraphService;
    this.#dispatcher = safeEventDispatcher;
  }

  /**
   * Execute cascading destruction for descendants of a destroyed part.
   *
   * @param {string} destroyedPartId - Part that was destroyed.
   * @param {string} ownerEntityId - Entity that owns the parts.
   * @param {object} [options] - Optional behavior overrides.
   * @param {boolean} [options.suppressEvents] - Skip event dispatching.
   * @returns {Promise<CascadeDestructionResult>} Cascade destruction summary.
   */
  async executeCascade(destroyedPartId, ownerEntityId, options = {}) {
    const { suppressEvents = false } = options;

    if (!destroyedPartId || !ownerEntityId) {
      this.#logger.warn(
        'CascadeDestructionService: Missing destroyedPartId or ownerEntityId.',
        { destroyedPartId, ownerEntityId }
      );
      return {
        destroyedPartIds: [],
        destroyedParts: [],
        vitalOrganDestroyed: false,
      };
    }

    const descendants =
      this.#bodyGraphService.getAllDescendants(destroyedPartId) || [];
    if (!descendants.length) {
      return {
        destroyedPartIds: [],
        destroyedParts: [],
        vitalOrganDestroyed: false,
      };
    }

    /** @type {string[]} */
    const destroyedPartIds = [];
    /** @type {object[]} */
    const destroyedParts = [];
    let vitalOrganDestroyed = false;

    for (const partId of descendants) {
      if (
        !this.#entityManager.hasComponent(
          partId,
          ANATOMY_PART_HEALTH_COMPONENT_ID
        )
      ) {
        this.#logger.debug(
          `CascadeDestructionService: Skipping part ${partId} (no health component).`
        );
        continue;
      }

      const partHealth = this.#entityManager.getComponentData(
        partId,
        ANATOMY_PART_HEALTH_COMPONENT_ID
      );
      const currentHealth = Number(partHealth?.currentHealth ?? 0);
      if (currentHealth <= 0) {
        continue;
      }

      const previousState = partHealth?.state;
      const previousTurns = Number(partHealth?.turnsInState ?? 0);
      const newState = calculateStateFromPercentage(0);
      const turnsInState =
        previousState === newState ? previousTurns + 1 : 0;

      await this.#entityManager.addComponent(
        partId,
        ANATOMY_PART_HEALTH_COMPONENT_ID,
        {
          ...partHealth,
          currentHealth: 0,
          state: newState,
          turnsInState,
        }
      );

      if (!suppressEvents) {
        this.#dispatcher.dispatch(PART_DESTROYED_EVENT_ID, {
          entityId: ownerEntityId,
          partId,
          timestamp: Date.now(),
        });
      }

      const partComponent = this.#entityManager.hasComponent(
        partId,
        ANATOMY_PART_COMPONENT_ID
      )
        ? this.#entityManager.getComponentData(
            partId,
            ANATOMY_PART_COMPONENT_ID
          )
        : null;

      const partInfo = {
        partEntityId: partId,
        partType: partComponent?.subType || partComponent?.type || 'unknown',
        orientation: partComponent?.orientation ?? null,
        previousHealth: currentHealth,
        maxHealth: partHealth?.maxHealth ?? null,
      };

      destroyedPartIds.push(partId);
      destroyedParts.push(partInfo);

      if (
        !vitalOrganDestroyed &&
        this.#entityManager.hasComponent(
          partId,
          ANATOMY_VITAL_ORGAN_COMPONENT_ID
        )
      ) {
        vitalOrganDestroyed = true;
      }
    }

    if (destroyedPartIds.length > 0 && !suppressEvents) {
      this.#dispatcher.dispatch(CASCADE_DESTRUCTION_EVENT_ID, {
        entityId: ownerEntityId,
        cascadedFrom: destroyedPartId,
        destroyedPartIds,
        destroyedParts,
        vitalOrganDestroyed,
        timestamp: Date.now(),
      });
    }

    return {
      destroyedPartIds,
      destroyedParts,
      vitalOrganDestroyed,
    };
  }
}

export default CascadeDestructionService;
