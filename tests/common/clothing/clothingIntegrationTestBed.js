/**
 * @file Test bed for clothing integration tests
 * Provides utilities for setting up clothing-related test scenarios
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseTestBed } from '../baseTestBed.js';
import EquipmentDescriptionService from '../../../src/clothing/services/equipmentDescriptionService.js';
import { ClothingManagementService } from '../../../src/clothing/services/clothingManagementService.js';
import { DescriptorFormatter } from '../../../src/anatomy/descriptorFormatter.js';

/**
 * Test bed for clothing integration tests
 */
export class ClothingIntegrationTestBed extends BaseTestBed {
  constructor() {
    super();
    this.services = new Map();
    this.createdEntities = [];
    this.createdItems = [];
  }

  /**
   * Set up the test bed with necessary services
   */
  async setup() {
    await super.setup();

    // Create descriptor formatter
    const descriptorFormatter = new DescriptorFormatter({
      logger: this.logger,
      anatomyFormattingService: this.createMockAnatomyFormattingService(),
    });

    // Create clothing management service
    const clothingManagementService = new ClothingManagementService({
      entityManager: this.entityManager,
      logger: this.logger,
      eventDispatcher: this.eventDispatcher,
      equipmentOrchestrator: this.createMockEquipmentOrchestrator(),
      anatomyBlueprintRepository: this.createMockAnatomyBlueprintRepository(),
      clothingSlotValidator: this.createMockClothingSlotValidator(),
      bodyGraphService: this.createMockBodyGraphService(),
      anatomyClothingCache: this.createMockAnatomyClothingCache(),
    });

    // Create equipment description service
    const equipmentDescriptionService = new EquipmentDescriptionService({
      logger: this.logger,
      entityManager: this.entityManager,
      descriptorFormatter: descriptorFormatter,
      clothingManagementService: clothingManagementService,
      anatomyFormattingService: this.createMockAnatomyFormattingService(),
    });

    // Store services
    this.services.set('clothingManagementService', clothingManagementService);
    this.services.set(
      'equipmentDescriptionService',
      equipmentDescriptionService
    );
    this.services.set('descriptorFormatter', descriptorFormatter);
  }

  /**
   * Get a service by name
   *
   * @param {string} serviceName - Name of the service to retrieve
   * @returns {object} Service instance
   */
  getService(serviceName) {
    return this.services.get(serviceName);
  }

  /**
   * Create a test entity with components
   *
   * @param {object} entityData - Entity data
   * @returns {Promise<string>} Entity ID
   */
  async createTestEntity(entityData) {
    const entityId = uuidv4();

    // Create entity instance
    const entity = {
      id: entityId,
      components: entityData.components || {},
      getComponentData: (componentId) => entity.components[componentId] || null,
      hasComponent: (componentId) => !!entity.components[componentId],
    };

    // Add to entity manager
    this.entityManager.entities.set(entityId, entity);

    // Set up component data
    for (const [componentId, componentData] of Object.entries(
      entityData.components || {}
    )) {
      this.entityManager.setComponentData(entityId, componentId, componentData);
    }

    this.createdEntities.push(entityId);
    return entityId;
  }

  /**
   * Create a clothing item entity
   *
   * @param {object} itemData - Item data
   * @returns {Promise<string>} Item ID
   */
  async createClothingItem(itemData) {
    const itemId = uuidv4();

    // Create item entity
    const item = {
      id: itemId,
      components: itemData.components || {},
      getComponentData: (componentId) => item.components[componentId] || null,
      hasComponent: (componentId) => !!item.components[componentId],
    };

    // Add to entity manager
    this.entityManager.entities.set(itemId, item);

    // Set up component data
    for (const [componentId, componentData] of Object.entries(
      itemData.components || {}
    )) {
      this.entityManager.setComponentData(itemId, componentId, componentData);
    }

    this.createdItems.push(itemId);
    return itemId;
  }

  /**
   * Equip a clothing item on an entity
   *
   * @param {string} entityId - Entity ID
   * @param {string} itemId - Item ID
   */
  async equipClothingItem(entityId, itemId) {
    // Get the item to determine slot and layer
    const item = this.entityManager.entities.get(itemId);
    if (!item) {
      throw new Error(`Item ${itemId} not found`);
    }

    const wearableData = item.components['clothing:wearable'];
    if (!wearableData) {
      throw new Error(`Item ${itemId} is not wearable`);
    }

    // Get existing equipment or create new
    const existingEquipment = this.entityManager.getComponentData(
      entityId,
      'clothing:equipment'
    ) || {
      equipped: {},
    };

    // Add item to equipment
    const slotId = wearableData.slotId;
    const layer = wearableData.layer || 'base';

    if (!existingEquipment.equipped[slotId]) {
      existingEquipment.equipped[slotId] = {};
    }

    existingEquipment.equipped[slotId][layer] = itemId;

    // Update equipment component
    this.entityManager.setComponentData(
      entityId,
      'clothing:equipment',
      existingEquipment
    );
  }

  /**
   * Clean up test resources
   */
  async cleanup() {
    // Clean up created entities
    for (const entityId of this.createdEntities) {
      this.entityManager.entities.delete(entityId);
    }

    for (const itemId of this.createdItems) {
      this.entityManager.entities.delete(itemId);
    }

    this.createdEntities = [];
    this.createdItems = [];
    this.services.clear();

    await super.cleanup();
  }

  /**
   * Create mock equipment orchestrator
   *
   * @returns {object} Mock orchestrator
   */
  createMockEquipmentOrchestrator() {
    return {
      orchestrateEquipment: async () => ({ success: true }),
      orchestrateUnequipment: async () => ({ success: true }),
      validateEquipmentCompatibility: async () => ({ valid: true }),
    };
  }

  /**
   * Create mock anatomy blueprint repository
   *
   * @returns {object} Mock repository
   */
  createMockAnatomyBlueprintRepository() {
    return {
      getBlueprintByRecipeId: async () => ({
        clothingSlotMappings: {
          torso_clothing: {
            blueprintSlots: ['torso'],
            allowedLayers: ['base', 'outer'],
          },
          feet_clothing: { blueprintSlots: ['feet'], allowedLayers: ['base'] },
          head_clothing: { blueprintSlots: ['head'], allowedLayers: ['base'] },
          jacket_clothing: {
            blueprintSlots: ['torso'],
            allowedLayers: ['outer'],
          },
        },
      }),
    };
  }

  /**
   * Create mock clothing slot validator
   *
   * @returns {object} Mock validator
   */
  createMockClothingSlotValidator() {
    return {
      validateSlotCompatibility: async () => ({ valid: true }),
    };
  }

  /**
   * Create mock body graph service
   *
   * @returns {object} Mock service
   */
  createMockBodyGraphService() {
    return {
      getBodyGraph: async () => ({
        getAllPartIds: () => ['test-root-id'],
      }),
      getAnatomyData: async () => ({}),
    };
  }

  /**
   * Create mock anatomy clothing cache
   *
   * @returns {object} Mock cache
   */
  createMockAnatomyClothingCache() {
    return {
      get: () => null,
      set: () => {},
      invalidateCacheForEntity: () => {},
    };
  }

  /**
   * Create mock anatomy formatting service
   *
   * @returns {object} Mock service
   */
  createMockAnatomyFormattingService() {
    return {
      getDescriptorOrder: () => [
        'core:material',
        'descriptors:color_basic',
        'descriptors:color_extended',
        'descriptors:texture',
        'descriptors:style',
        'descriptors:fit',
        'descriptors:condition',
      ],
      getDescriptorValueKeys: () => [
        'value',
        'material',
        'color',
        'texture',
        'style',
        'fit',
        'condition',
      ],
      getFormattingConfiguration: () => ({ separator: ', ' }),
      getEquipmentIntegrationConfig: () => ({
        enabled: true,
        prefix: 'Wearing: ',
        suffix: '.',
        separator: ', ',
        itemSeparator: ' | ',
        placement: 'after_anatomy',
      }),
    };
  }
}
