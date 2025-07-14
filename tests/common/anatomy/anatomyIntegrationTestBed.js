import EntityManager from '../../../src/entities/entityManager.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { AnatomyGenerationService } from '../../../src/anatomy/anatomyGenerationService.js';
import { BodyBlueprintFactory } from '../../../src/anatomy/bodyBlueprintFactory.js';
import { GraphIntegrityValidator } from '../../../src/anatomy/graphIntegrityValidator.js';
import { BodyGraphService } from '../../../src/anatomy/bodyGraphService.js';
import { RecipeProcessor } from '../../../src/anatomy/recipeProcessor.js';
import { PartSelectionService } from '../../../src/anatomy/partSelectionService.js';
import { SocketManager } from '../../../src/anatomy/socketManager.js';
import { EntityGraphBuilder } from '../../../src/anatomy/entityGraphBuilder.js';
import { RecipeConstraintEvaluator } from '../../../src/anatomy/recipeConstraintEvaluator.js';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';
import { DescriptionTemplate } from '../../../src/anatomy/templates/descriptionTemplate.js';
import { AnatomyInitializationService } from '../../../src/anatomy/anatomyInitializationService.js';
import { AnatomyDescriptionService } from '../../../src/anatomy/anatomyDescriptionService.js';
import { BodyDescriptionOrchestrator } from '../../../src/anatomy/BodyDescriptionOrchestrator.js';
import { DescriptionPersistenceService } from '../../../src/anatomy/DescriptionPersistenceService.js';
import { LayerResolutionService } from '../../../src/clothing/services/layerResolutionService.js';
import AnatomySocketIndex from '../../../src/anatomy/services/anatomySocketIndex.js';
import { ClothingInstantiationService } from '../../../src/clothing/services/clothingInstantiationService.js';
import { ClothingSlotValidator } from '../../../src/clothing/validation/clothingSlotValidator.js';
import { ClothingManagementService } from '../../../src/clothing/services/clothingManagementServiceV2.js';
import AnatomyBlueprintRepository from '../../../src/anatomy/repositories/anatomyBlueprintRepository.js';
import { AnatomyClothingCache } from '../../../src/anatomy/cache/AnatomyClothingCache.js';
import { ANATOMY_CLOTHING_CACHE_CONFIG } from '../../../src/anatomy/constants/anatomyConstants.js';
import {
  createMockLogger,
  createMockSafeEventDispatcher,
  createMockSchemaValidator,
  createMockEventDispatchService,
  createMockEntity,
} from '../mockFactories/index.js';
import UuidGenerator from '../../../src/adapters/UuidGenerator.js';
import BaseTestBed from '../baseTestBed.js';

/**
 * @description Test bed for integration tests requiring real anatomy system components
 * with an actual {@link InMemoryDataRegistry}.
 * @class
 */
export default class AnatomyIntegrationTestBed extends BaseTestBed {
  /**
   * Constructs the integration test bed with anatomy-related services.
   *
   * @param {object} [options] - Optional configuration
   */
  constructor(options = {}) {
    const mocks = {
      logger: createMockLogger(),
      registry: new InMemoryDataRegistry(),
      eventDispatcher: createMockSafeEventDispatcher(),
      eventDispatchService: createMockEventDispatchService(),
      validator: createMockSchemaValidator(),
      idGenerator: UuidGenerator,
    };
    super(mocks);

    // Create entity manager
    this.entityManager = new EntityManager({
      registry: mocks.registry,
      logger: mocks.logger,
      dispatcher: mocks.eventDispatcher,
      validator: mocks.validator,
      idGenerator: mocks.idGenerator,
    });

    // Create validator
    this.validator = new GraphIntegrityValidator({
      entityManager: this.entityManager,
      logger: mocks.logger,
    });

    // Create new anatomy services
    this.recipeProcessor = new RecipeProcessor({
      dataRegistry: mocks.registry,
      logger: mocks.logger,
    });

    this.partSelectionService = new PartSelectionService({
      dataRegistry: mocks.registry,
      logger: mocks.logger,
      eventDispatchService: mocks.eventDispatchService,
    });

    this.socketManager = new SocketManager({
      entityManager: this.entityManager,
      logger: mocks.logger,
    });

    this.entityGraphBuilder = new EntityGraphBuilder({
      entityManager: this.entityManager,
      dataRegistry: mocks.registry,
      logger: mocks.logger,
    });

    this.constraintEvaluator = new RecipeConstraintEvaluator({
      entityManager: this.entityManager,
      logger: mocks.logger,
    });

    // Create body blueprint factory
    this.bodyBlueprintFactory = new BodyBlueprintFactory({
      entityManager: this.entityManager,
      dataRegistry: mocks.registry,
      logger: mocks.logger,
      eventDispatcher: mocks.eventDispatcher,
      eventDispatchService: mocks.eventDispatchService,
      recipeProcessor: this.recipeProcessor,
      partSelectionService: this.partSelectionService,
      socketManager: this.socketManager,
      entityGraphBuilder: this.entityGraphBuilder,
      constraintEvaluator: this.constraintEvaluator,
      validator: this.validator,
    });

    // Create body graph service
    this.bodyGraphService = new BodyGraphService({
      entityManager: this.entityManager,
      logger: mocks.logger,
      eventDispatcher: mocks.eventDispatcher,
    });

    // Add the getAnatomyData method that ClothingInstantiationService expects
    this.bodyGraphService.getAnatomyData = jest.fn().mockResolvedValue({
      recipeId: 'human_base',
      rootEntityId: 'actor123',
    });

    // Create mock dependencies for BodyDescriptionComposer
    this.mockBodyPartDescriptionBuilder = {
      buildDescription: (partEntity) => {
        const partType =
          partEntity?.getComponentData?.('anatomy:part')?.subType || 'part';
        return `A ${partType} part`;
      },
    };

    this.mockAnatomyFormattingService = {
      formatDescription: (desc) => desc,
    };

    this.mockPartDescriptionGenerator = {
      generateDescription: (partEntity) => {
        if (!partEntity) return 'A body part';
        const partType =
          partEntity.getComponentData?.('anatomy:part')?.subType || 'body part';
        const description = `A human ${partType}`;

        // Actually add the description component to the entity
        if (this.entityManager && this.entityManager.addComponent) {
          this.entityManager.addComponent(partEntity.id, 'core:description', {
            text: description,
          });
        }

        return description;
      },
      generatePartDescription: (partId) => {
        const partEntity = this.entityManager.getEntityInstance(partId);
        if (!partEntity) return 'A body part';
        const partType =
          partEntity.getComponentData?.('anatomy:part')?.subType || 'body part';
        const description = `A human ${partType}`;

        // Actually add the description component to the entity
        if (this.entityManager && this.entityManager.addComponent) {
          this.entityManager.addComponent(partEntity.id, 'core:description', {
            text: description,
          });
        }

        return description;
      },
      generateMultiplePartDescriptions: (partIds) => {
        const descriptions = new Map();
        for (const partId of partIds) {
          const partEntity = this.entityManager.getEntityInstance(partId);
          if (partEntity) {
            const description =
              this.mockPartDescriptionGenerator.generateDescription(partEntity);
            descriptions.set(partId, description);
          }
        }
        return descriptions;
      },
    };

    // Create body description composer
    this.bodyDescriptionComposer = new BodyDescriptionComposer({
      bodyPartDescriptionBuilder: this.mockBodyPartDescriptionBuilder,
      bodyGraphService: this.bodyGraphService,
      entityFinder: this.entityManager,
      anatomyFormattingService: this.mockAnatomyFormattingService,
      partDescriptionGenerator: this.mockPartDescriptionGenerator,
    });

    // Create description template (exposed separately for testing)
    this.descriptionTemplate = this.bodyDescriptionComposer.descriptionTemplate;

    // Create mock component manager
    this.mockComponentManager = {
      addComponent: (entityId, componentId, data) => {
        this.entityManager.addComponent(entityId, componentId, data);
      },
      updateComponent: (entityId, componentId, data) => {
        this.entityManager.updateComponent(entityId, componentId, data);
      },
    };

    // Create body description orchestrator
    this.bodyDescriptionOrchestrator = new BodyDescriptionOrchestrator({
      bodyGraphService: this.bodyGraphService,
      partDescriptionGenerator: this.mockPartDescriptionGenerator,
      bodyDescriptionComposer: this.bodyDescriptionComposer,
      entityManager: this.entityManager,
      eventDispatcher: mocks.eventDispatcher,
      logger: mocks.logger,
    });

    // Create description persistence service
    this.descriptionPersistenceService = new DescriptionPersistenceService({
      entityManager: this.entityManager,
      logger: mocks.logger,
      eventBus: mocks.eventDispatcher,
    });

    // Create real anatomy description service
    this.anatomyDescriptionService = new AnatomyDescriptionService({
      bodyPartDescriptionBuilder: this.mockBodyPartDescriptionBuilder,
      bodyDescriptionComposer: this.bodyDescriptionComposer,
      bodyGraphService: this.bodyGraphService,
      entityFinder: this.entityManager,
      componentManager: this.mockComponentManager,
      eventDispatchService: mocks.eventDispatchService,
      partDescriptionGenerator: this.mockPartDescriptionGenerator,
      bodyDescriptionOrchestrator: this.bodyDescriptionOrchestrator,
      descriptionPersistenceService: this.descriptionPersistenceService,
    });

    // Create anatomy generation service
    this.anatomyGenerationService = new AnatomyGenerationService({
      entityManager: this.entityManager,
      dataRegistry: mocks.registry,
      logger: mocks.logger,
      bodyBlueprintFactory: this.bodyBlueprintFactory,
      anatomyDescriptionService: this.anatomyDescriptionService,
      bodyGraphService: this.bodyGraphService,
    });

    // Create anatomy initialization service
    this.anatomyInitializationService = new AnatomyInitializationService({
      eventDispatcher: mocks.eventDispatcher,
      logger: mocks.logger,
      anatomyGenerationService: this.anatomyGenerationService,
    });

    // Create layer resolution service
    this.layerResolutionService = new LayerResolutionService({
      logger: mocks.logger,
    });

    // Create anatomy socket index
    this.anatomySocketIndex = new AnatomySocketIndex({
      logger: mocks.logger,
      entityManager: this.entityManager,
      bodyGraphService: this.bodyGraphService,
    });

    // Create clothing slot validator
    this.clothingSlotValidator = new ClothingSlotValidator({
      logger: mocks.logger,
    });

    // Create anatomy clothing cache
    this.anatomyClothingCache = new AnatomyClothingCache(
      { logger: mocks.logger },
      ANATOMY_CLOTHING_CACHE_CONFIG
    );

    // Create anatomy blueprint repository for decomposed services
    this.anatomyBlueprintRepository = new AnatomyBlueprintRepository({
      logger: mocks.logger,
      dataRegistry: mocks.registry,
    });

    // Create mock equipment orchestrator
    this.mockEquipmentOrchestrator = {
      orchestrateEquipment: (actorId, clothing) =>
        Promise.resolve({ 
          success: true, 
          equipped: clothing.map(item => ({
            itemId: item.itemId || UuidGenerator(),
            slot: item.targetSlot,
          }))
        }),
    };

    // Create missing dependencies for ClothingInstantiationService
    this.slotResolver = {
      resolveClothingSlot: jest.fn().mockResolvedValue([
        { entityId: 'torso', socketId: 'chest', slotPath: 'torso.chest' },
      ]),
      setSlotEntityMappings: jest.fn(),
    };


    // Create clothing instantiation service
    this.clothingInstantiationService = new ClothingInstantiationService({
      entityManager: this.entityManager,
      dataRegistry: mocks.registry,
      equipmentOrchestrator: this.mockEquipmentOrchestrator,
      slotResolver: this.slotResolver,
      clothingSlotValidator: this.clothingSlotValidator,
      anatomyBlueprintRepository: this.anatomyBlueprintRepository,
      bodyGraphService: this.bodyGraphService,
      anatomyClothingCache: this.anatomyClothingCache,
      layerResolutionService: this.layerResolutionService,
      logger: mocks.logger,
      eventBus: mocks.eventDispatcher,
    });

    // Create clothing management service
    this.clothingManagementService = new ClothingManagementService({
      entityManager: this.entityManager,
      logger: mocks.logger,
      eventDispatcher: mocks.eventDispatcher,
      equipmentOrchestrator: this.mockEquipmentOrchestrator,
      anatomyBlueprintRepository: this.anatomyBlueprintRepository,
      clothingSlotValidator: this.clothingSlotValidator,
      bodyGraphService: this.bodyGraphService,
      anatomyClothingCache: this.anatomyClothingCache,
    });
  }

  /**
   * Helper method to load anatomy component definitions into the registry
   *
   * @param {object} components - Map of component ID to component data
   */
  loadComponents(components) {
    for (const [id, data] of Object.entries(components)) {
      this.registry.store('components', id, data);
    }
  }

  /**
   * Helper method to load entity definitions into the registry
   *
   * @param {object} entities - Map of entity ID to entity definition
   */
  loadEntityDefinitions(entities) {
    for (const [id, data] of Object.entries(entities)) {
      // Create EntityDefinition instance from raw data
      const definition = new EntityDefinition(id || data.id, {
        description: data.description || '',
        components: data.components || {},
      });
      this.registry.store('entityDefinitions', id, definition);
      // Also mark anatomy parts in the anatomyParts registry
      if (data.components && data.components['anatomy:part']) {
        this.registry.store('anatomyParts', id, { isAnatomyPart: true });
      }
    }
  }

  /**
   * Helper method to load anatomy blueprints into the registry
   * Handles blueprint composition if the blueprint uses parts
   *
   * @param {object} blueprints - Map of blueprint ID to blueprint data
   */
  loadBlueprints(blueprints) {
    for (const [id, data] of Object.entries(blueprints)) {
      // Check if blueprint needs composition
      if (data.compose || data.parts) {
        const composedData = this._composeBlueprint(data);
        this.registry.store('anatomyBlueprints', id, composedData);
      } else {
        this.registry.store('anatomyBlueprints', id, data);
      }
    }
  }

  /**
   * Composes a blueprint by processing parts and compose instructions
   * Simplified version of the logic in AnatomyBlueprintLoader
   *
   * @private
   * @param {any} blueprintData - The blueprint data
   * @returns {any} The composed blueprint data
   */
  _composeBlueprint(blueprintData) {
    // Create a deep copy to avoid modifying the original
    const composed = JSON.parse(JSON.stringify(blueprintData));

    // Initialize slots and clothingSlotMappings if not present
    if (!composed.slots) composed.slots = {};
    if (!composed.clothingSlotMappings) composed.clothingSlotMappings = {};

    // Process simple parts inclusion
    if (composed.parts && Array.isArray(composed.parts)) {
      for (const partId of composed.parts) {
        this._includePart(composed, partId, ['slots', 'clothingSlotMappings']);
      }
    }

    // Process advanced composition
    if (composed.compose && Array.isArray(composed.compose)) {
      for (const instruction of composed.compose) {
        this._processComposeInstruction(composed, instruction);
      }
    }

    // Remove composition fields from final data
    delete composed.parts;
    delete composed.compose;

    return composed;
  }

  /**
   * Includes a blueprint part into the composed blueprint
   *
   * @private
   * @param {any} composed - The blueprint being composed
   * @param {string} partId - The part ID to include
   * @param {string[]} sections - The sections to include
   */
  _includePart(composed, partId, sections) {
    const part = this.registry.get('anatomyBlueprintParts', partId);
    if (!part) {
      throw new Error(
        `Blueprint '${composed.id}' references unknown part '${partId}'`
      );
    }

    // Process each section
    for (const section of sections) {
      if (part[section]) {
        this._mergeSection(composed, part, section);
      }
    }
  }

  /**
   * Processes a single compose instruction
   *
   * @private
   * @param {any} composed - The blueprint being composed
   * @param {any} instruction - The compose instruction
   */
  _processComposeInstruction(composed, instruction) {
    if (!instruction.part || !instruction.include) {
      throw new Error(
        `Invalid compose instruction in blueprint '${composed.id}'`
      );
    }

    const part = this.registry.get('anatomyBlueprintParts', instruction.part);
    if (!part) {
      throw new Error(
        `Blueprint '${composed.id}' references unknown part '${instruction.part}'`
      );
    }

    // Process included sections
    for (const section of instruction.include) {
      if (part[section]) {
        this._mergeSection(composed, part, section);
      }
    }
  }

  /**
   * Merges a section from a part into the composed blueprint
   *
   * @private
   * @param {any} composed - The blueprint being composed
   * @param {any} part - The part containing the section
   * @param {string} section - The section name to merge
   */
  _mergeSection(composed, part, section) {
    const sectionData = part[section];
    if (!sectionData) return;

    if (section === 'slots') {
      for (const [slotKey, slotData] of Object.entries(sectionData)) {
        if (slotData && typeof slotData === 'object' && slotData.$use) {
          // Resolve slot from library
          const resolvedSlot = this._resolveSlotFromLibrary(
            slotData,
            part.library
          );
          if (resolvedSlot) {
            composed.slots[slotKey] = { ...resolvedSlot, ...slotData };
            delete composed.slots[slotKey].$use;
          }
        } else {
          composed.slots[slotKey] = slotData;
        }
      }
    } else {
      // For other sections, just merge
      Object.assign(composed[section], sectionData);
    }
  }

  /**
   * Resolves a slot reference from a slot library
   *
   * @private
   * @param {any} slotRef - The slot reference with $use
   * @param {string} libraryId - The library ID
   * @returns {any} The resolved slot definition
   */
  _resolveSlotFromLibrary(slotRef, libraryId) {
    const library = this.registry.get('anatomySlotLibraries', libraryId);
    if (!library) {
      throw new Error(`Unknown slot library '${libraryId}'`);
    }

    const slotDef = library.slotDefinitions[slotRef.$use];
    if (!slotDef) {
      throw new Error(
        `Unknown slot definition '${slotRef.$use}' in library '${libraryId}'`
      );
    }

    return slotDef;
  }

  /**
   * Helper method to load anatomy recipes into the registry
   *
   * @param {object} recipes - Map of recipe ID to recipe data
   */
  loadRecipes(recipes) {
    for (const [id, data] of Object.entries(recipes)) {
      this.registry.store('anatomyRecipes', id, data);
    }
  }

  /**
   * Helper method to load anatomy blueprint parts into the registry
   *
   * @param {object} parts - Map of part ID to part data
   */
  loadBlueprintParts(parts) {
    for (const [id, data] of Object.entries(parts)) {
      this.registry.store('anatomyBlueprintParts', id, data);
    }
  }

  /**
   * Helper method to load anatomy slot libraries into the registry
   *
   * @param {object} libraries - Map of library ID to library data
   */
  loadSlotLibraries(libraries) {
    for (const [id, data] of Object.entries(libraries)) {
      this.registry.store('anatomySlotLibraries', id, data);
    }
  }

  /**
   * Helper method to generate a body using the gorgeous milf recipe
   * This requires that the appropriate data has been loaded into the registry
   *
   * @returns {Promise<object>} The generated body entity
   */
  async generateGorgeousMilfBody() {
    // Create the base entity with anatomy:body component
    const bodyEntity = this.entityManager.createEntityInstance(
      'anatomy:jacqueline_rouxel'
    );

    // Generate the anatomy
    await this.anatomyGenerationService.generateAnatomyIfNeeded(bodyEntity.id);

    return bodyEntity;
  }

  /**
   * Creates a mock entity for testing
   *
   * @param {string} [id] - Optional entity ID (auto-generated if not provided)
   * @param {object} [options] - Optional configuration
   * @returns {object} Mock entity
   */
  createMockEntity(id, options = {}) {
    const entityId = id || UuidGenerator();
    return createMockEntity(entityId, options);
  }

  /**
   * Sets up the test bed with common test data
   * 
   * @returns {Promise<void>}
   */
  async setup() {
    // Load core components
    this.loadComponents({
      'core:actor': {
        id: 'core:actor',
        dataSchema: { type: 'object', properties: {} },
      },
      'anatomy:body': {
        id: 'anatomy:body',
        dataSchema: {
          type: 'object',
          properties: {
            recipeId: { type: 'string' },
            bodyParts: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      'anatomy:part': {
        id: 'anatomy:part',
        dataSchema: {
          type: 'object',
          properties: {
            subType: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      'anatomy:sockets': {
        id: 'anatomy:sockets',
        dataSchema: {
          type: 'object',
          properties: {
            sockets: { 
              type: 'array', 
              items: { 
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  allowedTypes: { type: 'array', items: { type: 'string' } },
                  maxCount: { type: 'number' },
                },
              } 
            },
          },
        },
      },
      'anatomy:joint': {
        id: 'anatomy:joint',
        dataSchema: {
          type: 'object',
          properties: {
            parentSocket: { type: 'string' },
            parentEntity: { type: 'string' },
            childSocket: { type: 'string' },
            childEntity: { type: 'string' },
          },
        },
      },
      'clothing:wearable': {
        id: 'clothing:wearable',
        dataSchema: {
          type: 'object',
          properties: {
            slots: { type: 'array', items: { type: 'string' } },
            layerGroup: { type: 'string' },
            layer: { type: 'number' },
          },
        },
      },
      'core:description': {
        id: 'core:description',
        dataSchema: {
          type: 'object',
          properties: {
            text: { type: 'string' },
          },
        },
      },
    });

    // Load basic entity definitions
    this.loadEntityDefinitions({
      'test:actor': {
        id: 'test:actor',
        description: 'Test actor entity',
        components: {
          'core:actor': {},
        },
      },
      'core:shirt_simple': {
        id: 'core:shirt_simple',
        description: 'Simple shirt',
        components: {
          'clothing:wearable': {
            slots: ['torso_upper'],
            layerGroup: 'clothing',
            layer: 1,
          },
        },
      },
      'anatomy:blueprint_slot': {
        id: 'anatomy:blueprint_slot',
        description: 'Blueprint slot placeholder entity',
        components: {},
      },
    });

    // Load basic recipes
    this.loadRecipes({
      'test:human_adult': {
        id: 'test:human_adult',
        blueprintId: 'anatomy:human_adult',
        properties: {},
      },
    });

    // Load basic entity definitions for anatomy parts
    this.loadEntityDefinitions({
      'anatomy:human_torso': {
        id: 'anatomy:human_torso',
        description: 'Human torso',
        components: {
          'anatomy:part': {
            subType: 'torso',
            tags: ['torso', 'core'],
          },
          'anatomy:sockets': {
            sockets: [
              { id: 'head_socket', allowedTypes: ['head'], maxCount: 1 },
              { id: 'torso_upper_socket', allowedTypes: ['torso_upper'], maxCount: 1 },
              { id: 'torso_lower_socket', allowedTypes: ['torso_lower'], maxCount: 1 },
            ],
          },
        },
      },
      'anatomy:human_head': {
        id: 'anatomy:human_head',
        description: 'Human head',
        components: {
          'anatomy:part': {
            subType: 'head',
            tags: ['head'],
          },
        },
      },
      'anatomy:human_torso_upper': {
        id: 'anatomy:human_torso_upper',
        description: 'Human upper torso',
        components: {
          'anatomy:part': {
            subType: 'torso_upper',
            tags: ['torso', 'upper'],
          },
        },
      },
      'anatomy:human_torso_lower': {
        id: 'anatomy:human_torso_lower',
        description: 'Human lower torso',
        components: {
          'anatomy:part': {
            subType: 'torso_lower',
            tags: ['torso', 'lower'],
          },
        },
      },
    });

    // Load basic blueprints
    this.loadBlueprints({
      'anatomy:human_adult': {
        id: 'anatomy:human_adult',
        root: 'anatomy:human_torso',
        slots: {
          head: { 
            parent: null,  // null means attach to root
            socket: 'head_socket',
            preferId: 'anatomy:human_head',
            tags: ['head'], 
            required: true 
          },
          torso_upper: { 
            parent: null,  // null means attach to root
            socket: 'torso_upper_socket',
            tags: ['torso', 'upper'], 
            required: true 
          },
          torso_lower: { 
            parent: null,  // null means attach to root
            socket: 'torso_lower_socket',
            tags: ['torso', 'lower'], 
            required: true 
          },
        },
        clothingSlotMappings: {
          head: ['head'],
          torso_upper: ['torso_upper'],
          torso_lower: ['torso_lower'],
        },
      },
    });
  }

  /**
   * Gets the entity manager
   * 
   * @returns {EntityManager}
   */
  getEntityManager() {
    return this.entityManager;
  }

  /**
   * Gets the body graph service
   * 
   * @returns {BodyGraphService}
   */
  getBodyGraphService() {
    return this.bodyGraphService;
  }

  /**
   * Gets the data registry
   * 
   * @returns {InMemoryDataRegistry}
   */
  getDataRegistry() {
    return this.registry;
  }

  /**
   * Creates a test actor with anatomy
   * 
   * @returns {Promise<object>} Object with actorId and anatomyId
   */
  async createTestActorWithAnatomy() {
    // Create actor entity
    const actor = this.entityManager.createEntityInstance('test:actor');
    
    // Add anatomy body component
    this.entityManager.addComponent(actor.id, 'anatomy:body', {
      recipeId: 'test:human_adult',
      bodyParts: [],
    });

    // Generate anatomy
    await this.anatomyGenerationService.generateAnatomyIfNeeded(actor.id);

    // Get the anatomy ID
    const bodyData = this.entityManager.getComponentData(actor.id, 'anatomy:body');
    const anatomyId = bodyData?.bodyParts?.[0] || null;

    return {
      actorId: actor.id,
      anatomyId,
    };
  }

  /**
   * Creates a test clothing item
   * 
   * @param {string} definitionId - The entity definition ID for the clothing
   * @returns {Promise<string>} The created clothing entity ID
   */
  async createTestClothingItem(definitionId) {
    const clothingEntity = this.entityManager.createEntityInstance(definitionId);
    return clothingEntity.id;
  }

  /**
   * Creates a test actor without anatomy
   * 
   * @returns {Promise<string>} The created actor ID
   */
  async createTestActorWithEmptyAnatomy() {
    const actor = this.entityManager.createEntityInstance('test:actor');
    
    // Add empty anatomy body component
    this.entityManager.addComponent(actor.id, 'anatomy:body', {
      recipeId: null,
      bodyParts: [],
    });

    return actor.id;
  }

  /**
   * Creates a test actor with complex anatomy
   * 
   * @param {number} partCount - Number of parts to create
   * @returns {Promise<object>} Object with actorId and anatomyId
   */
  async createTestActorWithComplexAnatomy(partCount) {
    // Create actor with basic anatomy first
    const result = await this.createTestActorWithAnatomy();
    
    // Add additional parts as needed to reach the desired count
    const bodyGraph = await this.bodyGraphService.getBodyGraph(result.actorId);
    const currentParts = bodyGraph.getAllPartIds();
    const additionalPartsNeeded = Math.max(0, partCount - currentParts.length);
    
    for (let i = 0; i < additionalPartsNeeded; i++) {
      const partId = this.createBlankEntity();
      this.entityManager.addComponent(partId, 'anatomy:part', {
        subType: `extra_part_${i}`,
        tags: ['extra'],
      });
      
      // Add part to the body graph
      if (result.anatomyId) {
        const bodyData = this.entityManager.getComponentData(result.actorId, 'anatomy:body');
        if (bodyData && bodyData.bodyParts) {
          bodyData.bodyParts.push(partId);
          this.entityManager.updateComponent(result.actorId, 'anatomy:body', bodyData);
        }
      }
    }

    return result;
  }

  /**
   * Gets the clothing management service
   * 
   * @returns {ClothingManagementService}
   */
  getClothingManagementService() {
    return this.clothingManagementService;
  }

  /**
   * Gets the clothing instantiation service
   * 
   * @returns {ClothingInstantiationService}
   */
  getClothingInstantiationService() {
    return this.clothingInstantiationService;
  }

  /**
   * Creates a blank entity without a definition
   * This is a helper for tests that need simple entities
   * 
   * @returns {string} The created entity ID
   */
  createBlankEntity() {
    // Create a minimal entity definition if it doesn't exist
    if (!this.registry.get('entityDefinitions', 'test:blank')) {
      const blankDef = new EntityDefinition('test:blank', {
        description: 'Blank test entity',
        components: {},
      });
      this.registry.store('entityDefinitions', 'test:blank', blankDef);
    }
    
    const entity = this.entityManager.createEntityInstance('test:blank');
    return entity.id;
  }

  /**
   * Sets up the test bed with required test data
   * 
   * @returns {Promise<void>}
   */
  async setup() {
    // Load core test data
    this.loadCoreTestData();
  }

  /**
   * Gets the entity manager
   * 
   * @returns {EntityManager}
   */
  getEntityManager() {
    return this.entityManager;
  }

  /**
   * Gets the body graph service
   * 
   * @returns {BodyGraphService}
   */
  getBodyGraphService() {
    return this.bodyGraphService;
  }

  /**
   * Gets the data registry
   * 
   * @returns {InMemoryDataRegistry}
   */
  getDataRegistry() {
    return this.registry;
  }

  /**
   * Creates a test actor with anatomy
   * 
   * @returns {Promise<{actorId: string, anatomyData: object}>}
   */
  async createTestActorWithAnatomy() {
    // Ensure we have the necessary data loaded
    if (!this.registry.get('entityDefinitions', 'core:actor')) {
      this.loadCoreTestData();
    }

    // Create an actor entity
    const actor = this.entityManager.createEntityInstance('core:actor');
    const actorId = actor.id;

    // Add anatomy body component with the recipe
    this.entityManager.addComponent(actorId, 'anatomy:body', {
      recipeId: 'core:anatomy_humanoid_basic',
      bodyParts: [],
    });

    // Generate anatomy for the actor
    await this.anatomyGenerationService.generateAnatomyIfNeeded(actorId);

    // Get the body graph to extract parts and slot mappings
    const bodyGraph = await this.bodyGraphService.getBodyGraph(actorId);
    const partIds = bodyGraph.getAllPartIds();
    
    // Build parts map from body graph
    const partsMap = new Map();
    for (const partId of partIds) {
      const partEntity = this.entityManager.getEntityInstance(partId);
      if (partEntity) {
        const partData = partEntity.getComponentData('anatomy:part');
        if (partData && partData.subType) {
          partsMap.set(partData.subType, partId);
        }
      }
    }

    // Build slot entity mappings (simplified for testing)
    const slotEntityMappings = new Map();
    // Add some common slot mappings based on the parts
    if (partsMap.has('torso')) {
      slotEntityMappings.set('torso', partsMap.get('torso'));
      slotEntityMappings.set('torso_upper', partsMap.get('torso'));
      slotEntityMappings.set('torso_lower', partsMap.get('torso'));
    }
    if (partsMap.has('head')) {
      slotEntityMappings.set('head', partsMap.get('head'));
    }
    if (partsMap.has('left_hand')) {
      slotEntityMappings.set('left_hand', partsMap.get('left_hand'));
    }
    if (partsMap.has('right_hand')) {
      slotEntityMappings.set('right_hand', partsMap.get('right_hand'));
    }

    return {
      actorId,
      anatomyData: {
        partsMap,
        slotEntityMappings,
      },
    };
  }

  /**
   * Creates a test clothing item
   * 
   * @param {string} definitionId - The clothing definition ID
   * @returns {Promise<string>} The created clothing entity ID
   */
  async createTestClothingItem(definitionId) {
    // Ensure we have the clothing definition
    if (!this.registry.get('entityDefinitions', definitionId)) {
      // Create a basic clothing definition
      const clothingDef = new EntityDefinition(definitionId, {
        description: 'Test clothing item',
        components: {
          'clothing:wearable': {
            equipmentSlots: {
              primary: 'torso',
            },
            layer: 'base',
            allowedLayers: ['underwear', 'base', 'outer'],
          },
        },
      });
      this.registry.store('entityDefinitions', definitionId, clothingDef);
    }

    const clothing = this.entityManager.createEntityInstance(definitionId);
    return clothing.id;
  }

  /**
   * Creates a test actor with empty anatomy
   * 
   * @returns {Promise<string>} The actor ID
   */
  async createTestActorWithEmptyAnatomy() {
    // Create an actor entity
    const actor = this.entityManager.createEntityInstance('core:actor');
    const actorId = actor.id;

    // Add an empty body component
    this.entityManager.addComponent(actorId, 'anatomy:body', {
      recipeId: 'test:empty_anatomy',
    });

    return actorId;
  }

  /**
   * Creates a test actor with complex anatomy
   * 
   * @param {number} partCount - Number of body parts to create
   * @returns {Promise<{actorId: string, anatomyData: object}>}
   */
  async createTestActorWithComplexAnatomy(partCount) {
    // Create an actor entity
    const actor = this.entityManager.createEntityInstance('core:actor');
    const actorId = actor.id;

    // Add body component
    this.entityManager.addComponent(actorId, 'anatomy:body', {
      recipeId: 'test:complex_anatomy',
    });

    // Create multiple body parts
    const partsMap = new Map();
    const slotEntityMappings = new Map();

    for (let i = 0; i < partCount; i++) {
      const partDef = new EntityDefinition(`test:part_${i}`, {
        description: `Test body part ${i}`,
        components: {
          'anatomy:part': { type: 'test' },
          'anatomy:sockets': {
            sockets: [
              { id: `socket_test_${i}`, type: 'attachment' },
            ],
          },
        },
      });
      this.registry.store('entityDefinitions', `test:part_${i}`, partDef);

      const part = this.entityManager.createEntityInstance(`test:part_${i}`);
      
      // Add joint to connect to actor
      this.entityManager.addComponent(part.id, 'anatomy:joint', {
        parentEntityId: actorId,
        socketId: `socket_${i}`,
      });

      partsMap.set(`part_${i}`, part.id);
      slotEntityMappings.set(`slot_${i}`, part.id);
    }

    return {
      actorId,
      anatomyData: {
        partsMap,
        slotEntityMappings,
      },
    };
  }

  /**
   * Loads core test data needed for anatomy and clothing tests
   */
  loadCoreTestData() {
    // Load core entity definitions
    this.loadEntityDefinitions({
      'core:actor': {
        id: 'core:actor',
        description: 'Test actor',
        components: {},
      },
      'core:shirt_simple': {
        id: 'core:shirt_simple',
        description: 'Simple shirt',
        components: {
          'clothing:wearable': {
            equipmentSlots: {
              primary: 'torso',
            },
            layer: 'base',
            allowedLayers: ['underwear', 'base', 'outer'],
          },
        },
      },
    });

    // Load core anatomy components
    this.loadComponents({
      'anatomy:body': {
        id: 'anatomy:body',
        description: 'Body component',
        dataSchema: {
          type: 'object',
          properties: {
            recipeId: { type: 'string' },
          },
        },
      },
      'anatomy:part': {
        id: 'anatomy:part',
        description: 'Body part component',
        dataSchema: {
          type: 'object',
          properties: {
            type: { type: 'string' },
          },
        },
      },
      'anatomy:joint': {
        id: 'anatomy:joint',
        description: 'Joint component',
        dataSchema: {
          type: 'object',
          properties: {
            parentEntityId: { type: 'string' },
            socketId: { type: 'string' },
          },
        },
      },
      'anatomy:sockets': {
        id: 'anatomy:sockets',
        description: 'Sockets component',
        dataSchema: {
          type: 'object',
          properties: {
            sockets: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  type: { type: 'string' },
                },
              },
            },
          },
        },
      },
      'clothing:wearable': {
        id: 'clothing:wearable',
        description: 'Clothing wearable component',
        dataSchema: {
          type: 'object',
          properties: {
            equipmentSlots: {
              type: 'object',
              properties: {
                primary: { type: 'string' },
              },
            },
            layer: { type: 'string' },
            allowedLayers: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
      'clothing:equipment': {
        id: 'clothing:equipment',
        description: 'Equipment component',
        dataSchema: {
          type: 'object',
          properties: {
            equipped: { type: 'object' },
          },
        },
      },
    });

    // Load basic anatomy recipes
    this.loadRecipes({
      'core:anatomy_humanoid_basic': {
        id: 'core:anatomy_humanoid_basic',
        name: 'Basic Humanoid Anatomy',
        blueprintId: 'core:humanoid_basic',
      },
      'test:empty_anatomy': {
        id: 'test:empty_anatomy',
        name: 'Empty Anatomy',
        blueprintId: 'test:empty_blueprint',
      },
      'test:complex_anatomy': {
        id: 'test:complex_anatomy',
        name: 'Complex Anatomy',
        blueprintId: 'test:complex_blueprint',
      },
    });

    // Load basic anatomy blueprints
    this.loadBlueprints({
      'core:humanoid_basic': {
        id: 'core:humanoid_basic',
        name: 'Basic Humanoid',
        root: 'core:torso',
        slots: {},
        clothingSlotMappings: {
          torso: {
            blueprintSlots: ['torso'],
            allowedLayers: ['underwear', 'base', 'outer'],
          },
          head: {
            blueprintSlots: ['head'],
            allowedLayers: ['base', 'outer'],
          },
        },
      },
      'test:empty_blueprint': {
        id: 'test:empty_blueprint',
        name: 'Empty Blueprint',
        root: 'test:empty_root',
        slots: {},
        clothingSlotMappings: {},
      },
      'test:complex_blueprint': {
        id: 'test:complex_blueprint',
        name: 'Complex Blueprint',
        root: 'test:complex_root',
        slots: {},
        clothingSlotMappings: {},
      },
    });

    // Load body part definitions
    this.loadEntityDefinitions({
      'core:torso': {
        id: 'core:torso',
        description: 'Torso',
        components: {
          'anatomy:part': { type: 'torso', subType: 'torso' },
          'anatomy:sockets': {
            sockets: [
              { id: 'torso_socket', type: 'attachment' },
            ],
          },
        },
      },
      'test:empty_root': {
        id: 'test:empty_root',
        description: 'Empty root part',
        components: {
          'anatomy:part': { type: 'root', subType: 'root' },
        },
      },
      'test:complex_root': {
        id: 'test:complex_root',
        description: 'Complex root part',
        components: {
          'anatomy:part': { type: 'root', subType: 'root' },
        },
      },
    });
  }

  /**
   * Performs cleanup after each test run.
   *
   * @protected
   * @returns {Promise<void>} Resolves when cleanup completes.
   */
  async _afterCleanup() {
    if (this.entityManager?.clearAll) {
      this.entityManager.clearAll();
    }
    await super._afterCleanup();
  }
}
