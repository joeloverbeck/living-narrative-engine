/**
 * @file Test bed for equipment description integration tests
 * @see tests/integration/clothing/equipmentNameResolution.integration.test.js
 */

import { BaseTestBed } from '../baseTestBed.js';
import EquipmentDescriptionService from '../../../src/clothing/services/equipmentDescriptionService.js';
import { DescriptorFormatter } from '../../../src/anatomy/descriptorFormatter.js';
import { ClothingManagementService } from '../../../src/clothing/services/clothingManagementService.js';
import { AnatomyFormattingService } from '../../../src/services/anatomyFormattingService.js';

/**
 * Test bed for equipment description integration tests
 */
export class EquipmentDescriptionIntegrationTestBed extends BaseTestBed {
  #equipmentDescriptionService;
  #descriptorFormatter;
  #clothingManagementService;
  #anatomyFormattingService;
  #warnings = [];

  constructor() {
    super();
    // Initialize basic services from BaseTestBed
    this._initializeBasicServices();
    this.#setupServices();
  }

  /**
   * Create an entity with the specified components
   *
   * @param {string} entityId - Entity ID
   * @param {object} components - Entity components
   */
  createEntity(entityId, components = {}) {
    const entity = {
      id: entityId,
      components: components,
      hasComponent: (componentId) => components.hasOwnProperty(componentId),
      getComponentData: (componentId) => components[componentId] || null,
    };
    this.entityManager.entities.set(entityId, entity);
    return entity;
  }

  #setupServices() {
    // Mock logger that captures warnings
    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      log: jest.fn(),
      warn: jest.fn().mockImplementation((msg) => {
        this.#warnings.push(msg);
      }),
      error: jest.fn().mockImplementation((msg) => {
        this.#warnings.push(msg);
      }),
    };

    // Create descriptor formatter with anatomy formatting service
    const anatomyFormattingService = {
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

    this.#anatomyFormattingService = anatomyFormattingService;

    this.#descriptorFormatter = new DescriptorFormatter({
      logger: mockLogger,
      anatomyFormattingService: anatomyFormattingService,
    });

    // Create clothing management service
    this.#clothingManagementService = new ClothingManagementService({
      logger: mockLogger,
      entityManager: this.entityManager,
      eventDispatcher: this.eventDispatcher,
      equipmentOrchestrator: {
        orchestrateEquipment: async () => ({ success: true }),
        orchestrateUnequipment: async () => ({ success: true }),
      },
      anatomyBlueprintRepository: {
        getBlueprintByRecipeId: async () => ({ clothingSlotMappings: {} }),
      },
      clothingSlotValidator: {
        validateSlotCompatibility: async () => ({ valid: true }),
      },
      bodyGraphService: {
        getBodyGraph: async () => ({ getAllPartIds: () => [] }),
      },
      anatomyClothingCache: {
        get: () => null,
        set: () => {},
        invalidateCacheForEntity: () => {},
      },
    });

    // Create equipment description service
    this.#equipmentDescriptionService = new EquipmentDescriptionService({
      logger: mockLogger,
      entityManager: this.entityManager,
      descriptorFormatter: this.#descriptorFormatter,
      clothingManagementService: this.#clothingManagementService,
      anatomyFormattingService: this.#anatomyFormattingService,
    });
  }

  /**
   * Create a character entity with equipment
   *
   * @param {string} characterId - Character entity ID
   * @param {object} components - Character components
   */
  createCharacter(characterId, components = {}) {
    const defaultComponents = {
      'core:name': { text: 'Test Character' },
      'core:position': { x: 0, y: 0, z: 0 },
      ...components,
    };

    this.createEntity(characterId, defaultComponents);
  }

  /**
   * Create an equipment entity
   *
   * @param {string} equipmentId - Equipment entity ID
   * @param {object} components - Equipment components
   */
  createEquipmentEntity(equipmentId, components = {}) {
    this.createEntity(equipmentId, components);
  }

  /**
   * Generate equipment description for a character
   *
   * @param {string} characterId - Character entity ID
   * @returns {Promise<string>} Equipment description
   */
  async generateEquipmentDescription(characterId) {
    this.#warnings = []; // Clear previous warnings
    return await this.#equipmentDescriptionService.generateEquipmentDescription(characterId);
  }

  /**
   * Get warnings/errors captured during testing
   *
   * @returns {string[]} Array of warning messages
   */
  getWarnings() {
    return this.#warnings;
  }

  /**
   * Clear captured warnings
   */
  clearWarnings() {
    this.#warnings = [];
  }
}