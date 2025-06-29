import EntityManager from '../../../src/entities/entityManager.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { AnatomyGenerationService } from '../../../src/anatomy/anatomyGenerationService.js';
import { BodyBlueprintFactory } from '../../../src/anatomy/bodyBlueprintFactory.js';
import { GraphIntegrityValidator } from '../../../src/anatomy/graphIntegrityValidator.js';
import {
  createMockLogger,
  createMockSafeEventDispatcher,
  createMockSchemaValidator,
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
      dataRegistry: mocks.registry,
      logger: mocks.logger,
    });

    // Create body blueprint factory
    this.bodyBlueprintFactory = new BodyBlueprintFactory({
      entityManager: this.entityManager,
      dataRegistry: mocks.registry,
      logger: mocks.logger,
      eventDispatcher: mocks.eventDispatcher,
      idGenerator: mocks.idGenerator,
      validator: this.validator,
    });

    // Create anatomy generation service
    this.anatomyGenerationService = new AnatomyGenerationService({
      entityManager: this.entityManager,
      dataRegistry: mocks.registry,
      logger: mocks.logger,
      bodyBlueprintFactory: this.bodyBlueprintFactory,
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