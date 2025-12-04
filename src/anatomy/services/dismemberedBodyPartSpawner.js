/**
 * @file DismemberedBodyPartSpawner service
 * Listens to anatomy:dismembered events and spawns pickable body part entities
 * at the affected character's location.
 */

import { BaseService } from '../../utils/serviceBase.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../constants/componentIds.js';

// --- Component ID Constants ---
const ANATOMY_PART_COMPONENT_ID = 'anatomy:part';
const ITEMS_ITEM_COMPONENT_ID = 'items:item';
const ITEMS_PORTABLE_COMPONENT_ID = 'items:portable';
const ITEMS_WEIGHT_COMPONENT_ID = 'items:weight';

// --- Event ID Constants ---
const DISMEMBERED_EVENT_ID = 'anatomy:dismembered';
const BODY_PART_SPAWNED_EVENT_ID = 'anatomy:body_part_spawned';

// --- Default Values ---
const DEFAULT_WEIGHT_KG = 1.0;

/**
 * Service that listens to anatomy:dismembered events and spawns pickable
 * body part entities at the affected character's location.
 *
 * @augments BaseService
 */
class DismemberedBodyPartSpawner extends BaseService {
  /** @type {import('../../interfaces/coreServices.js').ILogger} */
  #logger;

  /** @type {import('../../entities/entityManager.js').default} */
  #entityManager;

  /** @type {import('../../events/safeEventDispatcher.js').default} */
  #eventBus;

  /** @type {import('../../entities/services/entityLifecycleManager.js').default} */
  #entityLifecycleManager;

  /** @type {Function|null} */
  #unsubscribe;

  /**
   * Creates a new DismemberedBodyPartSpawner instance.
   *
   * @param {object} dependencies - The service dependencies
   * @param {import('../../interfaces/coreServices.js').ILogger} dependencies.logger - Logger instance
   * @param {import('../../entities/entityManager.js').default} dependencies.entityManager - Entity manager for component access
   * @param {import('../../events/safeEventDispatcher.js').default} dependencies.eventBus - Event bus for subscribing and dispatching
   * @param {import('../../entities/services/entityLifecycleManager.js').default} dependencies.entityLifecycleManager - Entity lifecycle manager for creating entities
   */
  constructor({ logger, entityManager, eventBus, entityLifecycleManager }) {
    super();
    this.#logger = this._init('DismemberedBodyPartSpawner', logger, {
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData'],
      },
      eventBus: {
        value: eventBus,
        requiredMethods: ['subscribe', 'dispatch'],
      },
      entityLifecycleManager: {
        value: entityLifecycleManager,
        requiredMethods: ['createEntityInstance'],
      },
    });

    this.#entityManager = entityManager;
    this.#eventBus = eventBus;
    this.#entityLifecycleManager = entityLifecycleManager;
    this.#unsubscribe = null;
  }

  /**
   * Initializes the service by subscribing to dismembered events.
   */
  initialize() {
    this.#unsubscribe = this.#eventBus.subscribe(
      DISMEMBERED_EVENT_ID,
      this.#handleDismemberment.bind(this)
    );
    this.#logger.info('DismemberedBodyPartSpawner initialized');
  }

  /**
   * Destroys the service by unsubscribing from events.
   */
  destroy() {
    if (this.#unsubscribe) {
      this.#unsubscribe();
      this.#unsubscribe = null;
    }
  }

  /**
   * Handles the anatomy:dismembered event by spawning a pickable body part entity.
   *
   * @param {object} event - The event object from the event bus
   * @param {string} event.type - The event type ('anatomy:dismembered')
   * @param {object} event.payload - The event payload
   * @param {string} event.payload.entityId - The character entity ID
   * @param {string} event.payload.partId - The dismembered body part entity ID
   * @param {string|null} [event.payload.partType] - Type of body part (e.g., 'arm', 'leg')
   * @param {string|null} [event.payload.orientation] - Orientation of the part (e.g., 'left', 'right')
   * @private
   */
  async #handleDismemberment({ payload }) {
    const { entityId, partId, partType, orientation } = payload;

    this.#logger.debug(
      `Handling dismemberment: entity=${entityId}, part=${partId}, type=${partType}, orientation=${orientation}`
    );

    try {
      // 1. Get the dismembered part's anatomy:part component to retrieve definitionId
      const partData = this.#entityManager.getComponentData(
        partId,
        ANATOMY_PART_COMPONENT_ID
      );

      if (!partData?.definitionId) {
        this.#logger.error(
          `Cannot spawn body part: missing definitionId for part ${partId}`
        );
        return;
      }

      const { definitionId } = partData;

      // 2. Get character's position to spawn at the same location
      const positionData = this.#entityManager.getComponentData(
        entityId,
        POSITION_COMPONENT_ID
      );

      if (!positionData?.locationId) {
        this.#logger.warn(
          `Cannot spawn body part: missing position for character ${entityId}`
        );
        return;
      }

      const { locationId } = positionData;

      // 3. Get character's name for the spawned entity name
      const characterName = this.#getEntityName(entityId);

      // 4. Generate the spawned entity name
      const spawnedEntityName = this.#generateSpawnedEntityName(
        characterName,
        orientation,
        partType
      );

      // 5. Get weight from definition or use default
      const weight = this.#getWeightForDefinition(definitionId, partData);

      // 6. Create the new entity with component overrides
      const componentOverrides = {
        [NAME_COMPONENT_ID]: { text: spawnedEntityName },
        [ITEMS_ITEM_COMPONENT_ID]: {},
        [ITEMS_PORTABLE_COMPONENT_ID]: {},
        [ITEMS_WEIGHT_COMPONENT_ID]: { weight },
        [POSITION_COMPONENT_ID]: { locationId },
      };

      const spawnedEntity = await this.#entityLifecycleManager.createEntityInstance(
        definitionId,
        { componentOverrides }
      );

      this.#logger.info(
        `Spawned body part entity: ${spawnedEntity.id} (${spawnedEntityName}) at ${locationId}`
      );

      // 7. Dispatch the body_part_spawned event
      this.#eventBus.dispatch(BODY_PART_SPAWNED_EVENT_ID, {
        entityId,
        entityName: characterName,
        spawnedEntityId: spawnedEntity.id,
        spawnedEntityName,
        partType: partType || 'unknown',
        orientation: orientation || null,
        definitionId,
        timestamp: Date.now(),
      });
    } catch (err) {
      this.#logger.error(
        `Failed to spawn body part for dismemberment event: ${err.message}`,
        err
      );
    }
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
   * Generates the display name for the spawned body part entity.
   *
   * @param {string} characterName - The character's name
   * @param {string|null} orientation - The part orientation (left, right, mid, or null)
   * @param {string|null} partType - The part type (arm, leg, head, etc.)
   * @returns {string} The formatted name (e.g., "Sarah's left leg")
   * @private
   */
  #generateSpawnedEntityName(characterName, orientation, partType) {
    const parts = [characterName + "'s"];
    if (orientation && orientation !== 'mid') {
      parts.push(orientation);
    }
    parts.push(partType || 'body part');
    return parts.join(' ');
  }

  /**
   * Gets the weight value from the part data or returns the default.
   *
   * @param {string} definitionId - The entity definition ID
   * @param {object} partData - The anatomy:part component data
   * @returns {number} The weight in kg
   * @private
   */
  #getWeightForDefinition(definitionId, partData) {
    // Check if the part data has weight information
    if (partData.weight !== undefined && partData.weight !== null) {
      return partData.weight;
    }

    this.#logger.warn(
      `Missing weight for ${definitionId}, using default ${DEFAULT_WEIGHT_KG} kg`
    );
    return DEFAULT_WEIGHT_KG;
  }
}

export default DismemberedBodyPartSpawner;
