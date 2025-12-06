import { jest } from '@jest/globals';
import EntityManager from '../../../src/entities/entityManager.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { AnatomyGenerationService } from '../../../src/anatomy/anatomyGenerationService.js';
import { BodyBlueprintFactory } from '../../../src/anatomy/bodyBlueprintFactory/bodyBlueprintFactory.js';
import { GraphIntegrityValidator } from '../../../src/anatomy/graphIntegrityValidator.js';
import { BodyGraphService } from '../../../src/anatomy/bodyGraphService.js';
import { RecipeProcessor } from '../../../src/anatomy/recipeProcessor.js';
import { PartSelectionService } from '../../../src/anatomy/partSelectionService.js';
import { SocketManager } from '../../../src/anatomy/socketManager.js';
import { EntityGraphBuilder } from '../../../src/anatomy/entityGraphBuilder.js';
import { RecipeConstraintEvaluator } from '../../../src/anatomy/recipeConstraintEvaluator.js';
import SocketGenerator from '../../../src/anatomy/socketGenerator.js';
import SlotGenerator from '../../../src/anatomy/slotGenerator.js';
import RecipePatternResolver from '../../../src/anatomy/recipePatternResolver/patternResolver.js';
import BlueprintProcessorService from '../../../src/anatomy/services/blueprintProcessorService.js';
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
import { ClothingManagementService } from '../../../src/clothing/services/clothingManagementService.js';
import AnatomyBlueprintRepository from '../../../src/anatomy/repositories/anatomyBlueprintRepository.js';
import { AnatomyClothingCache } from '../../../src/anatomy/cache/AnatomyClothingCache.js';
import { ANATOMY_CLOTHING_CACHE_CONFIG } from '../../../src/anatomy/constants/anatomyConstants.js';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { IsSocketCoveredOperator } from '../../../src/logic/operators/isSocketCoveredOperator.js';
import {
  createMockLogger,
  createMockSafeEventDispatcher,
  createMockValidatedEventDispatcherForIntegration,
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
      eventDispatcher: createMockValidatedEventDispatcherForIntegration(),
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
      partSelectionService: this.partSelectionService,
    });

    this.constraintEvaluator = new RecipeConstraintEvaluator({
      entityManager: this.entityManager,
      logger: mocks.logger,
    });

    this.socketGenerator = new SocketGenerator({
      logger: mocks.logger,
    });

    this.slotGenerator = new SlotGenerator({
      logger: mocks.logger,
    });

    this.recipePatternResolver = new RecipePatternResolver({
      dataRegistry: mocks.registry,
      slotGenerator: this.slotGenerator,
      logger: mocks.logger,
    });

    this.blueprintProcessorService = new BlueprintProcessorService({
      dataRegistry: mocks.registry,
      socketGenerator: this.socketGenerator,
      slotGenerator: this.slotGenerator,
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
      socketGenerator: this.socketGenerator,
      slotGenerator: this.slotGenerator,
      recipePatternResolver: this.recipePatternResolver,
      blueprintProcessorService: this.blueprintProcessorService,
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
      getActivityIntegrationConfig: () => ({
        prefix: 'Activity: ',
        suffix: '',
        separator: '. ',
        maxActivities: 10,
      }),
      getDescriptionOrder: () => [
        'height',
        'skin_color',
        'build',
        'body_composition',
        'body_hair',
        'smell',
        'head',
        'hair',
        'eyes',
        'face',
        'ear',
        'nose',
        'mouth',
        'neck',
        'breast',
        'torso',
        'arm',
        'hand',
        'leg',
        'foot',
        'equipment',
        'activity',
      ],
    };

    this.mockPartDescriptionGenerator = {
      generateDescription: (partEntity) => {
        if (!partEntity) return 'A body part';
        const partType =
          partEntity.getComponentData?.('anatomy:part')?.subType || 'body part';
        const description = `A human ${partType}`;

        // Actually add the description component to the entity
        if (
          this.entityManager &&
          this.entityManager.addComponent &&
          partEntity.id
        ) {
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
        if (
          this.entityManager &&
          this.entityManager.addComponent &&
          partEntity.id
        ) {
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
        if (entityId) {
          this.entityManager.addComponent(entityId, componentId, data);
        }
      },
      updateComponent: (entityId, componentId, data) => {
        if (entityId) {
          this.entityManager.updateComponent(entityId, componentId, data);
        }
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

    // Add generateAnatomy method alias for test compatibility
    this.anatomyGenerationService.generateAnatomy =
      this.anatomyGenerationService.generateAnatomyIfNeeded;

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

    // Create anatomy cache manager
    this.anatomyCacheManager = new AnatomyCacheManager({
      logger: mocks.logger,
    });

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
          equipped: clothing.map((item) => ({
            itemId: item.itemId || UuidGenerator(),
            slot: item.targetSlot,
          })),
        }),
    };

    // Create missing dependencies for ClothingInstantiationService
    this.slotResolver = {
      resolveClothingSlot: jest
        .fn()
        .mockResolvedValue([
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

    // Create isSocketCoveredOperator
    this.isSocketCoveredOperator = new IsSocketCoveredOperator({
      entityManager: this.entityManager,
      logger: mocks.logger,
    });

    // Create mock logic registry
    this.logicRegistry = {
      getCustomOperator: (name) => {
        if (name === 'isSocketCovered') {
          return this.isSocketCoveredOperator;
        }
        return null;
      },
    };

    // Create container and register services
    this.container = new Map();
    this.container.set('IEntityManager', this.entityManager);
    this.container.set(
      'AnatomyGenerationService',
      this.anatomyGenerationService
    );
    this.container.set('SocketManager', this.socketManager);
    this.container.set('BodyGraphService', this.bodyGraphService);
    this.container.set('EntityManager', this.entityManager);
    this.container.set('ILogicRegistry', this.logicRegistry);
    this.container.set(
      'ClothingInstantiationService',
      this.clothingInstantiationService
    );
    this.container.set(
      'ClothingManagementService',
      this.clothingManagementService
    );
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
   * Loads structure templates into the registry
   *
   * @param {object} templates - Structure templates to load
   */
  loadStructureTemplates(templates) {
    for (const [id, data] of Object.entries(templates)) {
      this.registry.store('anatomyStructureTemplates', id, data);
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
   * Sets up the test bed with comprehensive anatomy test data
   *
   * @returns {Promise<void>}
   */
  async setup() {
    // Load comprehensive anatomy mod data
    await this.loadAnatomyModData();
  }

  /**
   * Loads comprehensive anatomy mod data including components, entities, blueprints, and recipes
   * This mirrors the actual mod structure in data/mods/anatomy/
   *
   * @returns {Promise<void>}
   */
  async loadAnatomyModData() {
    // Load core components
    this.loadComponents({
      'core:actor': {
        id: 'core:actor',
        dataSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
      },
      'core:name': {
        id: 'core:name',
        dataSchema: {
          type: 'object',
          additionalProperties: false,
          required: ['text'],
          properties: {
            text: { type: 'string' },
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
      'anatomy:body': {
        id: 'anatomy:body',
        dataSchema: {
          type: 'object',
          properties: {
            recipeId: { type: 'string' },
            body: {
              type: 'object',
              properties: {
                root: { type: 'string' },
                parts: { type: 'object' },
              },
            },
          },
        },
      },
      'anatomy:part': {
        id: 'anatomy:part',
        dataSchema: {
          type: 'object',
          properties: {
            subType: { type: 'string' },
            orientation: {
              type: 'string',
              enum: ['left', 'right', 'mid', 'upper', 'lower', 'front', 'back'],
            },
            parentEntity: { type: 'string' },
          },
          required: ['subType'],
          additionalProperties: false,
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
                  orientation: { type: 'string' },
                  allowedTypes: { type: 'array', items: { type: 'string' } },
                  nameTpl: { type: 'string' },
                  maxCount: { type: 'number' },
                },
              },
            },
          },
        },
      },
      'anatomy:joint': {
        id: 'anatomy:joint',
        dataSchema: {
          type: 'object',
          properties: {
            parentId: { type: 'string' },
            socketId: { type: 'string' },
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
      'clothing:slot_metadata': {
        id: 'clothing:slot_metadata',
        description:
          'Metadata about clothing slots and their anatomy socket coverage',
        dataSchema: {
          type: 'object',
          properties: {
            slotMappings: {
              type: 'object',
              patternProperties: {
                '^[a-zA-Z][a-zA-Z0-9_]*$': {
                  type: 'object',
                  properties: {
                    coveredSockets: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    allowedLayers: {
                      type: 'array',
                      items: {
                        type: 'string',
                        enum: [
                          'underwear',
                          'base',
                          'outer',
                          'accessories',
                          'armor',
                        ],
                      },
                    },
                  },
                  required: ['coveredSockets'],
                  additionalProperties: false,
                },
              },
            },
          },
          required: ['slotMappings'],
        },
      },
      'clothing:equipment': {
        id: 'clothing:equipment',
        description: 'Equipment component for tracking worn clothing',
        dataSchema: {
          type: 'object',
          properties: {
            equipped: {
              type: 'object',
              patternProperties: {
                '^[a-zA-Z][a-zA-Z0-9_]*$': {
                  type: 'object',
                  patternProperties: {
                    '^(underwear|base|outer|accessories|armor)$': {
                      type: 'string',
                    },
                  },
                },
              },
            },
          },
          required: ['equipped'],
        },
      },
      'descriptors:size_category': {
        id: 'descriptors:size_category',
        description: 'Size category descriptor',
        dataSchema: {
          type: 'object',
          properties: {
            size: { type: 'string' },
          },
          required: ['size'],
        },
      },
      'descriptors:length_category': {
        id: 'descriptors:length_category',
        description: 'Length category descriptor',
        dataSchema: {
          type: 'object',
          properties: {
            length: { type: 'string' },
          },
          required: ['length'],
        },
      },
      'descriptors:texture': {
        id: 'descriptors:texture',
        description: 'Texture descriptor',
        dataSchema: {
          type: 'object',
          properties: {
            texture: { type: 'string' },
          },
          required: ['texture'],
        },
      },
      'descriptors:color_extended': {
        id: 'descriptors:color_extended',
        description: 'Extended color descriptor',
        dataSchema: {
          type: 'object',
          properties: {
            color: { type: 'string' },
          },
          required: ['color'],
        },
      },
      'descriptors:shape_general': {
        id: 'descriptors:shape_general',
        description: 'General shape descriptor',
        dataSchema: {
          type: 'object',
          properties: {
            shape: { type: 'string' },
          },
          required: ['shape'],
        },
      },
    });

    // Load anatomy entity definitions
    this.loadEntityDefinitions({
      'core:actor': {
        id: 'core:actor',
        description: 'Actor entity',
        components: {
          'core:actor': {},
        },
      },
      'anatomy:human_female_torso': {
        id: 'anatomy:human_female_torso',
        description: 'A human female torso with female-specific anatomy',
        components: {
          'anatomy:part': {
            subType: 'torso',
          },
          'anatomy:sockets': {
            sockets: [
              {
                id: 'neck',
                orientation: 'upper',
                allowedTypes: ['head', 'neck'],
                nameTpl: '{{type}}',
              },
              {
                id: 'left_shoulder',
                orientation: 'left',
                allowedTypes: ['arm'],
                nameTpl: '{{orientation}} {{type}}',
              },
              {
                id: 'right_shoulder',
                orientation: 'right',
                allowedTypes: ['arm'],
                nameTpl: '{{orientation}} {{type}}',
              },
              {
                id: 'left_hip',
                orientation: 'left',
                allowedTypes: ['leg'],
                nameTpl: '{{orientation}} {{type}}',
              },
              {
                id: 'right_hip',
                orientation: 'right',
                allowedTypes: ['leg'],
                nameTpl: '{{orientation}} {{type}}',
              },
              {
                id: 'left_chest',
                orientation: 'left',
                allowedTypes: ['breast'],
                nameTpl: '{{orientation}} {{type}}',
              },
              {
                id: 'right_chest',
                orientation: 'right',
                allowedTypes: ['breast'],
                nameTpl: '{{orientation}} {{type}}',
              },
              {
                id: 'left_eye',
                orientation: 'left',
                allowedTypes: ['eye'],
                nameTpl: '{{orientation}} {{type}}',
              },
              {
                id: 'right_eye',
                orientation: 'right',
                allowedTypes: ['eye'],
                nameTpl: '{{orientation}} {{type}}',
              },
              {
                id: 'left_ear',
                orientation: 'left',
                allowedTypes: ['ear'],
                nameTpl: '{{orientation}} {{type}}',
              },
              {
                id: 'right_ear',
                orientation: 'right',
                allowedTypes: ['ear'],
                nameTpl: '{{orientation}} {{type}}',
              },
              {
                id: 'nose',
                allowedTypes: ['nose'],
                nameTpl: '{{type}}',
              },
              {
                id: 'mouth',
                allowedTypes: ['mouth'],
                nameTpl: '{{type}}',
              },
              {
                id: 'teeth',
                allowedTypes: ['teeth'],
                nameTpl: '{{type}}',
              },
              {
                id: 'scalp',
                allowedTypes: ['hair'],
                nameTpl: '{{type}}',
              },
              {
                id: 'pubic_hair',
                allowedTypes: ['pubic_hair'],
                nameTpl: 'pubic hair',
              },
              {
                id: 'vagina',
                allowedTypes: ['vagina'],
                nameTpl: '{{type}}',
              },
              {
                id: 'asshole',
                allowedTypes: ['asshole'],
                nameTpl: '{{type}}',
              },
            ],
          },
          'core:name': {
            text: 'torso',
          },
        },
      },
      'anatomy:humanoid_arm': {
        id: 'anatomy:humanoid_arm',
        description: 'A humanoid arm',
        components: {
          'anatomy:part': {
            subType: 'arm',
          },
          'anatomy:sockets': {
            sockets: [
              {
                id: 'wrist',
                allowedTypes: ['hand'],
                nameTpl: '{{effective_orientation}} {{type}}',
              },
            ],
          },
          'core:name': {
            text: 'arm',
          },
        },
      },
      'anatomy:human_leg': {
        id: 'anatomy:human_leg',
        description: 'A human leg',
        components: {
          'anatomy:part': {
            subType: 'leg',
          },
          'anatomy:sockets': {
            sockets: [
              {
                id: 'ankle',
                allowedTypes: ['foot'],
                nameTpl: '{{effective_orientation}} {{type}}',
              },
            ],
          },
          'core:name': {
            text: 'leg',
          },
        },
      },
      'anatomy:human_hand': {
        id: 'anatomy:human_hand',
        description: 'A human hand',
        components: {
          'anatomy:part': {
            subType: 'hand',
          },
        },
      },
      'anatomy:human_foot': {
        id: 'anatomy:human_foot',
        description: 'A human foot',
        components: {
          'anatomy:part': {
            subType: 'foot',
          },
        },
      },
      'anatomy:humanoid_head': {
        id: 'anatomy:humanoid_head',
        description: 'A humanoid head',
        components: {
          'anatomy:part': {
            subType: 'head',
          },
          'anatomy:sockets': {
            sockets: [
              {
                id: 'left_eye',
                allowedTypes: ['eye'],
                nameTpl: '{{orientation}} {{type}}',
              },
              {
                id: 'right_eye',
                allowedTypes: ['eye'],
                nameTpl: '{{orientation}} {{type}}',
              },
              {
                id: 'left_ear',
                allowedTypes: ['ear'],
                nameTpl: '{{orientation}} {{type}}',
              },
              {
                id: 'right_ear',
                allowedTypes: ['ear'],
                nameTpl: '{{orientation}} {{type}}',
              },
              {
                id: 'nose',
                allowedTypes: ['nose'],
                nameTpl: '{{type}}',
              },
              {
                id: 'mouth',
                allowedTypes: ['mouth'],
                nameTpl: '{{type}}',
              },
              {
                id: 'teeth',
                allowedTypes: ['teeth'],
                nameTpl: '{{type}}',
              },
              {
                id: 'scalp',
                allowedTypes: ['hair'],
                nameTpl: '{{type}}',
              },
            ],
          },
          'core:name': {
            text: 'head',
          },
        },
      },
      'anatomy:human_eye_amber': {
        id: 'anatomy:human_eye_amber',
        description: 'An amber-colored human eye',
        components: {
          'anatomy:part': {
            subType: 'eye',
          },
        },
      },
      'anatomy:humanoid_ear': {
        id: 'anatomy:humanoid_ear',
        description: 'A humanoid ear',
        components: {
          'anatomy:part': {
            subType: 'ear',
          },
        },
      },
      'anatomy:humanoid_nose': {
        id: 'anatomy:humanoid_nose',
        description: 'A humanoid nose',
        components: {
          'anatomy:part': {
            subType: 'nose',
          },
        },
      },
      'anatomy:humanoid_mouth': {
        id: 'anatomy:humanoid_mouth',
        description: 'A humanoid mouth',
        components: {
          'anatomy:part': {
            subType: 'mouth',
          },
          'anatomy:sockets': {
            sockets: [
              {
                id: 'teeth',
                allowedTypes: ['teeth'],
                nameTpl: '{{type}}',
              },
            ],
          },
        },
      },
      'anatomy:humanoid_teeth': {
        id: 'anatomy:humanoid_teeth',
        description: 'Humanoid teeth',
        components: {
          'anatomy:part': {
            subType: 'teeth',
          },
        },
      },
      'anatomy:human_hair_blonde': {
        id: 'anatomy:human_hair_blonde',
        description: 'Blonde human hair',
        components: {
          'anatomy:part': {
            subType: 'hair',
          },
        },
      },
      'anatomy:human_leg_shapely': {
        id: 'anatomy:human_leg_shapely',
        description: 'A shapely human leg',
        components: {
          'anatomy:part': {
            subType: 'leg',
          },
          'anatomy:sockets': {
            sockets: [
              {
                id: 'ankle',
                allowedTypes: ['foot'],
                nameTpl: '{{effective_orientation}} {{type}}',
              },
            ],
          },
          'core:name': {
            text: 'leg',
          },
        },
      },
      'anatomy:human_breast_g_cup': {
        id: 'anatomy:human_breast_g_cup',
        description: 'A G-cup human breast',
        components: {
          'anatomy:part': {
            subType: 'breast',
          },
        },
      },
      'anatomy:blueprint_slot': {
        id: 'anatomy:blueprint_slot',
        description:
          'A blueprint slot entity that represents a slot from the anatomy blueprint',
        components: {
          'core:name': {
            text: 'Blueprint Slot',
          },
        },
      },
      'anatomy:human_male_torso': {
        id: 'anatomy:human_male_torso',
        description: 'A human male torso with male-specific anatomy',
        components: {
          'anatomy:part': {
            subType: 'torso',
          },
          'anatomy:sockets': {
            sockets: [
              {
                id: 'neck',
                orientation: 'upper',
                allowedTypes: ['head', 'neck'],
                nameTpl: '{{type}}',
              },
              {
                id: 'left_shoulder',
                orientation: 'left',
                allowedTypes: ['arm'],
                nameTpl: '{{orientation}} {{type}}',
              },
              {
                id: 'right_shoulder',
                orientation: 'right',
                allowedTypes: ['arm'],
                nameTpl: '{{orientation}} {{type}}',
              },
              {
                id: 'left_hip',
                orientation: 'left',
                allowedTypes: ['leg'],
                nameTpl: '{{orientation}} {{type}}',
              },
              {
                id: 'right_hip',
                orientation: 'right',
                allowedTypes: ['leg'],
                nameTpl: '{{orientation}} {{type}}',
              },
              {
                id: 'left_chest',
                orientation: 'left',
                allowedTypes: ['chest'],
                nameTpl: '{{orientation}} {{type}}',
              },
              {
                id: 'right_chest',
                orientation: 'right',
                allowedTypes: ['chest'],
                nameTpl: '{{orientation}} {{type}}',
              },
              {
                id: 'penis',
                allowedTypes: ['penis'],
                nameTpl: '{{type}}',
              },
              {
                id: 'left_testicle',
                orientation: 'left',
                allowedTypes: ['testicle'],
                nameTpl: '{{orientation}} {{type}}',
              },
              {
                id: 'right_testicle',
                orientation: 'right',
                allowedTypes: ['testicle'],
                nameTpl: '{{orientation}} {{type}}',
              },
              {
                id: 'pubic_hair',
                allowedTypes: ['pubic_hair'],
                nameTpl: 'pubic hair',
              },
              {
                id: 'asshole',
                allowedTypes: ['asshole'],
                nameTpl: '{{type}}',
              },
            ],
          },
          'core:name': {
            text: 'torso',
          },
        },
      },
      'anatomy:human_futa_torso': {
        id: 'anatomy:human_futa_torso',
        description: 'A futanari torso with breasts and male genitalia',
        components: {
          'anatomy:part': {
            subType: 'torso',
          },
          'anatomy:sockets': {
            sockets: [
              {
                id: 'neck',
                orientation: 'upper',
                allowedTypes: ['head', 'neck'],
                nameTpl: '{{type}}',
              },
              {
                id: 'left_shoulder',
                orientation: 'left',
                allowedTypes: ['arm'],
                nameTpl: '{{orientation}} {{type}}',
              },
              {
                id: 'right_shoulder',
                orientation: 'right',
                allowedTypes: ['arm'],
                nameTpl: '{{orientation}} {{type}}',
              },
              {
                id: 'left_hip',
                orientation: 'left',
                allowedTypes: ['leg'],
                nameTpl: '{{orientation}} {{type}}',
              },
              {
                id: 'right_hip',
                orientation: 'right',
                allowedTypes: ['leg'],
                nameTpl: '{{orientation}} {{type}}',
              },
              {
                id: 'left_chest',
                orientation: 'left',
                allowedTypes: ['breast'],
                nameTpl: '{{orientation}} {{type}}',
              },
              {
                id: 'right_chest',
                orientation: 'right',
                allowedTypes: ['breast'],
                nameTpl: '{{orientation}} {{type}}',
              },
              {
                id: 'pubic_hair',
                allowedTypes: ['pubic_hair'],
                nameTpl: 'pubic hair',
              },
              {
                id: 'penis',
                allowedTypes: ['penis'],
                nameTpl: '{{type}}',
              },
              {
                id: 'left_testicle',
                orientation: 'left',
                allowedTypes: ['testicle'],
                nameTpl: '{{orientation}} {{type}}',
              },
              {
                id: 'right_testicle',
                orientation: 'right',
                allowedTypes: ['testicle'],
                nameTpl: '{{orientation}} {{type}}',
              },
              {
                id: 'asshole',
                allowedTypes: ['asshole'],
                nameTpl: '{{type}}',
              },
              {
                id: 'left_ass',
                orientation: 'left',
                allowedTypes: ['ass_cheek'],
                nameTpl: '{{orientation}} {{type}}',
              },
              {
                id: 'right_ass',
                orientation: 'right',
                allowedTypes: ['ass_cheek'],
                nameTpl: '{{orientation}} {{type}}',
              },
            ],
          },
          'core:name': {
            text: 'torso',
          },
        },
      },
      'anatomy:human_vagina': {
        id: 'anatomy:human_vagina',
        description: 'A human vagina',
        components: {
          'anatomy:part': {
            subType: 'vagina',
          },
        },
      },
      'anatomy:human_penis': {
        id: 'anatomy:human_penis',
        description: 'A human penis',
        components: {
          'anatomy:part': {
            subType: 'penis',
          },
        },
      },
      'anatomy:human_testicle': {
        id: 'anatomy:human_testicle',
        description: 'A human testicle',
        components: {
          'anatomy:part': {
            subType: 'testicle',
          },
        },
      },
      'anatomy:human_pubic_hair': {
        id: 'anatomy:human_pubic_hair',
        description: 'Human pubic hair',
        components: {
          'anatomy:part': {
            subType: 'pubic_hair',
          },
        },
      },
      // Species-specific cephalopod entities
      'anatomy:kraken_tentacle': {
        id: 'anatomy:kraken_tentacle',
        description:
          'Elder kraken tentacle with enormous size and dark purple coloring',
        components: {
          'anatomy:part': {
            subType: 'tentacle',
          },
          'core:name': {
            text: 'tentacle',
          },
          'descriptors:size_category': {
            size: 'enormous',
          },
          'descriptors:length_category': {
            length: 'extremely-long',
          },
          'descriptors:texture': {
            texture: 'suckered',
          },
          'descriptors:color_extended': {
            color: 'dark-purple',
          },
          'descriptors:shape_general': {
            shape: 'cylindrical',
          },
        },
      },
      'anatomy:kraken_mantle': {
        id: 'anatomy:kraken_mantle',
        description:
          'Elder kraken mantle body with massive size and abyssal black coloring',
        components: {
          'anatomy:part': {
            subType: 'mantle',
          },
          'anatomy:sockets': {
            sockets: [
              {
                id: 'ink_sac',
                allowedTypes: ['ink_reservoir', 'ink_sac'],
                nameTpl: 'ink sac',
              },
              {
                id: 'beak',
                allowedTypes: ['beak', 'cephalopod_beak'],
                nameTpl: 'beak',
              },
            ],
          },
          'core:name': {
            text: 'mantle',
          },
          'descriptors:size_category': {
            size: 'massive',
          },
          'descriptors:color_extended': {
            color: 'abyssal-black',
          },
          'descriptors:texture': {
            texture: 'smooth',
          },
          'descriptors:shape_general': {
            shape: 'oval',
          },
        },
      },
      'anatomy:squid_tentacle': {
        id: 'anatomy:squid_tentacle',
        description:
          'Common squid tentacle with medium size, long length and translucent-white coloring',
        components: {
          'anatomy:part': {
            subType: 'tentacle',
          },
          'core:name': {
            text: 'tentacle',
          },
          'descriptors:size_category': {
            size: 'medium',
          },
          'descriptors:length_category': {
            length: 'long',
          },
          'descriptors:color_extended': {
            color: 'translucent-white',
          },
        },
      },
      'anatomy:squid_mantle': {
        id: 'anatomy:squid_mantle',
        description:
          'Common squid mantle body with small size and pale-translucent smooth texture',
        components: {
          'anatomy:part': {
            subType: 'mantle',
          },
          'anatomy:sockets': {
            sockets: [
              {
                id: 'ink_sac',
                allowedTypes: ['ink_reservoir', 'ink_sac'],
                nameTpl: 'ink sac',
              },
              {
                id: 'beak',
                allowedTypes: ['beak', 'cephalopod_beak'],
                nameTpl: 'beak',
              },
            ],
          },
          'core:name': {
            text: 'mantle',
          },
          'descriptors:size_category': {
            size: 'small',
          },
          'descriptors:color_extended': {
            color: 'pale-translucent',
          },
          'descriptors:texture': {
            texture: 'smooth',
          },
        },
      },
      'anatomy:octopus_tentacle': {
        id: 'anatomy:octopus_tentacle',
        description:
          'Common octopus tentacle with medium size, thick shape and reddish-brown coloring',
        components: {
          'anatomy:part': {
            subType: 'tentacle',
          },
          'core:name': {
            text: 'tentacle',
          },
          'descriptors:size_category': {
            size: 'medium',
          },
          'descriptors:shape_general': {
            shape: 'thick',
          },
          'descriptors:color_extended': {
            color: 'reddish-brown',
          },
        },
      },
      'anatomy:octopus_mantle': {
        id: 'anatomy:octopus_mantle',
        description:
          'Common octopus mantle body with medium size and soft texture',
        components: {
          'anatomy:part': {
            subType: 'mantle',
          },
          'anatomy:sockets': {
            sockets: [
              {
                id: 'ink_sac',
                allowedTypes: ['ink_reservoir', 'ink_sac'],
                nameTpl: 'ink sac',
              },
              {
                id: 'beak',
                allowedTypes: ['beak', 'cephalopod_beak'],
                nameTpl: 'beak',
              },
            ],
          },
          'core:name': {
            text: 'mantle',
          },
          'descriptors:size_category': {
            size: 'medium',
          },
          'descriptors:texture': {
            texture: 'soft',
          },
        },
      },
      'anatomy:beak': {
        id: 'anatomy:beak',
        description: 'Cephalopod beak',
        components: {
          'anatomy:part': {
            subType: 'beak',
          },
          'core:name': {
            text: 'beak',
          },
        },
      },
      'anatomy:ink_reservoir': {
        id: 'anatomy:ink_reservoir',
        description: 'Cephalopod ink reservoir',
        components: {
          'anatomy:part': {
            subType: 'ink_reservoir',
          },
          'core:name': {
            text: 'ink reservoir',
          },
        },
      },
      'anatomy:head': {
        id: 'anatomy:head',
        description: 'Generic cephalopod head',
        components: {
          'anatomy:part': {
            subType: 'head',
          },
          'core:name': {
            text: 'head',
          },
        },
      },
      'anatomy:kraken_head': {
        id: 'anatomy:kraken_head',
        description: 'A kraken head with massive beak',
        components: {
          'anatomy:part': {
            subType: 'head',
          },
          'core:name': {
            text: 'kraken head',
          },
          'descriptors:size_category': {
            size: 'gigantic',
          },
          'descriptors:shape_general': {
            shape: 'bulbous',
          },
          'descriptors:color_extended': {
            color: 'murky-green',
          },
        },
      },
      // Species-specific spider entities
      'anatomy:spider_cephalothorax': {
        id: 'anatomy:spider_cephalothorax',
        description: 'Root cephalothorax for an eight-legged spider',
        components: {
          'anatomy:part': {
            subType: 'spider_cephalothorax',
          },
          'anatomy:sockets': {
            sockets: [
              {
                id: 'leg_1',
                allowedTypes: ['spider_leg'],
                nameTpl: 'leg',
              },
              {
                id: 'leg_2',
                allowedTypes: ['spider_leg'],
                nameTpl: 'leg',
              },
              {
                id: 'leg_3',
                allowedTypes: ['spider_leg'],
                nameTpl: 'leg',
              },
              {
                id: 'leg_4',
                allowedTypes: ['spider_leg'],
                nameTpl: 'leg',
              },
              {
                id: 'leg_5',
                allowedTypes: ['spider_leg'],
                nameTpl: 'leg',
              },
              {
                id: 'leg_6',
                allowedTypes: ['spider_leg'],
                nameTpl: 'leg',
              },
              {
                id: 'leg_7',
                allowedTypes: ['spider_leg'],
                nameTpl: 'leg',
              },
              {
                id: 'leg_8',
                allowedTypes: ['spider_leg'],
                nameTpl: 'leg',
              },
              {
                id: 'pedipalp_left',
                orientation: 'left',
                allowedTypes: ['spider_pedipalp'],
                nameTpl: '{{orientation}} pedipalp',
              },
              {
                id: 'pedipalp_right',
                orientation: 'right',
                allowedTypes: ['spider_pedipalp'],
                nameTpl: '{{orientation}} pedipalp',
              },
              {
                id: 'abdomen',
                allowedTypes: ['spider_abdomen'],
                nameTpl: 'abdomen',
              },
              {
                id: 'spinnerets',
                allowedTypes: ['spinneret'],
                nameTpl: 'spinnerets',
              },
            ],
          },
          'core:name': {
            text: 'spider cephalothorax',
          },
          'descriptors:texture': {
            texture: 'chitinous',
          },
          'descriptors:body_hair': {
            hairDensity: 'hairy',
          },
        },
      },
      'anatomy:spider_leg': {
        id: 'anatomy:spider_leg',
        description: 'A segmented spider leg',
        components: {
          'anatomy:part': {
            subType: 'spider_leg',
          },
          'core:name': {
            text: 'spider leg',
          },
          'descriptors:texture': {
            texture: 'chitinous',
          },
          'descriptors:body_hair': {
            hairDensity: 'hairy',
          },
        },
      },
      'anatomy:spider_pedipalp': {
        id: 'anatomy:spider_pedipalp',
        description: 'A spider pedipalp for sensory and manipulation',
        components: {
          'anatomy:part': {
            subType: 'spider_pedipalp',
          },
          'core:name': {
            text: 'spider pedipalp',
          },
          'descriptors:texture': {
            texture: 'chitinous',
          },
          'descriptors:body_hair': {
            hairDensity: 'hairy',
          },
        },
      },
      'anatomy:spider_abdomen': {
        id: 'anatomy:spider_abdomen',
        description: 'The bulbous abdomen of a spider',
        components: {
          'anatomy:part': {
            subType: 'spider_abdomen',
          },
          'core:name': {
            text: 'spider abdomen',
          },
          'descriptors:texture': {
            texture: 'ridged',
          },
        },
      },
      'anatomy:spider_spinneret': {
        id: 'anatomy:spider_spinneret',
        description: 'Spider silk-producing organ located on the abdomen',
        components: {
          'anatomy:part': {
            subType: 'spinneret',
          },
          'core:name': {
            text: 'spinneret',
          },
          'descriptors:texture': {
            texture: 'chitinous',
          },
          'descriptors:body_hair': {
            hairDensity: 'hairy',
          },
        },
      },
      // Tortoise person entities
      'anatomy:tortoise_torso_with_shell': {
        id: 'anatomy:tortoise_torso_with_shell',
        description: 'Tortoise torso with integrated shell mounting points',
        components: {
          'anatomy:part': {
            subType: 'tortoise_torso',
          },
          'anatomy:sockets': {
            sockets: [
              {
                id: 'carapace_mount',
                allowedTypes: ['shell_carapace'],
                nameTpl: 'upper shell mount',
              },
              {
                id: 'plastron_mount',
                allowedTypes: ['shell_plastron'],
                nameTpl: 'lower shell mount',
              },
            ],
          },
          'core:name': {
            text: 'tortoise torso',
          },
          'descriptors:texture': {
            texture: 'leathery',
          },
          'descriptors:color_extended': {
            color: 'dark-olive',
          },
        },
      },
      'anatomy:tortoise_carapace': {
        id: 'anatomy:tortoise_carapace',
        description: 'Domed upper shell (carapace) with growth rings',
        components: {
          'anatomy:part': {
            subType: 'shell_carapace',
          },
          'core:name': {
            text: 'carapace',
          },
          'descriptors:texture': {
            texture: 'scaled',
          },
          'descriptors:pattern': {
            pattern: 'hexagonal-scutes',
          },
          'descriptors:color_extended': {
            color: 'bronze',
          },
          'descriptors:shape_general': {
            shape: 'domed',
          },
        },
      },
      'anatomy:tortoise_plastron': {
        id: 'anatomy:tortoise_plastron',
        description: 'Flat lower shell (plastron) protecting underside',
        components: {
          'anatomy:part': {
            subType: 'shell_plastron',
          },
          'core:name': {
            text: 'plastron',
          },
          'descriptors:texture': {
            texture: 'smooth',
          },
          'descriptors:color_extended': {
            color: 'cream',
          },
          'descriptors:shape_general': {
            shape: 'flat',
          },
        },
      },
      'anatomy:tortoise_head': {
        id: 'anatomy:tortoise_head',
        description: 'Reptilian head with beak mount and eye sockets',
        components: {
          'anatomy:part': {
            subType: 'tortoise_head',
          },
          'anatomy:sockets': {
            sockets: [
              {
                id: 'left_eye',
                allowedTypes: ['tortoise_eye'],
                nameTpl: 'left eye',
              },
              {
                id: 'right_eye',
                allowedTypes: ['tortoise_eye'],
                nameTpl: 'right eye',
              },
              {
                id: 'beak_mount',
                allowedTypes: ['tortoise_beak'],
                nameTpl: 'beak',
              },
            ],
          },
          'core:name': {
            text: 'tortoise head',
          },
          'descriptors:texture': {
            texture: 'scaled',
          },
          'descriptors:shape_general': {
            shape: 'domed',
          },
          'descriptors:color_extended': {
            color: 'sickly-gray-green',
          },
        },
      },
      'anatomy:tortoise_beak': {
        id: 'anatomy:tortoise_beak',
        description: 'Hard, hooked beak for eating vegetation',
        components: {
          'anatomy:part': {
            subType: 'tortoise_beak',
          },
          'core:name': {
            text: 'beak',
          },
          'descriptors:texture': {
            texture: 'ridged',
          },
          'descriptors:shape_general': {
            shape: 'hooked',
          },
        },
      },
      'anatomy:tortoise_eye': {
        id: 'anatomy:tortoise_eye',
        description: 'Reptilian eye with protective nictitating membrane',
        components: {
          'anatomy:part': {
            subType: 'tortoise_eye',
          },
          'core:name': {
            text: 'eye',
          },
          'descriptors:color_extended': {
            color: 'amber',
          },
          'descriptors:shape_eye': {
            shape: 'round',
          },
        },
      },
      'anatomy:tortoise_arm': {
        id: 'anatomy:tortoise_arm',
        description: 'Scaled reptilian arm with hand socket',
        components: {
          'anatomy:part': {
            subType: 'tortoise_arm',
          },
          'anatomy:sockets': {
            sockets: [
              {
                id: 'hand',
                allowedTypes: ['tortoise_hand'],
                nameTpl: '{{orientation}} hand',
              },
            ],
          },
          'core:name': {
            text: 'arm',
          },
          'descriptors:texture': {
            texture: 'scaled',
          },
          'descriptors:color_extended': {
            color: 'olive-green',
          },
        },
      },
      'anatomy:tortoise_hand': {
        id: 'anatomy:tortoise_hand',
        description: 'Thick-skinned hand with three prominent claws',
        components: {
          'anatomy:part': {
            subType: 'tortoise_hand',
          },
          'core:name': {
            text: 'hand',
          },
          'descriptors:texture': {
            texture: 'leathery',
          },
          'descriptors:digit_count': {
            count: '3',
          },
          'descriptors:projection': {
            projection: 'clawed',
          },
          'descriptors:color_extended': {
            color: 'sickly-gray-green',
          },
        },
      },
      'anatomy:tortoise_leg': {
        id: 'anatomy:tortoise_leg',
        description: 'Sturdy reptilian leg with foot socket',
        components: {
          'anatomy:part': {
            subType: 'tortoise_leg',
          },
          'anatomy:sockets': {
            sockets: [
              {
                id: 'foot',
                allowedTypes: ['tortoise_foot'],
                nameTpl: '{{orientation}} foot',
              },
            ],
          },
          'core:name': {
            text: 'leg',
          },
          'descriptors:texture': {
            texture: 'scaled',
          },
          'descriptors:build': {
            build: 'stocky',
          },
          'descriptors:color_extended': {
            color: 'dark-olive',
          },
        },
      },
      'anatomy:tortoise_foot': {
        id: 'anatomy:tortoise_foot',
        description: 'Broad foot with three clawed toes',
        components: {
          'anatomy:part': {
            subType: 'tortoise_foot',
          },
          'core:name': {
            text: 'foot',
          },
          'descriptors:texture': {
            texture: 'leathery',
          },
          'descriptors:digit_count': {
            count: '3',
          },
          'descriptors:projection': {
            projection: 'clawed',
          },
          'descriptors:color_extended': {
            color: 'sickly-gray-green',
          },
        },
      },
      'anatomy:tortoise_tail': {
        id: 'anatomy:tortoise_tail',
        description: 'Short, thick reptilian tail',
        components: {
          'anatomy:part': {
            subType: 'tortoise_tail',
          },
          'core:name': {
            text: 'tail',
          },
          'descriptors:texture': {
            texture: 'scaled',
          },
          'descriptors:length_category': {
            length: 'short',
          },
          'descriptors:shape_general': {
            shape: 'conical',
          },
          'descriptors:color_extended': {
            color: 'olive-green',
          },
        },
      },
    });

    // Load slot libraries
    this.loadSlotLibraries({
      'anatomy:humanoid_slots': {
        id: 'anatomy:humanoid_slots',
        description: 'Standard humanoid anatomy slot and clothing definitions',
        slotDefinitions: {
          standard_head: {
            socket: 'neck',
            requirements: {
              partType: 'head',
              components: ['anatomy:part'],
            },
          },
          standard_arm: {
            socket: 'shoulder',
            requirements: {
              partType: 'arm',
              components: ['anatomy:part'],
            },
          },
          standard_leg: {
            socket: 'hip',
            requirements: {
              partType: 'leg',
              components: ['anatomy:part'],
            },
          },
          standard_eye: {
            parent: 'head',
            socket: 'eye',
            requirements: {
              partType: 'eye',
              components: ['anatomy:part'],
            },
          },
          standard_ear: {
            parent: 'head',
            socket: 'ear',
            requirements: {
              partType: 'ear',
              components: ['anatomy:part'],
            },
          },
          standard_nose: {
            parent: 'head',
            socket: 'nose',
            requirements: {
              partType: 'nose',
              components: ['anatomy:part'],
            },
          },
          standard_mouth: {
            parent: 'head',
            socket: 'mouth',
            requirements: {
              partType: 'mouth',
              components: ['anatomy:part'],
            },
          },
          standard_teeth: {
            parent: 'mouth',
            socket: 'teeth',
            requirements: {
              partType: 'teeth',
              components: ['anatomy:part'],
            },
          },
          standard_hair: {
            parent: 'head',
            socket: 'scalp',
            requirements: {
              partType: 'hair',
              components: ['anatomy:part'],
            },
          },
          standard_hand: {
            parent: 'arm',
            socket: 'wrist',
            requirements: {
              partType: 'hand',
              components: ['anatomy:part'],
            },
          },
          standard_foot: {
            parent: 'leg',
            socket: 'ankle',
            requirements: {
              partType: 'foot',
              components: ['anatomy:part'],
            },
          },
        },
      },
    });

    // Load blueprint parts
    this.loadBlueprintParts({
      'anatomy:humanoid_core': {
        id: 'anatomy:humanoid_core',
        description: 'Core humanoid anatomy using slot library',
        library: 'anatomy:humanoid_slots',
        slots: {
          head: {
            $use: 'standard_head',
          },
          left_arm: {
            $use: 'standard_arm',
            socket: 'left_shoulder',
          },
          right_arm: {
            $use: 'standard_arm',
            socket: 'right_shoulder',
          },
          left_leg: {
            $use: 'standard_leg',
            socket: 'left_hip',
          },
          right_leg: {
            $use: 'standard_leg',
            socket: 'right_hip',
          },
          left_eye: {
            $use: 'standard_eye',
            socket: 'left_eye',
          },
          right_eye: {
            $use: 'standard_eye',
            socket: 'right_eye',
          },
          left_ear: {
            $use: 'standard_ear',
            socket: 'left_ear',
          },
          right_ear: {
            $use: 'standard_ear',
            socket: 'right_ear',
          },
          nose: {
            $use: 'standard_nose',
          },
          mouth: {
            $use: 'standard_mouth',
          },
          teeth: {
            $use: 'standard_teeth',
          },
          hair: {
            $use: 'standard_hair',
          },
          left_hand: {
            $use: 'standard_hand',
            parent: 'left_arm',
          },
          right_hand: {
            $use: 'standard_hand',
            parent: 'right_arm',
          },
          left_foot: {
            $use: 'standard_foot',
            parent: 'left_leg',
          },
          right_foot: {
            $use: 'standard_foot',
            parent: 'right_leg',
          },
        },
      },
    });

    // Load structure templates
    this.loadStructureTemplates({
      'anatomy:structure_octopoid': {
        id: 'anatomy:structure_octopoid',
        description:
          'Octopoid mantle with radial tentacles and anterior head attachment',
        topology: {
          rootType: 'mantle',
          limbSets: [
            {
              type: 'tentacle',
              count: 8,
              arrangement: 'radial',
              arrangementHint: 'octagonal_radial',
              socketPattern: {
                idTemplate: 'tentacle_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['tentacle'],
                nameTpl: 'tentacle {{index}}',
              },
            },
          ],
          appendages: [
            {
              type: 'head',
              count: 1,
              attachment: 'anterior',
              socketPattern: {
                idTemplate: 'head',
                allowedTypes: ['head'],
                nameTpl: 'head',
              },
            },
          ],
        },
      },
      'anatomy:structure_arachnid_8leg': {
        id: 'anatomy:structure_arachnid_8leg',
        description:
          'Eight-legged arachnid body plan with pedipalps and abdomen attachment',
        topology: {
          rootType: 'cephalothorax',
          limbSets: [
            {
              type: 'leg',
              count: 8,
              arrangement: 'radial',
              arrangementHint: 'four_pairs_bilateral',
              socketPattern: {
                idTemplate: 'leg_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['spider_leg'],
                nameTpl: 'leg {{index}}',
              },
            },
          ],
          appendages: [
            {
              type: 'pedipalp',
              count: 2,
              attachment: 'anterior',
              socketPattern: {
                idTemplate: 'pedipalp_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['spider_pedipalp'],
                nameTpl: 'pedipalp {{index}}',
              },
            },
            {
              type: 'torso',
              count: 1,
              attachment: 'posterior',
              socketPattern: {
                idTemplate: 'posterior_torso',
                allowedTypes: ['spider_abdomen'],
                nameTpl: 'torso',
              },
            },
          ],
        },
      },
      'anatomy:structure_tortoise_biped': {
        id: 'anatomy:structure_tortoise_biped',
        description:
          'Bipedal tortoise body plan with shell, clawed limbs, and beak',
        topology: {
          rootType: 'torso_with_shell',
          limbSets: [
            {
              type: 'arm',
              count: 2,
              arrangement: 'bilateral',
              socketPattern: {
                idTemplate: 'arm_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['tortoise_arm'],
                nameTpl: '{{orientation}} arm',
              },
            },
            {
              type: 'leg',
              count: 2,
              arrangement: 'bilateral',
              socketPattern: {
                idTemplate: 'leg_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['tortoise_leg'],
                nameTpl: '{{orientation}} leg',
              },
            },
          ],
          appendages: [
            {
              type: 'head',
              count: 1,
              attachment: 'anterior',
              socketPattern: {
                idTemplate: 'head',
                allowedTypes: ['tortoise_head'],
                nameTpl: 'head',
              },
            },
            {
              type: 'tail',
              count: 1,
              attachment: 'posterior',
              socketPattern: {
                idTemplate: 'tail',
                allowedTypes: ['tortoise_tail'],
                nameTpl: 'tail',
              },
            },
          ],
        },
      },
    });

    // Load anatomy blueprints
    this.loadBlueprints({
      'anatomy:human_female': {
        id: 'anatomy:human_female',
        root: 'anatomy:human_female_torso',
        compose: [
          {
            part: 'anatomy:humanoid_core',
            include: ['slots', 'clothingSlotMappings'],
          },
        ],
        slots: {
          left_breast: {
            socket: 'left_chest',
            requirements: {
              partType: 'breast',
              components: ['anatomy:part'],
            },
          },
          right_breast: {
            socket: 'right_chest',
            requirements: {
              partType: 'breast',
              components: ['anatomy:part'],
            },
          },
          vagina: {
            socket: 'vagina',
            requirements: {
              partType: 'vagina',
              components: ['anatomy:part'],
            },
          },
          pubic_hair: {
            socket: 'pubic_hair',
            requirements: {
              partType: 'pubic_hair',
              components: ['anatomy:part'],
            },
          },
        },
        clothingSlotMappings: {
          back_accessory: {
            anatomySockets: ['upper_back', 'lower_back'],
            allowedLayers: ['accessory', 'armor'],
          },
          torso_lower: {
            anatomySockets: [
              'left_hip',
              'right_hip',
              'pubic_hair',
              'vagina',
              'asshole',
              'left_ass',
              'right_ass',
            ],
            allowedLayers: ['underwear', 'base', 'outer'],
          },
          full_body: {
            blueprintSlots: [
              'head',
              'left_arm',
              'right_arm',
              'left_leg',
              'right_leg',
              'left_breast',
              'right_breast',
            ],
            allowedLayers: ['outer'],
          },
          torso_upper: {
            anatomySockets: [
              'left_breast',
              'right_breast',
              'left_chest',
              'right_chest',
              'chest_center',
              'left_shoulder',
              'right_shoulder',
            ],
            allowedLayers: ['underwear', 'base', 'outer', 'armor'],
          },
          legs: {
            blueprintSlots: ['left_leg', 'right_leg'],
            allowedLayers: ['base', 'outer'],
          },
          left_arm_clothing: {
            blueprintSlots: ['left_arm'],
            allowedLayers: ['base', 'outer'],
          },
          right_arm_clothing: {
            blueprintSlots: ['right_arm'],
            allowedLayers: ['base', 'outer'],
          },
          feet: {
            blueprintSlots: ['left_foot', 'right_foot'],
            allowedLayers: ['base', 'outer'],
          },
        },
      },
      'anatomy:human_male': {
        id: 'anatomy:human_male',
        root: 'anatomy:human_male_torso',
        compose: [
          {
            part: 'anatomy:humanoid_core',
            include: ['slots', 'clothingSlotMappings'],
          },
        ],
        slots: {
          penis: {
            socket: 'penis',
            requirements: {
              partType: 'penis',
              components: ['anatomy:part'],
            },
          },
          left_testicle: {
            socket: 'left_testicle',
            requirements: {
              partType: 'testicle',
              components: ['anatomy:part'],
            },
          },
          right_testicle: {
            socket: 'right_testicle',
            requirements: {
              partType: 'testicle',
              components: ['anatomy:part'],
            },
          },
          pubic_hair: {
            socket: 'pubic_hair',
            requirements: {
              partType: 'pubic_hair',
              components: ['anatomy:part'],
            },
          },
        },
        clothingSlotMappings: {
          back_accessory: {
            anatomySockets: ['upper_back', 'lower_back'],
            allowedLayers: ['accessory', 'armor'],
          },
          torso_lower: {
            anatomySockets: [
              'left_hip',
              'right_hip',
              'pubic_hair',
              'penis',
              'left_testicle',
              'right_testicle',
              'asshole',
              'left_ass',
              'right_ass',
            ],
            allowedLayers: ['underwear', 'base', 'outer'],
          },
          full_body: {
            blueprintSlots: [
              'head',
              'left_arm',
              'right_arm',
              'left_leg',
              'right_leg',
            ],
            allowedLayers: ['outer'],
          },
          torso_upper: {
            anatomySockets: [
              'left_chest',
              'right_chest',
              'chest_center',
              'left_shoulder',
              'right_shoulder',
            ],
            allowedLayers: ['underwear', 'base', 'outer', 'armor'],
          },
          legs: {
            blueprintSlots: ['left_leg', 'right_leg'],
            allowedLayers: ['base', 'outer'],
          },
          left_arm_clothing: {
            blueprintSlots: ['left_arm'],
            allowedLayers: ['base', 'outer'],
          },
          right_arm_clothing: {
            blueprintSlots: ['right_arm'],
            allowedLayers: ['base', 'outer'],
          },
          feet: {
            blueprintSlots: ['left_foot', 'right_foot'],
            allowedLayers: ['base', 'outer'],
          },
        },
      },
      'anatomy:human_futa': {
        id: 'anatomy:human_futa',
        root: 'anatomy:human_futa_torso',
        compose: [
          {
            part: 'anatomy:humanoid_core',
            include: ['slots', 'clothingSlotMappings'],
          },
        ],
        slots: {
          left_breast: {
            socket: 'left_chest',
            requirements: {
              partType: 'breast',
              components: ['anatomy:part'],
            },
          },
          right_breast: {
            socket: 'right_chest',
            requirements: {
              partType: 'breast',
              components: ['anatomy:part'],
            },
          },
          penis: {
            socket: 'penis',
            requirements: {
              partType: 'penis',
              components: ['anatomy:part'],
            },
          },
          left_testicle: {
            socket: 'left_testicle',
            requirements: {
              partType: 'testicle',
              components: ['anatomy:part'],
            },
          },
          right_testicle: {
            socket: 'right_testicle',
            requirements: {
              partType: 'testicle',
              components: ['anatomy:part'],
            },
          },
        },
        clothingSlotMappings: {
          back_accessory: {
            anatomySockets: ['upper_back', 'lower_back'],
            allowedLayers: ['accessory', 'armor'],
          },
          torso_lower: {
            anatomySockets: [
              'left_hip',
              'right_hip',
              'pubic_hair',
              'penis',
              'left_testicle',
              'right_testicle',
            ],
            allowedLayers: ['underwear', 'base', 'outer'],
          },
          full_body: {
            blueprintSlots: [
              'head',
              'left_arm',
              'right_arm',
              'left_leg',
              'right_leg',
              'left_breast',
              'right_breast',
            ],
            allowedLayers: ['outer'],
          },
          torso_upper: {
            anatomySockets: [
              'left_breast',
              'right_breast',
              'left_chest',
              'right_chest',
              'chest_center',
              'left_shoulder',
              'right_shoulder',
            ],
            allowedLayers: ['underwear', 'base', 'outer', 'armor'],
          },
          legs: {
            blueprintSlots: ['left_leg', 'right_leg'],
            allowedLayers: ['base', 'outer'],
          },
          left_arm_clothing: {
            blueprintSlots: ['left_arm'],
            allowedLayers: ['base', 'outer'],
          },
          right_arm_clothing: {
            blueprintSlots: ['right_arm'],
            allowedLayers: ['base', 'outer'],
          },
          feet: {
            blueprintSlots: ['left_foot', 'right_foot'],
            allowedLayers: ['base', 'outer'],
          },
        },
      },
      // Kraken blueprint for cephalopods
      'anatomy:kraken': {
        id: 'anatomy:kraken',
        schemaVersion: '2.0',
        root: 'anatomy:kraken_mantle',
        structureTemplate: 'anatomy:structure_octopoid',
        additionalSlots: {
          ink_sac: {
            socket: 'ink_sac',
            requirements: {
              partType: 'ink_reservoir',
              components: ['anatomy:part'],
            },
          },
          beak: {
            socket: 'beak',
            requirements: {
              partType: 'beak',
              components: ['anatomy:part'],
            },
            optional: true,
          },
        },
      },
      // Spider blueprint for arachnids
      'anatomy:giant_spider': {
        id: 'anatomy:giant_spider',
        schemaVersion: '2.0',
        root: 'anatomy:spider_cephalothorax',
        structureTemplate: 'anatomy:structure_arachnid_8leg',
        additionalSlots: {
          venom_gland: {
            socket: 'venom_gland',
            requirements: {
              partType: 'venom_gland',
              components: ['anatomy:part', 'anatomy:venom'],
            },
            optional: true,
          },
          spinnerets: {
            socket: 'spinnerets',
            requirements: {
              partType: 'spinneret',
              components: ['anatomy:part'],
            },
          },
        },
      },
      // Tortoise person blueprint
      'anatomy:tortoise_person': {
        id: 'anatomy:tortoise_person',
        schemaVersion: '2.0',
        root: 'anatomy:tortoise_torso_with_shell',
        structureTemplate: 'anatomy:structure_tortoise_biped',
        additionalSlots: {
          shell_upper: {
            socket: 'carapace_mount',
            requirements: {
              partType: 'shell_carapace',
              components: ['anatomy:part'],
            },
          },
          shell_lower: {
            socket: 'plastron_mount',
            requirements: {
              partType: 'shell_plastron',
              components: ['anatomy:part'],
            },
          },
          left_hand: {
            parent: 'arm_left',
            socket: 'hand',
            requirements: {
              partType: 'tortoise_hand',
              components: ['anatomy:part'],
            },
          },
          right_hand: {
            parent: 'arm_right',
            socket: 'hand',
            requirements: {
              partType: 'tortoise_hand',
              components: ['anatomy:part'],
            },
          },
          left_foot: {
            parent: 'leg_left',
            socket: 'foot',
            requirements: {
              partType: 'tortoise_foot',
              components: ['anatomy:part'],
            },
          },
          right_foot: {
            parent: 'leg_right',
            socket: 'foot',
            requirements: {
              partType: 'tortoise_foot',
              components: ['anatomy:part'],
            },
          },
          left_eye: {
            parent: 'head',
            socket: 'left_eye',
            requirements: {
              partType: 'tortoise_eye',
              components: ['anatomy:part'],
            },
          },
          right_eye: {
            parent: 'head',
            socket: 'right_eye',
            requirements: {
              partType: 'tortoise_eye',
              components: ['anatomy:part'],
            },
          },
          beak: {
            parent: 'head',
            socket: 'beak_mount',
            requirements: {
              partType: 'tortoise_beak',
              components: ['anatomy:part'],
            },
          },
        },
      },
    });

    // Load anatomy recipes
    this.loadRecipes({
      'anatomy:human_female_balanced': {
        recipeId: 'anatomy:human_female_balanced',
        blueprintId: 'anatomy:human_female',
        slots: {
          torso: {
            partType: 'torso',
            preferId: 'anatomy:human_female_torso',
          },
          head: {
            partType: 'head',
            preferId: 'anatomy:humanoid_head',
          },
          left_eye: {
            partType: 'eye',
            preferId: 'anatomy:human_eye_amber',
          },
          right_eye: {
            partType: 'eye',
            preferId: 'anatomy:human_eye_amber',
          },
          hair: {
            partType: 'hair',
            preferId: 'anatomy:human_hair_blonde',
          },
        },
        patterns: [
          {
            matches: ['left_arm', 'right_arm'],
            partType: 'arm',
            preferId: 'anatomy:humanoid_arm',
          },
          {
            matches: ['left_leg', 'right_leg'],
            partType: 'leg',
            preferId: 'anatomy:human_leg_shapely',
          },
          {
            matches: ['left_breast', 'right_breast'],
            partType: 'breast',
            preferId: 'anatomy:human_breast_g_cup',
          },
          {
            matches: ['left_hand', 'right_hand'],
            partType: 'hand',
            preferId: 'anatomy:human_hand',
          },
          {
            matches: ['left_foot', 'right_foot'],
            partType: 'foot',
            preferId: 'anatomy:human_foot',
          },
          {
            matches: ['vagina'],
            partType: 'vagina',
            preferId: 'anatomy:human_vagina',
          },
          {
            matches: ['pubic_hair'],
            partType: 'pubic_hair',
            preferId: 'anatomy:human_pubic_hair',
          },
        ],
      },
      'anatomy:human_male_balanced': {
        recipeId: 'anatomy:human_male_balanced',
        blueprintId: 'anatomy:human_male',
        slots: {
          torso: {
            partType: 'torso',
            preferId: 'anatomy:human_male_torso',
          },
          head: {
            partType: 'head',
            preferId: 'anatomy:humanoid_head',
          },
        },
        patterns: [
          {
            matches: ['left_arm', 'right_arm'],
            partType: 'arm',
            preferId: 'anatomy:humanoid_arm',
          },
          {
            matches: ['left_leg', 'right_leg'],
            partType: 'leg',
            preferId: 'anatomy:human_leg',
          },
          {
            matches: ['left_hand', 'right_hand'],
            partType: 'hand',
            preferId: 'anatomy:human_hand',
          },
          {
            matches: ['left_foot', 'right_foot'],
            partType: 'foot',
            preferId: 'anatomy:human_foot',
          },
          {
            matches: ['penis'],
            partType: 'penis',
            preferId: 'anatomy:human_penis',
          },
          {
            matches: ['left_testicle', 'right_testicle'],
            partType: 'testicle',
            preferId: 'anatomy:human_testicle',
          },
          {
            matches: ['pubic_hair'],
            partType: 'pubic_hair',
            preferId: 'anatomy:human_pubic_hair',
          },
        ],
      },
      'anatomy:human_female': {
        recipeId: 'anatomy:human_female',
        blueprintId: 'anatomy:human_female',
        slots: {
          torso: {
            partType: 'torso',
            preferId: 'anatomy:human_female_torso',
          },
          head: {
            partType: 'head',
            preferId: 'anatomy:humanoid_head',
          },
        },
        patterns: [
          {
            matches: ['left_arm', 'right_arm'],
            partType: 'arm',
            preferId: 'anatomy:humanoid_arm',
          },
          {
            matches: ['left_leg', 'right_leg'],
            partType: 'leg',
            preferId: 'anatomy:human_leg',
          },
          {
            matches: ['left_hand', 'right_hand'],
            partType: 'hand',
            preferId: 'anatomy:human_hand',
          },
          {
            matches: ['left_foot', 'right_foot'],
            partType: 'foot',
            preferId: 'anatomy:human_foot',
          },
        ],
      },
      'anatomy:human_male': {
        recipeId: 'anatomy:human_male',
        blueprintId: 'anatomy:human_male',
        slots: {
          torso: {
            partType: 'torso',
            preferId: 'anatomy:human_male_torso',
          },
          head: {
            partType: 'head',
            preferId: 'anatomy:humanoid_head',
          },
        },
        patterns: [
          {
            matches: ['left_arm', 'right_arm'],
            partType: 'arm',
            preferId: 'anatomy:humanoid_arm',
          },
          {
            matches: ['left_leg', 'right_leg'],
            partType: 'leg',
            preferId: 'anatomy:human_leg',
          },
          {
            matches: ['left_hand', 'right_hand'],
            partType: 'hand',
            preferId: 'anatomy:human_hand',
          },
          {
            matches: ['left_foot', 'right_foot'],
            partType: 'foot',
            preferId: 'anatomy:human_foot',
          },
          {
            matches: ['penis'],
            partType: 'penis',
            preferId: 'anatomy:human_penis',
          },
          {
            matches: ['left_testicle', 'right_testicle'],
            partType: 'testicle',
            preferId: 'anatomy:human_testicle',
          },
          {
            matches: ['pubic_hair'],
            partType: 'pubic_hair',
            preferId: 'anatomy:human_pubic_hair',
          },
        ],
      },
      'anatomy:human_futa': {
        recipeId: 'anatomy:human_futa',
        blueprintId: 'anatomy:human_futa',
        bodyDescriptors: {
          build: 'shapely',
          composition: 'average',
          skinColor: 'fair',
        },
        slots: {
          torso: {
            partType: 'torso',
            preferId: 'anatomy:human_futa_torso',
          },
          head: {
            partType: 'head',
            preferId: 'anatomy:humanoid_head',
          },
        },
        patterns: [
          {
            matches: ['left_arm', 'right_arm'],
            partType: 'arm',
            preferId: 'anatomy:humanoid_arm',
          },
          {
            matches: ['left_leg', 'right_leg'],
            partType: 'leg',
            preferId: 'anatomy:human_leg',
          },
          {
            matches: ['left_breast', 'right_breast'],
            partType: 'breast',
            preferId: 'anatomy:human_breast',
          },
          {
            matches: ['left_testicle', 'right_testicle'],
            partType: 'testicle',
            preferId: 'anatomy:human_testicle',
          },
        ],
      },
      // Cephalopod recipes
      'anatomy:kraken_elder': {
        recipeId: 'anatomy:kraken_elder',
        blueprintId: 'anatomy:kraken',
        bodyDescriptors: {
          build: 'hulking',
          composition: 'average',
          hairDensity: 'hairless',
        },
        slots: {
          root: {
            partType: 'mantle',
            properties: {
              'descriptors:size_category': {
                size: 'massive',
              },
              'descriptors:color_extended': {
                color: 'abyssal-black',
              },
              'descriptors:texture': {
                texture: 'smooth',
              },
              'descriptors:shape_general': {
                shape: 'oval',
              },
            },
          },
          ink_sac: {
            partType: 'ink_reservoir',
            tags: ['anatomy:part'],
          },
          beak: {
            partType: 'beak',
            tags: ['anatomy:part'],
          },
        },
        patterns: [
          {
            matchesGroup: 'limbSet:tentacle',
            partType: 'tentacle',
            tags: ['anatomy:part'],
            properties: {
              'descriptors:size_category': {
                size: 'enormous',
              },
              'descriptors:length_category': {
                length: 'extremely-long',
              },
              'descriptors:texture': {
                texture: 'suckered',
              },
              'descriptors:color_extended': {
                color: 'dark-purple',
              },
              'descriptors:shape_general': {
                shape: 'cylindrical',
              },
            },
          },
          {
            matchesGroup: 'appendage:head',
            partType: 'head',
            tags: ['anatomy:part'],
          },
        ],
        constraints: {
          requires: [
            {
              partTypes: ['tentacle', 'ink_reservoir'],
            },
          ],
        },
      },
      'anatomy:squid_common': {
        recipeId: 'anatomy:squid_common',
        blueprintId: 'anatomy:kraken',
        bodyDescriptors: {
          build: 'slim',
          composition: 'lean',
          hairDensity: 'hairless',
        },
        slots: {
          root: {
            partType: 'mantle',
          },
          ink_sac: {
            partType: 'ink_reservoir',
            tags: ['anatomy:part'],
          },
          beak: {
            partType: 'beak',
            tags: ['anatomy:part'],
          },
        },
        patterns: [
          {
            matchesGroup: 'limbSet:tentacle',
            partType: 'tentacle',
            tags: ['anatomy:part'],
          },
          {
            matchesGroup: 'appendage:head',
            partType: 'head',
            tags: ['anatomy:part'],
          },
        ],
        constraints: {
          requires: [
            {
              partTypes: ['tentacle', 'ink_reservoir'],
            },
          ],
        },
      },
      'anatomy:octopus_common': {
        recipeId: 'anatomy:octopus_common',
        blueprintId: 'anatomy:kraken',
        bodyDescriptors: {
          build: 'stocky',
          composition: 'lean',
          hairDensity: 'hairless',
        },
        slots: {
          root: {
            partType: 'mantle',
          },
          ink_sac: {
            partType: 'ink_reservoir',
            tags: ['anatomy:part'],
          },
          beak: {
            partType: 'beak',
            tags: ['anatomy:part'],
          },
        },
        patterns: [
          {
            matchesGroup: 'limbSet:tentacle',
            partType: 'tentacle',
            tags: ['anatomy:part'],
          },
          {
            matchesGroup: 'appendage:head',
            partType: 'head',
            tags: ['anatomy:part'],
          },
        ],
        constraints: {
          requires: [
            {
              partTypes: ['tentacle', 'ink_reservoir'],
            },
          ],
        },
      },
      // Spider recipe
      'anatomy:giant_forest_spider': {
        recipeId: 'anatomy:giant_forest_spider',
        blueprintId: 'anatomy:giant_spider',
        bodyDescriptors: {
          build: 'athletic',
          hairDensity: 'hairy',
          composition: 'lean',
        },
        slots: {
          spinnerets: {
            partType: 'spinneret',
            tags: ['anatomy:part'],
            properties: {
              'descriptors:texture': {
                texture: 'chitinous',
              },
              'descriptors:body_hair': {
                hairDensity: 'hairy',
              },
            },
          },
        },
        patterns: [
          {
            matchesGroup: 'limbSet:leg',
            partType: 'spider_leg',
            tags: ['anatomy:part'],
            properties: {
              'descriptors:texture': {
                texture: 'chitinous',
              },
              'descriptors:body_hair': {
                hairDensity: 'hairy',
              },
            },
          },
          {
            matchesGroup: 'appendage:pedipalp',
            partType: 'spider_pedipalp',
            tags: ['anatomy:part'],
            properties: {},
          },
          {
            matchesGroup: 'appendage:torso',
            partType: 'spider_abdomen',
            tags: ['anatomy:part'],
            properties: {
              'descriptors:texture': {
                texture: 'ridged',
              },
            },
          },
        ],
        constraints: {
          requires: [
            {
              partTypes: ['spider_abdomen', 'spinneret'],
            },
          ],
        },
      },
      // Tortoise person recipe
      'anatomy:tortoise_person': {
        recipeId: 'anatomy:tortoise_person',
        blueprintId: 'anatomy:tortoise_person',
        bodyDescriptors: {
          height: 'short',
          build: 'stocky',
          composition: 'average',
          hairDensity: 'hairless',
          skinColor: 'olive-green',
          smell: 'earthy',
        },
        slots: {
          shell_upper: {
            partType: 'shell_carapace',
            preferId: 'anatomy:tortoise_carapace',
            properties: {
              'descriptors:texture': { texture: 'scaled' },
              'descriptors:pattern': { pattern: 'hexagonal-scutes' },
              'descriptors:color_extended': { color: 'bronze' },
            },
          },
          shell_lower: {
            partType: 'shell_plastron',
            preferId: 'anatomy:tortoise_plastron',
            properties: {
              'descriptors:texture': { texture: 'smooth' },
              'descriptors:color_extended': { color: 'cream' },
            },
          },
          head: {
            partType: 'tortoise_head',
            preferId: 'anatomy:tortoise_head',
            properties: {
              'descriptors:texture': { texture: 'scaled' },
            },
          },
          tail: {
            partType: 'tortoise_tail',
            preferId: 'anatomy:tortoise_tail',
          },
        },
        patterns: [
          {
            matchesGroup: 'limbSet:arm',
            partType: 'tortoise_arm',
            preferId: 'anatomy:tortoise_arm',
            properties: {
              'descriptors:texture': { texture: 'scaled' },
            },
          },
          {
            matchesGroup: 'limbSet:leg',
            partType: 'tortoise_leg',
            preferId: 'anatomy:tortoise_leg',
            properties: {
              'descriptors:texture': { texture: 'scaled' },
              'descriptors:build': { build: 'stocky' },
            },
          },
          {
            matches: ['left_hand'],
            partType: 'tortoise_hand',
            preferId: 'anatomy:tortoise_hand',
            properties: {
              'descriptors:digit_count': { count: '3' },
              'descriptors:projection': { projection: 'clawed' },
            },
          },
          {
            matches: ['right_hand'],
            partType: 'tortoise_hand',
            preferId: 'anatomy:tortoise_hand',
            properties: {
              'descriptors:digit_count': { count: '3' },
              'descriptors:projection': { projection: 'clawed' },
            },
          },
          {
            matches: ['left_foot'],
            partType: 'tortoise_foot',
            preferId: 'anatomy:tortoise_foot',
            properties: {
              'descriptors:digit_count': { count: '3' },
              'descriptors:projection': { projection: 'clawed' },
            },
          },
          {
            matches: ['right_foot'],
            partType: 'tortoise_foot',
            preferId: 'anatomy:tortoise_foot',
            properties: {
              'descriptors:digit_count': { count: '3' },
              'descriptors:projection': { projection: 'clawed' },
            },
          },
          {
            matches: ['left_eye', 'right_eye'],
            partType: 'tortoise_eye',
            preferId: 'anatomy:tortoise_eye',
            properties: {
              'descriptors:color_extended': { color: 'amber' },
            },
          },
          {
            matches: ['beak'],
            partType: 'tortoise_beak',
            preferId: 'anatomy:tortoise_beak',
            properties: {},
          },
        ],
        constraints: {
          requires: [
            { partTypes: ['shell_carapace', 'shell_plastron'] },
            { partTypes: ['tortoise_beak'] },
            { partTypes: ['tortoise_eye'] },
          ],
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
   * Gets a slot library by ID
   *
   * @param {string} id - The slot library ID
   * @returns {object} The slot library data
   */
  getSlotLibrary(id) {
    return this.registry.get('anatomySlotLibraries', id);
  }

  /**
   * Gets a blueprint part by ID
   *
   * @param {string} id - The blueprint part ID
   * @returns {object} The blueprint part data
   */
  getPart(id) {
    return this.registry.get('anatomyBlueprintParts', id);
  }

  /**
   * Gets a blueprint by ID
   *
   * @param {string} id - The blueprint ID
   * @returns {object} The blueprint data
   */
  getBlueprint(id) {
    return this.registry.get('anatomyBlueprints', id);
  }

  /**
   * Gets an entity definition by ID
   *
   * @param {string} id - The entity definition ID
   * @returns {object|null} The entity definition data, or null if not found
   */
  getEntityDefinition(id) {
    return this.registry.get('entityDefinitions', id) || null;
  }

  /**
   * Creates a test actor with anatomy
   *
   * @returns {Promise<object>} Object with actorId and anatomyId
   */
  async createTestActorWithAnatomy() {
    // Create actor entity
    const actor = this.entityManager.createEntityInstance('core:actor');

    // Add anatomy body component
    this.entityManager.addComponent(actor.id, 'anatomy:body', {
      recipeId: 'anatomy:human_female_balanced',
      bodyParts: [],
    });

    // Generate anatomy
    await this.anatomyGenerationService.generateAnatomyIfNeeded(actor.id);

    // Get the anatomy ID
    const bodyData = this.entityManager.getComponentData(
      actor.id,
      'anatomy:body'
    );
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
    const clothingEntity =
      this.entityManager.createEntityInstance(definitionId);
    return clothingEntity.id;
  }

  /**
   * Creates a test actor without anatomy
   *
   * @returns {Promise<string>} The created actor ID
   */
  async createTestActorWithEmptyAnatomy() {
    const actor = this.entityManager.createEntityInstance('core:actor');

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
        const bodyData = this.entityManager.getComponentData(
          result.actorId,
          'anatomy:body'
        );
        if (bodyData && bodyData.bodyParts) {
          bodyData.bodyParts.push(partId);
          this.entityManager.updateComponent(
            result.actorId,
            'anatomy:body',
            bodyData
          );
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
   * Creates an actor entity with the specified recipe
   * This method is used by integration tests to create actors for anatomy generation
   *
   * @param {object} options - Configuration options
   * @param {string} options.recipeId - The recipe ID to use for anatomy generation
   * @returns {Promise<object>} The created actor entity
   */
  async createActor({ recipeId }) {
    // Ensure we have the anatomy mod data loaded
    if (!this.registry.get('anatomyRecipes', recipeId)) {
      await this.loadAnatomyModData();
    }

    // Create the actor entity
    const actor = await this.entityManager.createEntityInstance('core:actor');

    // Add the anatomy:body component with the recipe
    await this.entityManager.addComponent(actor.id, 'anatomy:body', {
      recipeId: recipeId,
    });

    return actor;
  }

  /**
   * Validates an entity definition through basic structural checks
   *
   * @param {string} entityId - The entity definition ID to validate
   * @returns {Promise<object>} Validation result with isValid and errors properties
   */
  async validateEntityDefinition(entityId) {
    const entityDef = this.getEntityDefinition(entityId);

    if (!entityDef) {
      return {
        isValid: false,
        errors: [`Entity definition '${entityId}' not found in registry`],
      };
    }

    // Basic structural validation
    const errors = [];

    if (!entityDef.id) {
      errors.push('Entity definition missing id property');
    }

    if (!entityDef.description) {
      errors.push('Entity definition missing description property');
    }

    if (!entityDef.components || typeof entityDef.components !== 'object') {
      errors.push('Entity definition missing or invalid components property');
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
    };
  }

  /**
   * Creates a character from a recipe using the anatomy generation system
   *
   * @param {string} recipeId - The recipe ID to use for character creation
   * @returns {Promise<string>} The created character entity ID
   */
  async createCharacterFromRecipe(recipeId) {
    // Create the actor entity with the recipe
    const actor = await this.createActor({ recipeId });

    // Generate anatomy for the actor
    await this.anatomyGenerationService.generateAnatomyIfNeeded(actor.id);

    return actor.id;
  }

  /**
   * Gets the equipment data for a character
   *
   * @param {string} characterId - The character entity ID
   * @returns {object|null} The character's equipment component data or null if not found
   */
  getCharacterEquipment(characterId) {
    return this.entityManager.getComponentData(
      characterId,
      'clothing:equipment'
    );
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
            sockets: [{ id: 'torso_socket', type: 'attachment' }],
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
    // Clear entity manager first
    if (this.entityManager?.clearAll) {
      this.entityManager.clearAll();
    }

    // Clear data registry to prevent state pollution between tests
    if (this.registry?.clear) {
      this.registry.clear();
    }

    // Clear any anatomy-specific services that might retain state
    if (this.bodyGraphService?.clearCache) {
      this.bodyGraphService.clearCache();
    }

    // Clear anatomyClothingCache
    if (this.anatomyClothingCache?.clear) {
      this.anatomyClothingCache.clear();
    }

    await super._afterCleanup();
  }
}
