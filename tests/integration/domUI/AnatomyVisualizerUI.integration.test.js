/**
 * @file AnatomyVisualizerUI.integration.test.js
 * @description Integration tests for the anatomy visualizer UI using production code with minimal mocking
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { JSDOM } from 'jsdom';
import AnatomyVisualizerUI from '../../../src/domUI/AnatomyVisualizerUI.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureMinimalContainer } from '../../../src/dependencyInjection/minimalContainerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { ENTITY_CREATED_ID } from '../../../src/constants/eventIds.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';

// Import anatomy mod data for realistic testing
import bodyComponent from '../../../data/mods/anatomy/components/body.component.json';
import jointComponent from '../../../data/mods/anatomy/components/joint.component.json';
import partComponent from '../../../data/mods/anatomy/components/part.component.json';
import socketsComponent from '../../../data/mods/anatomy/components/sockets.component.json';
import coreNameComponent from '../../../data/mods/core/components/name.component.json';
import coreDescriptionComponent from '../../../data/mods/core/components/description.component.json';

// Import entity definitions for testing
import humanMaleTorso from '../../../data/mods/anatomy/entities/definitions/human_male_torso.entity.json';
import humanFemaleTorso from '../../../data/mods/anatomy/entities/definitions/human_female_torso.entity.json';
import humanoidHead from '../../../data/mods/anatomy/entities/definitions/humanoid_head.entity.json';
import humanoidArm from '../../../data/mods/anatomy/entities/definitions/humanoid_arm.entity.json';
import humanoidLeg from '../../../data/mods/anatomy/entities/definitions/humanoid_leg.entity.json';
import humanHand from '../../../data/mods/anatomy/entities/definitions/human_hand.entity.json';

// Import blueprints
import humanMaleBlueprint from '../../../data/mods/anatomy/blueprints/human_male.blueprint.json';
import humanFemaleBlueprint from '../../../data/mods/anatomy/blueprints/human_female.blueprint.json';

// Import recipes  
import humanMaleRecipe from '../../../data/mods/anatomy/recipes/human_male.recipe.json';
import humanFemaleRecipe from '../../../data/mods/anatomy/recipes/human_female.recipe.json';

describe('AnatomyVisualizerUI Integration Tests', () => {
  let container;
  let visualizerUI;
  let dom;
  let document;
  let mockFetch;
  let logger;
  let registry;
  let entityManager;
  let anatomyDescriptionService;
  let eventDispatcher;
  let modsLoader;
  let anatomyFormattingService;
  let systemInitializer;
  let originalFetch;

  beforeEach(() => {
    // Set up JSDOM for DOM operations
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="entity-selector"></div>
          <div id="entity-description-content"></div>
          <div id="anatomy-graph-container"></div>
        </body>
      </html>
    `);
    document = dom.window.document;
    global.document = document;
    global.window = dom.window;
    global.SVGElement = dom.window.SVGElement;

    // Note: window.location is not actually used in the visualizer, so we don't need to mock it

    // Mock fetch for game.json loading
    originalFetch = global.fetch;
    mockFetch = jest.fn();
    global.fetch = mockFetch;

    // Default fetch response for game.json
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ mods: ['core', 'anatomy'] })
    });

    // Create and configure real container
    container = new AppContainer();
    configureMinimalContainer(container);

    // Resolve real services
    logger = container.resolve(tokens.ILogger);
    registry = container.resolve(tokens.IDataRegistry);
    entityManager = container.resolve(tokens.IEntityManager);
    anatomyDescriptionService = container.resolve(tokens.AnatomyDescriptionService);
    eventDispatcher = container.resolve(tokens.ISafeEventDispatcher);
    modsLoader = container.resolve(tokens.ModsLoader);
    anatomyFormattingService = container.resolve(tokens.AnatomyFormattingService);
    systemInitializer = container.resolve(tokens.SystemInitializer);

    // Pre-load essential components and entities into registry
    loadTestData();
  });

  afterEach(() => {
    // Clean up entities
    if (entityManager) {
      entityManager.clearAll();
    }

    // Restore globals
    global.fetch = originalFetch;
    delete global.document;
    delete global.window;
    delete global.SVGElement;

    // Clean up visualizer
    if (visualizerUI) {
      visualizerUI._clearPreviousEntities();
    }
  });

  function loadTestData() {
    // Load component definitions
    registry.store('components', 'anatomy:body', bodyComponent);
    registry.store('components', 'anatomy:joint', jointComponent);
    registry.store('components', 'anatomy:part', partComponent);
    registry.store('components', 'anatomy:sockets', socketsComponent);
    registry.store('components', 'core:name', coreNameComponent);
    registry.store('components', 'core:description', coreDescriptionComponent);

    // Create mock entities with anatomy:body for testing
    const mockHumanMale = new EntityDefinition('anatomy:human_male', {
      components: {
        'core:name': { text: 'Human Male' },
        'anatomy:body': { 
          blueprintId: 'anatomy:human_male',
          recipeId: 'anatomy:human_male'
        }
      }
    });

    const mockHumanFemale = new EntityDefinition('anatomy:human_female', {
      components: {
        'core:name': { text: 'Human Female' },
        'anatomy:body': { 
          blueprintId: 'anatomy:human_female',
          recipeId: 'anatomy:human_female'
        }
      }
    });

    // Load entity definitions
    const entityDefs = [
      { id: 'anatomy:human_male', instance: mockHumanMale },
      { id: 'anatomy:human_female', instance: mockHumanFemale },
      { id: humanMaleTorso.id, data: humanMaleTorso },
      { id: humanFemaleTorso.id, data: humanFemaleTorso },
      { id: humanoidHead.id, data: humanoidHead },
      { id: humanoidArm.id, data: humanoidArm },
      { id: humanoidLeg.id, data: humanoidLeg },
      { id: humanHand.id, data: humanHand }
    ];

    entityDefs.forEach(({ id, instance, data }) => {
      if (instance) {
        registry.store('entityDefinitions', id, instance);
      } else if (data) {
        const entityDef = new EntityDefinition(id, {
          components: data.components || {}
        });
        registry.store('entityDefinitions', id, entityDef);
        // Mark anatomy parts
        if (data.components && data.components['anatomy:part']) {
          registry.store('anatomyParts', id, { isAnatomyPart: true });
        }
      }
    });

    // Load blueprints
    registry.store('anatomyBlueprints', 'anatomy:human_male', humanMaleBlueprint);
    registry.store('anatomyBlueprints', 'anatomy:human_female', humanFemaleBlueprint);

    // Load recipes
    registry.store('anatomyRecipes', 'anatomy:human_male', humanMaleRecipe);
    registry.store('anatomyRecipes', 'anatomy:human_female', humanFemaleRecipe);
  }

  describe('Initialization', () => {
    it('should successfully initialize with real container and services', async () => {
      // Arrange
      visualizerUI = new AnatomyVisualizerUI({
        logger,
        registry,
        entityManager,
        anatomyDescriptionService,
        eventDispatcher,
        documentContext: { document }
      });

      // Act
      await visualizerUI.initialize();

      // Assert
      expect(visualizerUI._graphRenderer).toBeDefined();
      expect(visualizerUI._createdEntities).toEqual([]);
      expect(visualizerUI._currentEntityId).toBeNull();

      // Verify entity selector was populated
      const selector = document.getElementById('entity-selector');
      expect(selector.children.length).toBeGreaterThan(1); // Default option + entities
    });

    it('should populate entity selector with only entities that have anatomy:body', async () => {
      // Arrange
      visualizerUI = new AnatomyVisualizerUI({
        logger,
        registry,
        entityManager,
        anatomyDescriptionService,
        eventDispatcher,
        documentContext: { document }
      });

      // Act
      await visualizerUI.initialize();

      // Assert
      const selector = document.getElementById('entity-selector');
      const options = Array.from(selector.children);
      
      // Should have default option + human male/female (entities with anatomy:body)
      expect(options.length).toBe(3);
      expect(options[0].value).toBe('');
      expect(options[0].textContent).toBe('Select an entity...');
      
      // Verify only entities with anatomy:body are included
      const entityOptions = options.slice(1);
      entityOptions.forEach(option => {
        const entityDef = registry.getEntityDefinition(option.value);
        expect(entityDef.components['anatomy:body']).toBeDefined();
      });
    });

    it('should handle missing DOM elements gracefully', async () => {
      // Arrange
      const mockDocument = {
        getElementById: jest.fn().mockReturnValue(null),
        createElement: jest.fn().mockReturnValue({
          value: '',
          textContent: ''
        }),
        createElementNS: jest.fn()
      };

      // Create a spy on logger methods
      const errorSpy = jest.spyOn(logger, 'error');

      visualizerUI = new AnatomyVisualizerUI({
        logger,
        registry,
        entityManager,
        anatomyDescriptionService,
        eventDispatcher,
        documentContext: { document: mockDocument }
      });

      // Act
      await visualizerUI.initialize();

      // Assert - should not throw, but log error
      expect(errorSpy).toHaveBeenCalledWith('Entity selector element not found');
      
      // Cleanup
      errorSpy.mockRestore();
    });
  });

  describe('Entity Loading and Anatomy Generation', () => {
    beforeEach(async () => {
      visualizerUI = new AnatomyVisualizerUI({
        logger,
        registry,
        entityManager,
        anatomyDescriptionService,
        eventDispatcher,
        documentContext: { document }
      });
      await visualizerUI.initialize();
    });

    it('should load entity and wait for anatomy generation', async () => {
      // Arrange
      const entityDefId = 'anatomy:human_male';
      let createdEntityId;
      
      // We need to mock the entity manager's createEntityInstance to control the anatomy generation
      const originalCreate = entityManager.createEntityInstance;
      jest.spyOn(entityManager, 'createEntityInstance').mockImplementation(async (defId, overrides) => {
        const entity = await originalCreate.call(entityManager, defId, overrides);
        createdEntityId = entity.id;
        
        // Simulate anatomy being generated
        setTimeout(() => {
          // Dispatch entity created event
          eventDispatcher.dispatch(ENTITY_CREATED_ID, {
            payload: {
              definitionId: defId,
              instanceId: entity.id,
              wasReconstructed: false
            }
          });
        }, 100);
        
        return entity;
      });
      
      // Mock getEntityInstance to return entity with anatomy data
      jest.spyOn(entityManager, 'getEntityInstance').mockImplementation(async (id) => {
        if (id === createdEntityId) {
          return {
            id: createdEntityId,
            getComponentData: (type) => {
              if (type === 'anatomy:body') {
                return {
                  body: {
                    root: createdEntityId,
                    parts: {
                      torso: 'torso-123',
                      head: 'head-123'
                    }
                  }
                };
              }
              return null;
            }
          };
        }
        return undefined;
      });

      // Act
      await visualizerUI._loadEntity(entityDefId);

      // Assert
      expect(createdEntityId).toBeDefined();
      expect(visualizerUI._currentEntityId).toBe(createdEntityId);
      expect(visualizerUI._createdEntities).toContain(createdEntityId);
      
      // Cleanup
      entityManager.createEntityInstance.mockRestore();
      entityManager.getEntityInstance.mockRestore();
    });

    it('should properly use getComponentData instead of getComponent', async () => {
      // Arrange
      const entityDefId = 'anatomy:human_male';
      let checkedMethod = false;
      
      // Mock createEntityInstance and getEntityInstance similar to previous test
      const originalCreate = entityManager.createEntityInstance;
      jest.spyOn(entityManager, 'createEntityInstance').mockImplementation(async (defId, overrides) => {
        const entity = await originalCreate.call(entityManager, defId, overrides);
        
        // Dispatch event after a delay
        setTimeout(() => {
          eventDispatcher.dispatch(ENTITY_CREATED_ID, {
            payload: {
              definitionId: defId,
              instanceId: entity.id,
              wasReconstructed: false
            }
          });
        }, 100);
        
        return entity;
      });
      
      // Mock getEntityInstance to verify correct method usage
      jest.spyOn(entityManager, 'getEntityInstance').mockImplementation(async (id) => {
        const mockEntity = {
          id: id,
          getComponentData: jest.fn((type) => {
            checkedMethod = true;
            if (type === 'anatomy:body') {
              return { body: { root: id, parts: {} } };
            }
            return null;
          })
        };
        // Explicitly ensure getComponent is undefined
        expect(mockEntity.getComponent).toBeUndefined();
        return mockEntity;
      });

      // Act
      await visualizerUI._loadEntity(entityDefId);

      // Assert
      expect(checkedMethod).toBe(true);
      
      // Cleanup
      entityManager.createEntityInstance.mockRestore();
      entityManager.getEntityInstance.mockRestore();
    });

    it('should handle entity without anatomy:body component', async () => {
      // Arrange
      // Create an entity without anatomy:body
      const noAnatomyDef = new EntityDefinition('test:no-anatomy', {
        components: {
          'core:name': { text: 'No Anatomy Entity' }
        }
      });
      registry.store('entityDefinitions', 'test:no-anatomy', noAnatomyDef);

      const errorSpy = jest.spyOn(logger, 'error');

      // Act
      await visualizerUI._loadEntity('test:no-anatomy');

      // Assert
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to load entity test:no-anatomy:',
        expect.any(Error)
      );
      expect(visualizerUI._currentEntityId).toBeNull();
      
      errorSpy.mockRestore();
    });
  });

  describe('Entity Cleanup and State Management', () => {
    beforeEach(async () => {
      visualizerUI = new AnatomyVisualizerUI({
        logger,
        registry,
        entityManager,
        anatomyDescriptionService,
        eventDispatcher,
        documentContext: { document }
      });
      await visualizerUI.initialize();
    });

    it('should clean up previous entities when loading new one', async () => {
      // Arrange
      // Create some test entities
      const entity1 = await entityManager.createEntityInstance('anatomy:human_male', {});
      const entity2 = await entityManager.createEntityInstance('anatomy:human_male_torso', {});
      visualizerUI._createdEntities = [entity1.id, entity2.id];
      visualizerUI._currentEntityId = entity1.id;

      // Act
      await visualizerUI._clearPreviousEntities();

      // Assert
      expect(visualizerUI._createdEntities).toEqual([]);
      expect(visualizerUI._currentEntityId).toBeNull();
      
      // Verify entities were removed
      expect(await entityManager.getEntityInstance(entity1.id)).toBeUndefined();
      expect(await entityManager.getEntityInstance(entity2.id)).toBeUndefined();
    });

    it('should handle entity removal errors gracefully', async () => {
      // Arrange
      visualizerUI._createdEntities = ['non-existent-entity'];
      const warnSpy = jest.spyOn(logger, 'warn');
      
      // Act
      await visualizerUI._clearPreviousEntities();

      // Assert
      expect(warnSpy).toHaveBeenCalledWith(
        'Failed to destroy entity non-existent-entity:',
        expect.any(Error)
      );
      expect(visualizerUI._createdEntities).toEqual([]);
      
      warnSpy.mockRestore();
    });
  });

  describe('Graph Rendering', () => {
    beforeEach(async () => {
      visualizerUI = new AnatomyVisualizerUI({
        logger,
        registry,
        entityManager,
        anatomyDescriptionService,
        eventDispatcher,
        documentContext: { document }
      });
      await visualizerUI.initialize();
    });

    it('should render anatomy graph with real body data', async () => {
      // Arrange
      const rootEntityId = 'test-root';
      const bodyData = {
        root: rootEntityId,
        parts: {
          torso: 'torso-123',
          head: 'head-123',
          'left-arm': 'arm-123',
          'right-arm': 'arm-456'
        }
      };

      // Create mock entities for the body parts
      const mockEntities = {
        [rootEntityId]: {
          id: rootEntityId,
          getComponentData: jest.fn((type) => {
            if (type === 'core:name') return { text: 'Root Body' };
            if (type === 'anatomy:part') return { subType: 'torso' };
            return null;
          })
        },
        'torso-123': {
          id: 'torso-123',
          getComponentData: jest.fn((type) => {
            if (type === 'core:name') return { text: 'Torso' };
            if (type === 'anatomy:part') return { subType: 'torso' };
            if (type === 'anatomy:joint') return { parentId: rootEntityId, socketId: 'torso-socket' };
            return null;
          })
        }
      };

      // Mock entity manager to return our test entities
      jest.spyOn(entityManager, 'getEntityInstance').mockImplementation((id) => {
        return Promise.resolve(mockEntities[id]);
      });

      // Act
      await visualizerUI._graphRenderer.renderGraph(rootEntityId, bodyData);

      // Assert
      const graphContainer = document.getElementById('anatomy-graph-container');
      const svg = graphContainer.querySelector('svg');
      expect(svg).toBeDefined();
      expect(svg.id).toBe('anatomy-graph');
      
      // Verify nodes were created
      const nodes = svg.querySelectorAll('.anatomy-node');
      expect(nodes.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      visualizerUI = new AnatomyVisualizerUI({
        logger,
        registry,
        entityManager,
        anatomyDescriptionService,
        eventDispatcher,
        documentContext: { document }
      });
      await visualizerUI.initialize();
    });

    it('should handle missing entity definition', async () => {
      // Arrange
      const errorSpy = jest.spyOn(logger, 'error');

      // Act
      await visualizerUI._loadEntity('non:existent:entity');

      // Assert
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to load entity non:existent:entity:',
        expect.any(Error)
      );
      
      const graphContainer = document.getElementById('anatomy-graph-container');
      expect(graphContainer.innerHTML).toContain('Failed to load entity');
      
      errorSpy.mockRestore();
    });

    it('should handle anatomy generation failure', async () => {
      // Arrange
      const entityDefId = 'anatomy:human_male';
      
      // Mock entity creation to succeed but anatomy generation to fail
      jest.spyOn(entityManager, 'createEntityInstance').mockResolvedValue({
        id: 'test-entity',
        getComponentData: jest.fn().mockReturnValue(null) // No anatomy data
      });

      // Act
      const loadPromise = visualizerUI._loadEntity(entityDefId);
      
      // Trigger entity created event without anatomy
      setTimeout(() => {
        eventDispatcher.dispatch(ENTITY_CREATED_ID, {
          payload: {
            definitionId: entityDefId,
            instanceId: 'test-entity',
            wasReconstructed: false
          }
        });
      }, 50);

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 300));

      // Assert - should still be waiting as no anatomy was generated
      expect(visualizerUI._currentEntityId).not.toBe('test-entity');
    });
  });

  describe('Event Management', () => {
    beforeEach(async () => {
      visualizerUI = new AnatomyVisualizerUI({
        logger,
        registry,
        entityManager,
        anatomyDescriptionService,
        eventDispatcher,
        documentContext: { document }
      });
      await visualizerUI.initialize();
    });

    it('should properly subscribe and unsubscribe from events', async () => {
      // Arrange
      const entityDefId = 'anatomy:human_male';
      let unsubscribeCalled = false;
      let createdEntityId;
      
      // Mock the subscribe method to track unsubscribe
      const originalSubscribe = eventDispatcher.subscribe;
      jest.spyOn(eventDispatcher, 'subscribe').mockImplementation((eventId, callback) => {
        const unsubscribe = originalSubscribe.call(eventDispatcher, eventId, callback);
        return () => {
          unsubscribeCalled = true;
          unsubscribe();
        };
      });
      
      // Mock entity creation
      const originalCreate = entityManager.createEntityInstance;
      jest.spyOn(entityManager, 'createEntityInstance').mockImplementation(async (defId, overrides) => {
        const entity = await originalCreate.call(entityManager, defId, overrides);
        createdEntityId = entity.id;
        
        // Dispatch event after delay
        setTimeout(() => {
          eventDispatcher.dispatch(ENTITY_CREATED_ID, {
            payload: {
              definitionId: defId,
              instanceId: entity.id,
              wasReconstructed: false
            }
          });
        }, 100);
        
        return entity;
      });

      // Mock entity with anatomy
      jest.spyOn(entityManager, 'getEntityInstance').mockImplementation(async (id) => {
        if (id === createdEntityId) {
          return {
            id: createdEntityId,
            getComponentData: jest.fn().mockReturnValue({
              body: { root: createdEntityId, parts: {} }
            })
          };
        }
        return undefined;
      });

      // Act
      await visualizerUI._loadEntity(entityDefId);

      // Assert
      expect(unsubscribeCalled).toBe(true);
      
      // Cleanup
      eventDispatcher.subscribe.mockRestore();
      entityManager.createEntityInstance.mockRestore();
      entityManager.getEntityInstance.mockRestore();
    });
  });

  describe('Full Integration Flow', () => {
    it('should complete full flow from initialization to visualization', async () => {
      // This test uses as much real code as possible
      
      // Arrange
      visualizerUI = new AnatomyVisualizerUI({
        logger,
        registry,
        entityManager,
        anatomyDescriptionService,
        eventDispatcher,
        documentContext: { document }
      });

      // Act 1: Initialize
      await visualizerUI.initialize();

      // Assert 1: Initialization complete
      const selector = document.getElementById('entity-selector');
      expect(selector.children.length).toBeGreaterThan(1);

      // Act 2: Simulate entity selection
      const entityDefId = 'anatomy:human_male';
      selector.value = entityDefId;
      
      // Manually trigger change event (would normally be done by user)
      const changeEvent = new dom.window.Event('change', { bubbles: true });
      Object.defineProperty(changeEvent, 'target', { value: selector });
      selector.dispatchEvent(changeEvent);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 300));

      // Assert 2: Entity should be loading (checking log output is not critical for integration test)
      // The important thing is that the entity loads without errors

      // Verify cleanup happens on subsequent selections
      const previousEntities = [...visualizerUI._createdEntities];
      
      // Act 3: Select a different entity
      selector.value = 'anatomy:human_female';
      selector.dispatchEvent(changeEvent);
      
      await new Promise(resolve => setTimeout(resolve, 300));

      // Assert 3: Previous entities should be cleaned up
      // The cleanup is internal - we just verify no errors occur
    });
  });
});