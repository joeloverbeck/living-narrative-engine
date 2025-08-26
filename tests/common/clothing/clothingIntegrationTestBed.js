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
    this.container = null;
    this.actionService = null;
    this.eventBus = null;
    this.systemLogicInterpreter = null;
  }

  /**
   * Set up the test bed with necessary services
   */
  async setup() {
    await super.setup();

    // Enhance eventDispatcher with subscribe functionality
    const subscribers = new Map();
    this.eventDispatcher.subscribe = jest.fn((eventType, callback) => {
      if (!subscribers.has(eventType)) {
        subscribers.set(eventType, []);
      }
      subscribers.get(eventType).push(callback);
      return () => {
        const callbacks = subscribers.get(eventType);
        if (callbacks) {
          const index = callbacks.indexOf(callback);
          if (index > -1) {
            callbacks.splice(index, 1);
          }
        }
      };
    });

    // Override dispatch to call subscribers
    const originalDispatch = this.eventDispatcher.dispatch;
    this.eventDispatcher.dispatch = jest.fn((eventType, payload) => {
      const callbacks = subscribers.get(eventType);
      if (callbacks) {
        callbacks.forEach((callback) => callback(payload));
      }
      return originalDispatch.call(this.eventDispatcher, eventType, payload);
    });

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

    // Create a mock container with resolve method
    this.container = {
      resolve: (serviceName) => {
        // Mock UnequipClothingHandler
        if (serviceName === 'UnequipClothingHandler') {
          return {
            execute: jest.fn().mockImplementation(async (params, context) => {
              const {
                entity_ref,
                clothing_item_id,
                destination = 'inventory',
                cascade_unequip = false,
              } = params;

              // Get entity ID from context or use entity_ref
              const entityId =
                context?.evaluationContext?.actor?.id ||
                context?.actorId ||
                entity_ref;
              let itemFound = false;

              // Check if clothing item actually exists as an entity
              const clothingItemEntity =
                this.entityManager.entities.get(clothing_item_id);
              if (!clothingItemEntity) {
                // Item doesn't exist, just return false without doing anything
                return false;
              }

              // Get current equipment
              const equipment = this.entityManager.getComponentData(
                entityId,
                'clothing:equipment'
              );
              if (equipment && equipment.equipped) {
                // Find and remove the item from equipment
                Object.keys(equipment.equipped).forEach((slot) => {
                  if (equipment.equipped[slot] === clothing_item_id) {
                    delete equipment.equipped[slot];
                    itemFound = true;
                  } else if (Array.isArray(equipment.equipped[slot])) {
                    const index =
                      equipment.equipped[slot].indexOf(clothing_item_id);
                    if (index > -1) {
                      itemFound = true;
                      if (cascade_unequip) {
                        // For cascade, remove from the found index backward to base layers (index 0)
                        equipment.equipped[slot].splice(0, index + 1);
                        if (equipment.equipped[slot].length === 0) {
                          delete equipment.equipped[slot];
                        }
                      } else {
                        // Remove only the specific item
                        equipment.equipped[slot].splice(index, 1);
                        if (equipment.equipped[slot].length === 0) {
                          delete equipment.equipped[slot];
                        }
                      }
                    }
                  }
                });

                // Only update if item was found and removed
                if (itemFound) {
                  this.entityManager.setComponentData(
                    entityId,
                    'clothing:equipment',
                    equipment
                  );
                }
              }

              // Handle item placement only if item was found
              if (itemFound) {
                if (destination === 'inventory') {
                  const inventory = this.entityManager.getComponentData(
                    entityId,
                    'core:inventory'
                  );
                  if (inventory && inventory.items) {
                    inventory.items.push(clothing_item_id);
                    this.entityManager.setComponentData(
                      entityId,
                      'core:inventory',
                      inventory
                    );
                  }
                } else if (destination === 'ground') {
                  const entityPosition = this.entityManager.getComponentData(
                    entityId,
                    'core:position'
                  );
                  if (entityPosition) {
                    this.entityManager.setComponentData(
                      clothing_item_id,
                      'core:position',
                      {
                        locationId: entityPosition.locationId,
                      }
                    );

                    // Dispatch entity moved event
                    this.eventDispatcher.dispatch('core:entity_moved', {
                      entityId: clothing_item_id,
                      locationId: entityPosition.locationId,
                    });
                  }
                }

                // Dispatch unequipped event
                this.eventDispatcher.dispatch('clothing:unequipped', {
                  entityId: entityId,
                  clothingItemId: clothing_item_id,
                  reason: 'manual',
                });
                return true;
              }

              return false;
            }),
          };
        }

        // Mock EquipmentOrchestrator
        if (serviceName === 'EquipmentOrchestrator') {
          return {
            orchestrateUnequipment: jest
              .fn()
              .mockImplementation(
                async (entityId, clothingItemId, destination) => {
                  return {
                    success: true,
                    reason: 'manual',
                    destination: destination || 'inventory',
                  };
                }
              ),
            orchestrateEquipment: jest
              .fn()
              .mockResolvedValue({ success: true }),
            validateEquipmentCompatibility: jest
              .fn()
              .mockResolvedValue({ valid: true }),
          };
        }

        // Mock SpatialIndexSynchronizer
        if (serviceName === 'SpatialIndexSynchronizer') {
          return {
            onPositionChanged: jest.fn().mockImplementation((event) => {
              // Validate entity ID and log warning if invalid
              if (
                !event.entity ||
                !event.entity.id ||
                event.entity.id === '' ||
                event.entity.id === null
              ) {
                this.logger.warn(
                  'SpatialIndexSynchronizer.onPositionChanged: Invalid entity ID',
                  {
                    entity: event.entity,
                    componentTypeId: event.componentTypeId,
                  }
                );
                return;
              }
              // Normal processing would happen here
            }),
            onEntityCreated: jest.fn(),
            onEntityDestroyed: jest.fn(),
          };
        }

        return null;
      },
    };
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

  /**
   * Create mock body part description builder
   *
   * @returns {object} Mock builder
   */
  createMockBodyPartDescriptionBuilder() {
    return {
      buildPartDescription: jest
        .fn()
        .mockReturnValue('test body part description'),
      buildDescriptionFromParts: jest
        .fn()
        .mockReturnValue('full body description'),
    };
  }

  /**
   * Create mock part description generator
   *
   * @returns {object} Mock generator
   */
  createMockPartDescriptionGenerator() {
    return {
      generatePartDescriptions: jest
        .fn()
        .mockResolvedValue([
          'head description',
          'torso description',
          'legs description',
        ]),
      generateSinglePartDescription: jest
        .fn()
        .mockResolvedValue('single part description'),
    };
  }

  /**
   * Wait for event processing to complete
   * Simulates async event processing in tests
   *
   * @returns {Promise<void>}
   */
  async waitForEventProcessing() {
    // Allow event loop to process
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Flush any pending promises
    await Promise.resolve();
  }

  /**
   * Get the action service
   *
   * @returns {object} Action service
   */
  getActionService() {
    if (!this.actionService) {
      // Create a mock action service for testing
      this.actionService = {
        getActionsForEntity: jest.fn().mockImplementation(async (entityId) => {
          const actions = [];

          // Get entity's equipment
          const equipment = this.entityManager.getComponentData(
            entityId,
            'clothing:equipment'
          );
          if (equipment && equipment.equipped) {
            // Generate remove clothing actions for each equipped item
            Object.entries(equipment.equipped).forEach(([slot, itemId]) => {
              if (typeof itemId === 'string') {
                // Single item in slot
                actions.push({
                  id: 'clothing:remove_clothing',
                  name: 'Remove Clothing',
                  targetId: itemId,
                  description: `Remove ${itemId}`,
                });
              } else if (Array.isArray(itemId)) {
                // Multiple items in slot - only show topmost (last in array)
                const topmostItem = itemId[itemId.length - 1];
                actions.push({
                  id: 'clothing:remove_clothing',
                  name: 'Remove Clothing',
                  targetId: topmostItem,
                  description: `Remove ${topmostItem}`,
                });
              }
            });
          }

          return actions;
        }),
      };
    }
    return this.actionService;
  }

  /**
   * Get the entity manager
   *
   * @returns {object} Entity manager
   */
  getEntityManager() {
    return this.entityManager;
  }

  /**
   * Get the event bus
   *
   * @returns {object} Event bus
   */
  getEventBus() {
    if (!this.eventBus) {
      // Create a mock event bus for testing
      this.eventBus = {
        on: jest.fn(),
        emit: jest.fn().mockResolvedValue(true),
        dispatch: jest.fn().mockResolvedValue(true),
      };
    }
    return this.eventBus;
  }

  /**
   * Get the system logic interpreter
   *
   * @returns {object} System logic interpreter
   */
  getSystemLogicInterpreter() {
    if (!this.systemLogicInterpreter) {
      // Create a mock system logic interpreter for testing
      const executedOperations = [];
      const listeners = [];

      this.systemLogicInterpreter = {
        processGameEvent: jest.fn().mockResolvedValue(true),
        executedOperations, // Track executed operations
        on: jest.fn((event, callback) => {
          if (event === 'operationExecuted') {
            listeners.push(callback);
          }
        }),
        // Helper to simulate operation execution
        simulateOperation: (op) => {
          executedOperations.push(op);
          listeners.forEach((cb) => cb(op));
        },
        // Helper to reset tracking
        resetOperations: () => {
          executedOperations.length = 0;
        },
      };
    }
    return this.systemLogicInterpreter;
  }
}

export default ClothingIntegrationTestBed;
