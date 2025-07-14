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
import AnatomyClothingIntegrationService from '../../../src/anatomy/integration/anatomyClothingIntegrationService.js';
import AnatomySocketIndex from '../../../src/anatomy/services/anatomySocketIndex.js';
import ClothingInstantiationService from '../../../src/clothing/services/clothingInstantiationService.js';
import { ClothingSlotValidator } from '../../../src/clothing/validation/clothingSlotValidator.js';
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

    // Create anatomy clothing integration service
    this.anatomyClothingIntegrationService =
      new AnatomyClothingIntegrationService({
        logger: mocks.logger,
        entityManager: this.entityManager,
        bodyGraphService: this.bodyGraphService,
        anatomyBlueprintRepository: {
          getBlueprintByRecipeId: (recipeId) =>
            mocks.registry.get('anatomyBlueprints', recipeId),
          clearCache: () => {},
        },
        anatomySocketIndex: this.anatomySocketIndex,
        clothingSlotValidator: this.clothingSlotValidator,
      });

    // Create mock equipment orchestrator
    this.mockEquipmentOrchestrator = {
      orchestrateEquipment: () =>
        Promise.resolve({ success: true, equipped: [] }),
    };

    // Create clothing instantiation service
    this.clothingInstantiationService = new ClothingInstantiationService({
      entityManager: this.entityManager,
      dataRegistry: mocks.registry,
      equipmentOrchestrator: this.mockEquipmentOrchestrator,
      anatomyClothingIntegrationService: this.anatomyClothingIntegrationService,
      layerResolutionService: this.layerResolutionService,
      logger: mocks.logger,
      eventBus: mocks.eventDispatcher,
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
