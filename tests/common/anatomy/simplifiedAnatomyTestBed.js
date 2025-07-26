/**
 * @file Simplified test bed for anatomy integration tests that avoids module loading issues
 */

import EntityManager from '../../../src/entities/entityManager.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { AnatomyDescriptionService } from '../../../src/anatomy/anatomyDescriptionService.js';
import { DescriptionPersistenceService } from '../../../src/anatomy/DescriptionPersistenceService.js';
import { BodyGraphService } from '../../../src/anatomy/bodyGraphService.js';
import {
  createMockLogger,
  createMockSafeEventDispatcher,
  createMockSchemaValidator,
  createMockEventDispatchService,
} from '../mockFactories/index.js';
import UuidGenerator from '../../../src/adapters/UuidGenerator.js';
import BaseTestBed from '../baseTestBed.js';

/**
 * Simplified test bed that creates services on-demand to avoid module loading issues
 */
export default class SimplifiedAnatomyTestBed extends BaseTestBed {
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

    // Store mocks for later use
    this.mocks = mocks;
  }

  /**
   * Create anatomy description service with minimal dependencies
   */
  async createAnatomyDescriptionService(options = {}) {
    // Create body graph service if not provided
    const bodyGraphService = options.bodyGraphService || new BodyGraphService({
      entityManager: this.entityManager,
      logger: this.mocks.logger,
      eventDispatcher: this.mocks.eventDispatcher,
    });

    // Create mock component manager
    const mockComponentManager = options.componentManager || {
      addComponent: (entityId, componentId, data) => {
        if (entityId && this.entityManager.getEntityInstance(entityId)) {
          this.entityManager.addComponent(entityId, componentId, data);
        }
      },
      updateComponent: (entityId, componentId, data) => {
        if (entityId && this.entityManager.getEntityInstance(entityId)) {
          this.entityManager.updateComponent(entityId, componentId, data);
        }
      },
    };

    // Create mock body part description builder
    const mockBodyPartDescriptionBuilder = options.bodyPartDescriptionBuilder || {
      buildDescription: (partEntity) => {
        const partType =
          partEntity?.getComponentData?.('anatomy:part')?.subType || 'part';
        return `A ${partType} part`;
      },
    };

    // Create mock body description composer
    const mockBodyDescriptionComposer = options.bodyDescriptionComposer || {
      composeDescription: async (entity) => {
        const name = entity?.getComponentData?.('core:name')?.text || 'entity';
        return `A body description for ${name}`;
      },
    };

    // Create mock part description generator
    const mockPartDescriptionGenerator = options.partDescriptionGenerator || {
      generatePartDescription: (partId) => {
        return `Description for part ${partId}`;
      },
      generateMultiplePartDescriptions: (partIds) => {
        const descriptions = new Map();
        for (const partId of partIds) {
          descriptions.set(partId, `Description for part ${partId}`);
        }
        return descriptions;
      },
    };

    // Create persistence service if requested
    const descriptionPersistenceService = options.withPersistence
      ? new DescriptionPersistenceService({
          entityManager: this.entityManager,
          logger: this.mocks.logger,
          eventBus: this.mocks.eventDispatcher,
        })
      : null;

    // Use provided eventDispatchService or default
    const eventDispatchService = options.eventDispatchService || this.mocks.eventDispatchService;

    // Create anatomy description service
    return new AnatomyDescriptionService({
      bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
      bodyDescriptionComposer: mockBodyDescriptionComposer,
      bodyGraphService,
      entityFinder: this.entityManager,
      componentManager: mockComponentManager,
      eventDispatchService,
      partDescriptionGenerator: mockPartDescriptionGenerator,
      descriptionPersistenceService,
      // Don't include bodyDescriptionOrchestrator unless explicitly provided
      bodyDescriptionOrchestrator: options.bodyDescriptionOrchestrator,
    });
  }

  /**
   * Helper to load minimal component definitions
   */
  loadMinimalComponents() {
    this.loadComponents({
      'core:name': {
        id: 'core:name',
        dataSchema: {
          type: 'object',
          properties: { text: { type: 'string' } },
          required: ['text'],
        },
      },
      'core:description': {
        id: 'core:description',
        dataSchema: {
          type: 'object',
          properties: { text: { type: 'string' } },
          required: ['text'],
        },
      },
      'anatomy:body': {
        id: 'anatomy:body',
        dataSchema: {
          type: 'object',
          properties: {
            body: { type: ['object', 'null'], nullable: true },
            recipeId: { type: 'string' },
          },
        },
      },
      'anatomy:part': {
        id: 'anatomy:part',
        dataSchema: {
          type: 'object',
          properties: { subType: { type: 'string' } },
          required: ['subType'],
        },
      },
    });
  }

  /**
   * Helper to load minimal entity definitions
   */
  loadMinimalEntityDefinitions() {
    this.loadEntityDefinitions({
      'core:actor': {
        id: 'core:actor',
        description: 'A basic actor entity',
        components: {
          'core:name': {},
          'anatomy:body': {},
        },
      },
      'anatomy:humanoid_arm': {
        id: 'anatomy:humanoid_arm',
        description: 'A humanoid arm',
        components: {
          'anatomy:part': { subType: 'arm' },
          'core:name': { text: 'arm' },
        },
      },
    });
  }

  /**
   * Helper to create a test entity with anatomy
   */
  async createTestEntity(hasAnatomy = true) {
    const entity = await this.entityManager.createEntityInstance('core:actor');
    
    if (hasAnatomy) {
      await this.entityManager.addComponent(entity.id, 'anatomy:body', {
        body: { root: 'test-root' },
        recipeId: 'test-recipe',
      });
    }
    
    await this.entityManager.addComponent(entity.id, 'core:name', {
      text: 'Test Entity',
    });
    
    return entity;
  }

  /**
   * Helper method to load components into the registry
   */
  loadComponents(components) {
    for (const [id, data] of Object.entries(components)) {
      this.registry.store('components', id, data);
    }
  }

  /**
   * Helper method to load entity definitions into the registry
   */
  loadEntityDefinitions(entities) {
    for (const [id, data] of Object.entries(entities)) {
      const definition = new EntityDefinition(id || data.id, {
        description: data.description || '',
        components: data.components || {},
      });
      this.registry.store('entityDefinitions', id, definition);
    }
  }

  /**
   * Cleanup after tests
   */
  async _afterCleanup() {
    try {
      // Clear entity manager synchronously
      if (this.entityManager?.clearAll) {
        this.entityManager.clearAll();
      }
      
      // Clear registry synchronously
      if (this.registry?.clear) {
        this.registry.clear();
      }

      // Clear any timers or async operations
      if (typeof jest !== 'undefined') {
        jest.clearAllTimers();
        jest.clearAllMocks();
      }

      // Force garbage collection hint (in Node.js environments with --expose-gc)
      if (typeof global !== 'undefined' && global.gc) {
        global.gc();
      }
    } catch (error) {
      // Log cleanup errors but don't throw to avoid masking test failures
      console.warn('Cleanup error in SimplifiedAnatomyTestBed:', error.message);
    }
    
    await super._afterCleanup();
  }
}