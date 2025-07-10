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
        const partType = partEntity?.getComponentData?.('anatomy:part')?.subType || 'part';
        return `A ${partType} part`;
      },
    };

    this.mockAnatomyFormattingService = {
      formatDescription: (desc) => desc,
    };

    this.mockPartDescriptionGenerator = {
      generateDescription: (partEntity) => {
        if (!partEntity) return 'A body part';
        const partType = partEntity.getComponentData?.('anatomy:part')?.subType || 'body part';
        const description = `A human ${partType}`;
        
        // Actually add the description component to the entity
        if (this.entityManager && this.entityManager.addComponent) {
          this.entityManager.addComponent(partEntity.id, 'core:description', { text: description });
        }
        
        return description;
      },
      generatePartDescription: (partId) => {
        const partEntity = this.entityManager.getEntityInstance(partId);
        if (!partEntity) return 'A body part';
        const partType = partEntity.getComponentData?.('anatomy:part')?.subType || 'body part';
        const description = `A human ${partType}`;
        
        // Actually add the description component to the entity
        if (this.entityManager && this.entityManager.addComponent) {
          this.entityManager.addComponent(partEntity.id, 'core:description', { text: description });
        }
        
        return description;
      },
      generateMultiplePartDescriptions: (partIds) => {
        const descriptions = new Map();
        for (const partId of partIds) {
          const partEntity = this.entityManager.getEntityInstance(partId);
          if (partEntity) {
            const description = this.mockPartDescriptionGenerator.generateDescription(partEntity);
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
   *
   * @param {object} blueprints - Map of blueprint ID to blueprint data
   */
  loadBlueprints(blueprints) {
    for (const [id, data] of Object.entries(blueprints)) {
      this.registry.store('anatomyBlueprints', id, data);
    }
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
