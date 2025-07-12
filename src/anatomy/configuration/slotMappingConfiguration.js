/**
 * @file Centralized slot mapping configuration service
 * Bridges anatomy blueprint slots and clothing equipment slots
 */

import { BaseService } from '../../utils/serviceBase.js';
import {
  assertNonBlankString,
  assertPresent,
} from '../../utils/dependencyUtils.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * Slot mapping definition
 *
 * @typedef {object} SlotMapping
 * @property {string[]} [anatomySlots] - Blueprint slot IDs this clothing slot maps to
 * @property {string[]} [anatomySockets] - Direct socket IDs for fine-grained control
 * @property {number} priority - Resolution priority when multiple mappings exist
 */

/**
 * Centralized slot mapping configuration service
 * Bridges anatomy blueprint slots and clothing equipment slots
 */
export class SlotMappingConfiguration extends BaseService {
  /** @type {ILogger} */
  #logger;
  /** @type {IDataRegistry} */
  #dataRegistry;
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {Map<string, SlotMapping>} */
  #mappingCache = new Map();
  /** @type {Map<string, Map<string, string>>} */
  #slotEntityMappingCache = new Map();

  /**
   * Creates an instance of SlotMappingConfiguration
   *
   * @param {object} deps - Constructor dependencies
   * @param {ILogger} deps.logger - Logger instance
   * @param {IDataRegistry} deps.dataRegistry - Data registry for accessing loaded content
   * @param {IEntityManager} deps.entityManager - Entity manager for entity operations
   */
  constructor({ logger, dataRegistry, entityManager }) {
    super();

    this.#logger = this._init('SlotMappingConfiguration', logger, {
      dataRegistry: {
        value: dataRegistry,
        requiredMethods: ['get'],
      },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getEntityInstance'],
      },
    });

    this.#dataRegistry = dataRegistry;
    this.#entityManager = entityManager;
  }

  /**
   * Resolves clothing slot to anatomy attachment points using explicit mappings
   * Replaces hardcoded assumptions about slot naming
   *
   * @param {string} blueprintId - The blueprint ID to resolve mappings for
   * @param {string} clothingSlotId - The clothing slot ID to resolve
   * @returns {Promise<SlotMapping|null>} The slot mapping configuration or null if not found
   */
  async resolveSlotMapping(blueprintId, clothingSlotId) {
    assertNonBlankString(
      blueprintId,
      'blueprintId',
      'resolveSlotMapping',
      this.#logger
    );
    assertNonBlankString(
      clothingSlotId,
      'clothingSlotId',
      'resolveSlotMapping',
      this.#logger
    );

    const cacheKey = `${blueprintId}:${clothingSlotId}`;
    if (this.#mappingCache.has(cacheKey)) {
      return this.#mappingCache.get(cacheKey);
    }

    try {
      // Load slot mappings configuration
      const slotMappings = await this.#loadSlotMappingsConfig();
      
      // Find mapping for the requested clothing slot
      const mapping = slotMappings.mappings?.[clothingSlotId];
      
      if (!mapping) {
        this.#logger.debug(
          `No slot mapping found for clothing slot '${clothingSlotId}' in blueprint '${blueprintId}'`
        );
        return null;
      }

      // Cache the result
      this.#mappingCache.set(cacheKey, mapping);
      
      this.#logger.debug(
        `Resolved slot mapping for '${clothingSlotId}': ${JSON.stringify(mapping)}`
      );

      return mapping;
    } catch (error) {
      this.#logger.error(
        `Failed to resolve slot mapping for blueprint '${blueprintId}' and slot '${clothingSlotId}'`,
        error
      );
      throw error;
    }
  }

  /**
   * Gets explicit slot-to-entity mappings from anatomy generation results
   * Eliminates 'slotId + _part' hardcoded pattern
   *
   * @param {string} entityId - The root entity ID whose anatomy was generated
   * @returns {Promise<Map<string, string>>} Map of slot IDs to entity IDs
   */
  async getSlotEntityMappings(entityId) {
    assertNonBlankString(
      entityId,
      'entityId',
      'getSlotEntityMappings',
      this.#logger
    );

    if (this.#slotEntityMappingCache.has(entityId)) {
      return this.#slotEntityMappingCache.get(entityId);
    }

    try {
      const mappings = new Map();
      
      // Get the root entity
      const rootEntity = this.#entityManager.getEntityInstance(entityId);
      if (!rootEntity) {
        this.#logger.warn(`Root entity '${entityId}' not found`);
        return mappings;
      }

      // Check if the entity has anatomy body component with slot mappings
      if (rootEntity.hasComponent('anatomy:body')) {
        const bodyComponent = rootEntity.getComponentData('anatomy:body');
        
        // Look for stored slot entity mappings in the body component
        if (bodyComponent?.slotEntityMappings) {
          for (const [slotId, mappedEntityId] of Object.entries(bodyComponent.slotEntityMappings)) {
            mappings.set(slotId, mappedEntityId);
          }
        }
      }

      // Cache the result
      this.#slotEntityMappingCache.set(entityId, mappings);
      
      this.#logger.debug(
        `Retrieved ${mappings.size} slot entity mappings for entity '${entityId}'`
      );

      return mappings;
    } catch (error) {
      this.#logger.error(
        `Failed to get slot entity mappings for entity '${entityId}'`,
        error
      );
      throw error;
    }
  }

  /**
   * Loads the slot mappings configuration from the data registry
   *
   * @private
   * @returns {Promise<object>} The slot mappings configuration
   */
  async #loadSlotMappingsConfig() {
    // For now, return the default configuration
    // In the future, this could be loaded from the file system or data registry
    return {
      mappings: {
        torso_clothing: {
          anatomySlots: ['torso_upper', 'torso_lower'],
          priority: 1,
        },
        left_arm_clothing: {
          anatomySlots: ['left_arm'],
          priority: 1,
        },
        right_arm_clothing: {
          anatomySlots: ['right_arm'],
          priority: 1,
        },
        full_body_clothing: {
          anatomySlots: ['torso_upper', 'torso_lower', 'left_arm', 'right_arm'],
          priority: 2,
        },
      },
    };
  }

  /**
   * Clears all caches
   */
  clearCache() {
    this.#mappingCache.clear();
    this.#slotEntityMappingCache.clear();
    this.#logger.debug('Slot mapping caches cleared');
  }
}

export default SlotMappingConfiguration;