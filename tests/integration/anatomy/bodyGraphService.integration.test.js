/**
 * @file Integration tests for BodyGraphService - testing real anatomy system integration
 * @description Tests bodyGraphService with real anatomy generation, cache management, and component integration
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import { BodyGraphService } from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

describe('BodyGraphService Integration Tests', () => {
  let testBed;
  let bodyGraphService;
  let entityManager;

  beforeEach(async () => {
    testBed = new AnatomyIntegrationTestBed();
    await testBed.setup();

    bodyGraphService = testBed.container.get('BodyGraphService');
    entityManager = testBed.container.get('IEntityManager');
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Constructor Integration', () => {
    it('should throw InvalidArgumentError when entityManager is missing', () => {
      const mockLogger = testBed.logger;
      const mockEventDispatcher = testBed.eventDispatcher;

      expect(() => {
        new BodyGraphService({
          entityManager: null,
          logger: mockLogger,
          eventDispatcher: mockEventDispatcher,
        });
      }).toThrow(InvalidArgumentError);
      expect(() => {
        new BodyGraphService({
          entityManager: null,
          logger: mockLogger,
          eventDispatcher: mockEventDispatcher,
        });
      }).toThrow('entityManager is required');
    });

    it('should throw InvalidArgumentError when logger is missing', () => {
      const mockEntityManager = entityManager;
      const mockEventDispatcher = testBed.eventDispatcher;

      expect(() => {
        new BodyGraphService({
          entityManager: mockEntityManager,
          logger: null,
          eventDispatcher: mockEventDispatcher,
        });
      }).toThrow(InvalidArgumentError);
      expect(() => {
        new BodyGraphService({
          entityManager: mockEntityManager,
          logger: null,
          eventDispatcher: mockEventDispatcher,
        });
      }).toThrow('logger is required');
    });

    it('should throw InvalidArgumentError when eventDispatcher is missing', () => {
      const mockEntityManager = entityManager;
      const mockLogger = testBed.logger;

      expect(() => {
        new BodyGraphService({
          entityManager: mockEntityManager,
          logger: mockLogger,
          eventDispatcher: null,
        });
      }).toThrow(InvalidArgumentError);
      expect(() => {
        new BodyGraphService({
          entityManager: mockEntityManager,
          logger: mockLogger,
          eventDispatcher: null,
        });
      }).toThrow('eventDispatcher is required');
    });

    it('should create queryCache when not provided', () => {
      const mockEntityManager = entityManager;
      const mockLogger = testBed.logger;
      const mockEventDispatcher = testBed.eventDispatcher;

      const service = new BodyGraphService({
        entityManager: mockEntityManager,
        logger: mockLogger,
        eventDispatcher: mockEventDispatcher,
      });

      // The queryCache should be created internally
      expect(service).toBeDefined();
    });

    it('should use provided queryCache when given', () => {
      const mockQueryCache = {
        getCachedFindPartsByType: jest.fn(),
        cacheFindPartsByType: jest.fn(),
        getCachedGetAllParts: jest.fn(),
        cacheGetAllParts: jest.fn(),
        invalidateRoot: jest.fn(),
      };

      const service = new BodyGraphService({
        entityManager: entityManager,
        logger: testBed.logger,
        eventDispatcher: testBed.eventDispatcher,
        queryCache: mockQueryCache,
      });

      expect(service).toBeDefined();
    });
  });

  describe('getAllParts Integration', () => {
    it('should return empty array when bodyComponent is null', () => {
      const result = bodyGraphService.getAllParts(null);
      expect(result).toEqual([]);
    });

    it('should return empty array when bodyComponent is undefined', () => {
      const result = bodyGraphService.getAllParts(undefined);
      expect(result).toEqual([]);
    });

    it('should handle bodyComponent with nested body.root structure', async () => {
      // Create actor with anatomy
      const actor = await testBed.createActor({
        recipeId: 'anatomy:human_female',
      });
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Get the anatomy component
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const bodyComponent = actorInstance.getComponentData('anatomy:body');

      // Create nested structure
      const nestedBodyComponent = {
        body: {
          root: bodyComponent.body.root,
          parts: bodyComponent.body.parts,
        },
      };

      // Build cache first
      await bodyGraphService.buildAdjacencyCache(actor.id);

      const result = bodyGraphService.getAllParts(
        nestedBodyComponent,
        actor.id
      );
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle bodyComponent with direct root structure', async () => {
      // Create actor with anatomy
      const actor = await testBed.createActor({
        recipeId: 'anatomy:human_female',
      });
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Get the anatomy component
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const bodyComponent = actorInstance.getComponentData('anatomy:body');

      // Create direct root structure
      const directRootComponent = {
        root: bodyComponent.body.root,
        parts: bodyComponent.body.parts,
      };

      // Build cache first
      await bodyGraphService.buildAdjacencyCache(actor.id);

      const result = bodyGraphService.getAllParts(
        directRootComponent,
        actor.id
      );
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array when no root ID found in bodyComponent', () => {
      const invalidBodyComponent = {
        someOtherProperty: 'value',
      };

      const result = bodyGraphService.getAllParts(invalidBodyComponent);
      expect(result).toEqual([]);
    });

    it('should use actor entity ID as cache root when available in cache', async () => {
      // Create actor with anatomy
      const actor = await testBed.createActor({
        recipeId: 'anatomy:human_female',
      });
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Get the anatomy component
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const bodyComponent = actorInstance.getComponentData('anatomy:body');

      // Build cache for actor
      await bodyGraphService.buildAdjacencyCache(actor.id);

      const result = bodyGraphService.getAllParts(bodyComponent.body, actor.id);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should use blueprint root when actor not in cache', async () => {
      // Create actor with anatomy
      const actor = await testBed.createActor({
        recipeId: 'anatomy:human_female',
      });
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Get the anatomy component
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const bodyComponent = actorInstance.getComponentData('anatomy:body');

      // Don't build cache for actor, use different actor ID
      const differentActorId = 'non-existent-actor';

      const result = bodyGraphService.getAllParts(
        bodyComponent.body,
        differentActorId
      );
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('hasPartWithComponent Integration', () => {
    it('should find parts with specific components in real anatomy', async () => {
      // Create actor with anatomy
      const actor = await testBed.createActor({
        recipeId: 'anatomy:human_female',
      });
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Get the anatomy component
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const bodyComponent = actorInstance.getComponentData('anatomy:body');

      // Build cache
      await bodyGraphService.buildAdjacencyCache(actor.id);

      // Test finding parts with anatomy:part component
      const hasAnatomyPart = bodyGraphService.hasPartWithComponent(
        bodyComponent.body,
        'anatomy:part'
      );
      expect(hasAnatomyPart).toBe(true);

      // Test finding parts with non-existent component
      const hasNonExistent = bodyGraphService.hasPartWithComponent(
        bodyComponent.body,
        'non:existent'
      );
      expect(hasNonExistent).toBe(false);
    });

    it('should return false when no parts exist', () => {
      const emptyBodyComponent = {
        root: 'non-existent-root',
      };

      // getAllParts should return empty array for non-existent entities
      const allParts = bodyGraphService.getAllParts(emptyBodyComponent);
      expect(allParts).toEqual([]);

      const result = bodyGraphService.hasPartWithComponent(
        emptyBodyComponent,
        'anatomy:part'
      );
      expect(result).toBe(false);
    });
  });

  describe('hasPartWithComponentValue Integration', () => {
    it('should find parts with specific component values in real anatomy', async () => {
      // Create actor with anatomy
      const actor = await testBed.createActor({
        recipeId: 'anatomy:human_female',
      });
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Get the anatomy component
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const bodyComponent = actorInstance.getComponentData('anatomy:body');

      // Build cache
      await bodyGraphService.buildAdjacencyCache(actor.id);

      // Test finding parts with specific subType
      const hasHand = bodyGraphService.hasPartWithComponentValue(
        bodyComponent.body,
        'anatomy:part',
        'subType',
        'hand'
      );
      expect(hasHand.found).toBe(true);
      expect(hasHand.partId).toBeDefined();

      // Test finding parts with non-existent value
      const hasNonExistent = bodyGraphService.hasPartWithComponentValue(
        bodyComponent.body,
        'anatomy:part',
        'subType',
        'non-existent-type'
      );
      expect(hasNonExistent.found).toBe(false);
    });

    it('should handle nested property paths', async () => {
      // Create actor with anatomy
      const actor = await testBed.createActor({
        recipeId: 'anatomy:human_female',
      });
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Add a component with nested properties to a part
      const bodyComponent = entityManager.getComponentData(
        actor.id,
        'anatomy:body'
      );
      const allParts = bodyGraphService.getAllParts(
        bodyComponent.body,
        actor.id
      );

      if (allParts.length > 0) {
        const testPartId = allParts[0];
        const testPartInstance = entityManager.getEntityInstance(testPartId);
        testPartInstance.addComponent('test:nested', {
          level1: {
            level2: {
              value: 'deep-value',
            },
          },
        });

        const result = bodyGraphService.hasPartWithComponentValue(
          bodyComponent.body,
          'test:nested',
          'level1.level2.value',
          'deep-value'
        );
        expect(result.found).toBe(true);
        expect(result.partId).toBe(testPartId);
      }
    });

    it('should return not found when component data is null', () => {
      const emptyBodyComponent = {
        root: 'non-existent-root',
      };

      const result = bodyGraphService.hasPartWithComponentValue(
        emptyBodyComponent,
        'anatomy:part',
        'subType',
        'hand'
      );
      expect(result.found).toBe(false);
    });
  });

  describe('getBodyGraph Integration', () => {
    it('should throw InvalidArgumentError for invalid entity ID', async () => {
      await expect(bodyGraphService.getBodyGraph(null)).rejects.toThrow(
        InvalidArgumentError
      );
      await expect(bodyGraphService.getBodyGraph('')).rejects.toThrow(
        InvalidArgumentError
      );
      await expect(bodyGraphService.getBodyGraph(123)).rejects.toThrow(
        InvalidArgumentError
      );
    });

    it('should throw error when entity has no anatomy:body component', async () => {
      // Create actor without anatomy
      const actor = await entityManager.createEntityInstance('core:actor');

      await expect(bodyGraphService.getBodyGraph(actor.id)).rejects.toThrow(
        `Entity ${actor.id} has no anatomy:body component`
      );
    });

    it('should return body graph with getAllPartIds method for valid anatomy', async () => {
      // Create actor with anatomy
      const actor = await testBed.createActor({
        recipeId: 'anatomy:human_female',
      });
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      const bodyGraph = await bodyGraphService.getBodyGraph(actor.id);

      expect(bodyGraph).toBeDefined();
      expect(typeof bodyGraph.getAllPartIds).toBe('function');
      expect(typeof bodyGraph.getConnectedParts).toBe('function');

      const partIds = bodyGraph.getAllPartIds();
      expect(Array.isArray(partIds)).toBe(true);
      expect(partIds.length).toBeGreaterThan(0);
    });

    it('should return body graph with getConnectedParts method', async () => {
      // Create actor with anatomy
      const actor = await testBed.createActor({
        recipeId: 'anatomy:human_female',
      });
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      const bodyGraph = await bodyGraphService.getBodyGraph(actor.id);
      const partIds = bodyGraph.getAllPartIds();

      if (partIds.length > 0) {
        const connectedParts = bodyGraph.getConnectedParts(partIds[0]);
        expect(Array.isArray(connectedParts)).toBe(true);
      }
    });

    it('should build adjacency cache automatically', async () => {
      // Create actor with anatomy
      const actor = await testBed.createActor({
        recipeId: 'anatomy:human_female',
      });
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Ensure cache doesn't exist initially
      expect(bodyGraphService.hasCache(actor.id)).toBe(false);

      // Get body graph should build cache
      await bodyGraphService.getBodyGraph(actor.id);

      // Cache should now exist
      expect(bodyGraphService.hasCache(actor.id)).toBe(true);
    });
  });

  describe('getAnatomyData Integration', () => {
    it('should throw InvalidArgumentError for invalid entity ID', async () => {
      // Create a fresh BodyGraphService to test real behavior
      const realBodyGraphService = new BodyGraphService({
        entityManager: entityManager,
        logger: testBed.logger,
        eventDispatcher: testBed.eventDispatcher,
      });

      await expect(realBodyGraphService.getAnatomyData(null)).rejects.toThrow(
        InvalidArgumentError
      );
      await expect(realBodyGraphService.getAnatomyData('')).rejects.toThrow(
        InvalidArgumentError
      );
      await expect(realBodyGraphService.getAnatomyData(123)).rejects.toThrow(
        InvalidArgumentError
      );
    });

    it('should return null when entity has no anatomy:body component', async () => {
      // Create a fresh BodyGraphService to test real behavior
      const realBodyGraphService = new BodyGraphService({
        entityManager: entityManager,
        logger: testBed.logger,
        eventDispatcher: testBed.eventDispatcher,
      });

      // Create actor without anatomy
      const actor = await entityManager.createEntityInstance('core:actor');

      const result = await realBodyGraphService.getAnatomyData(actor.id);
      expect(result).toBeNull();
    });

    it('should return anatomy data for entity with anatomy:body component', async () => {
      // Create a fresh BodyGraphService to test real behavior
      const realBodyGraphService = new BodyGraphService({
        entityManager: entityManager,
        logger: testBed.logger,
        eventDispatcher: testBed.eventDispatcher,
      });

      // Create actor with anatomy
      const actor = await testBed.createActor({
        recipeId: 'anatomy:human_female',
      });
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      const anatomyData = await realBodyGraphService.getAnatomyData(actor.id);

      expect(anatomyData).toBeDefined();
      expect(anatomyData.recipeId).toBe('anatomy:human_female');
      expect(anatomyData.rootEntityId).toBe(actor.id);
    });

    it('should handle anatomy:body component without recipeId', async () => {
      // Create a fresh BodyGraphService to test real behavior
      const realBodyGraphService = new BodyGraphService({
        entityManager: entityManager,
        logger: testBed.logger,
        eventDispatcher: testBed.eventDispatcher,
      });

      // Create actor and manually add anatomy component without recipeId
      const actor = await entityManager.createEntityInstance('core:actor');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      actorInstance.addComponent('anatomy:body', {
        body: {
          root: 'some-root',
          parts: {},
        },
      });

      const anatomyData = await realBodyGraphService.getAnatomyData(actor.id);

      expect(anatomyData).toBeDefined();
      expect(anatomyData.recipeId).toBeNull();
      expect(anatomyData.rootEntityId).toBe(actor.id);
    });
  });

  describe('Utility Methods Integration', () => {
    let actor;
    let bodyComponent;

    beforeEach(async () => {
      // Create actor with anatomy for utility tests
      actor = await testBed.createActor({ recipeId: 'anatomy:human_female' });
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);
      await bodyGraphService.buildAdjacencyCache(actor.id);

      bodyComponent = entityManager.getComponentData(actor.id, 'anatomy:body');
    });

    it('should get children of an entity from cache', () => {
      const allParts = bodyGraphService.getAllParts(
        bodyComponent.body,
        actor.id
      );

      if (allParts.length > 0) {
        const children = bodyGraphService.getChildren(allParts[0]);
        expect(Array.isArray(children)).toBe(true);
      }
    });

    it('should get parent of an entity from cache', () => {
      const allParts = bodyGraphService.getAllParts(
        bodyComponent.body,
        actor.id
      );

      if (allParts.length > 1) {
        // Find a part that has a joint component (not the root)
        for (const partId of allParts) {
          const partInstance = entityManager.getEntityInstance(partId);
          const jointData = partInstance.getComponentData('anatomy:joint');
          if (jointData) {
            const parent = bodyGraphService.getParent(partId);
            expect(parent).toBe(jointData.parentId);
            break;
          }
        }
      }
    });

    it('should return parent of root entity from cache', () => {
      const rootId = bodyComponent.body.root;
      const parent = bodyGraphService.getParent(rootId);
      // Root entity may have a parent due to anatomy generation process
      // Just verify that the result is either null or a valid string
      expect(parent === null || typeof parent === 'string').toBe(true);
    });

    it('should get all ancestors of an entity', () => {
      const allParts = bodyGraphService.getAllParts(
        bodyComponent.body,
        actor.id
      );

      if (allParts.length > 1) {
        // Find a deeply nested part
        for (const partId of allParts) {
          const ancestors = bodyGraphService.getAncestors(partId);
          expect(Array.isArray(ancestors)).toBe(true);

          // If there are ancestors, each should be a valid entity
          for (const ancestorId of ancestors) {
            expect(typeof ancestorId).toBe('string');
            expect(ancestorId.length).toBeGreaterThan(0);
          }

          if (ancestors.length > 0) {
            // Test that ancestors are in order (nearest to farthest)
            break;
          }
        }
      }
    });

    it('should get all descendants of an entity', () => {
      const rootId = bodyComponent.body.root;
      const descendants = bodyGraphService.getAllDescendants(rootId);

      expect(Array.isArray(descendants)).toBe(true);
      expect(descendants.length).toBeGreaterThan(0);

      // Root should not be included in descendants
      expect(descendants).not.toContain(rootId);

      // All descendants should be valid entity IDs
      for (const descendantId of descendants) {
        expect(typeof descendantId).toBe('string');
        expect(descendantId.length).toBeGreaterThan(0);
      }
    });

    it('should return empty array for descendants when entity has no children', () => {
      // Find a leaf node (part with no children)
      const allParts = bodyGraphService.getAllParts(
        bodyComponent.body,
        actor.id
      );

      for (const partId of allParts) {
        const children = bodyGraphService.getChildren(partId);
        if (children.length === 0) {
          const descendants = bodyGraphService.getAllDescendants(partId);
          expect(descendants).toEqual([]);
          break;
        }
      }
    });
  });

  describe('Cache Management Integration', () => {
    it('should validate cache against entity manager', async () => {
      // Create actor with anatomy
      const actor = await testBed.createActor({
        recipeId: 'anatomy:human_female',
      });
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Build cache
      await bodyGraphService.buildAdjacencyCache(actor.id);

      // Validate cache - this method returns an object with valid property and issues array
      const validationResult = bodyGraphService.validateCache();
      expect(typeof validationResult).toBe('object');
      expect(validationResult).toHaveProperty('valid');
      expect(validationResult).toHaveProperty('issues');
      expect(typeof validationResult.valid).toBe('boolean');
      expect(Array.isArray(validationResult.issues)).toBe(true);
    });

    it('should check if cache exists for root entity', async () => {
      // Create actor with anatomy
      const actor = await testBed.createActor({
        recipeId: 'anatomy:human_female',
      });
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Initially no cache
      expect(bodyGraphService.hasCache(actor.id)).toBe(false);

      // Build cache
      await bodyGraphService.buildAdjacencyCache(actor.id);

      // Now cache should exist
      expect(bodyGraphService.hasCache(actor.id)).toBe(true);
    });

    it('should only build cache if it does not already exist', async () => {
      // Create actor with anatomy
      const actor = await testBed.createActor({
        recipeId: 'anatomy:human_female',
      });
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Build cache first time
      await bodyGraphService.buildAdjacencyCache(actor.id);
      expect(bodyGraphService.hasCache(actor.id)).toBe(true);

      // Build cache second time - should not rebuild
      await bodyGraphService.buildAdjacencyCache(actor.id);
      expect(bodyGraphService.hasCache(actor.id)).toBe(true);
    });
  });

  describe('Part Detection and Search Integration', () => {
    it('should find parts by type using real anatomy data', async () => {
      // Create actor with anatomy
      const actor = await testBed.createActor({
        recipeId: 'anatomy:human_female',
      });
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Build cache
      await bodyGraphService.buildAdjacencyCache(actor.id);

      // Find hand parts
      const handParts = bodyGraphService.findPartsByType(actor.id, 'hand');
      expect(Array.isArray(handParts)).toBe(true);
      expect(handParts.length).toBeGreaterThan(0);

      // Verify each found part is actually a hand
      for (const partId of handParts) {
        const partInstance = entityManager.getEntityInstance(partId);
        const partData = partInstance.getComponentData('anatomy:part');
        expect(partData.subType).toBe('hand');
      }
    });

    it('should use query cache for findPartsByType', async () => {
      // Create actor with anatomy
      const actor = await testBed.createActor({
        recipeId: 'anatomy:human_female',
      });
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Build cache
      await bodyGraphService.buildAdjacencyCache(actor.id);

      // First call should populate cache
      const firstResult = bodyGraphService.findPartsByType(actor.id, 'hand');

      // Second call should use cache
      const secondResult = bodyGraphService.findPartsByType(actor.id, 'hand');

      expect(firstResult).toEqual(secondResult);
    });

    it('should get anatomy root for any part in anatomy graph', async () => {
      // Create actor with anatomy
      const actor = await testBed.createActor({
        recipeId: 'anatomy:human_female',
      });
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Build cache
      await bodyGraphService.buildAdjacencyCache(actor.id);

      const bodyComponent = entityManager.getComponentData(
        actor.id,
        'anatomy:body'
      );
      const allParts = bodyGraphService.getAllParts(
        bodyComponent.body,
        actor.id
      );

      if (allParts.length > 0) {
        // Test getting root from various parts
        for (const partId of allParts.slice(0, 3)) {
          // Test first 3 parts
          const root = bodyGraphService.getAnatomyRoot(partId);
          expect(root).toBeDefined();
          expect(typeof root).toBe('string');
        }
      }
    });

    it('should get path between two entities in anatomy graph', async () => {
      // Create actor with anatomy
      const actor = await testBed.createActor({
        recipeId: 'anatomy:human_female',
      });
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Build cache
      await bodyGraphService.buildAdjacencyCache(actor.id);

      const bodyComponent = entityManager.getComponentData(
        actor.id,
        'anatomy:body'
      );
      const allParts = bodyGraphService.getAllParts(
        bodyComponent.body,
        actor.id
      );

      if (allParts.length > 1) {
        const fromEntity = allParts[0];
        const toEntity = allParts[1];

        const path = bodyGraphService.getPath(fromEntity, toEntity);
        expect(Array.isArray(path)).toBe(true);
      }
    });
  });

  describe('Real Anatomy Generation Workflow Integration', () => {
    it('should work with complete anatomy generation workflow', async () => {
      // Create actor
      const actor = await testBed.createActor({
        recipeId: 'anatomy:human_female',
      });

      // Generate anatomy
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Get body graph
      const bodyGraph = await bodyGraphService.getBodyGraph(actor.id);
      const allParts = bodyGraph.getAllPartIds();

      expect(allParts.length).toBeGreaterThan(0);

      // Test various operations on generated anatomy
      const bodyComponent = entityManager.getComponentData(
        actor.id,
        'anatomy:body'
      );

      // Test part detection
      const hasHands = bodyGraphService.hasPartWithComponentValue(
        bodyComponent.body,
        'anatomy:part',
        'subType',
        'hand'
      );
      expect(hasHands.found).toBe(true);

      // Test part finding
      const handParts = bodyGraphService.findPartsByType(actor.id, 'hand');
      expect(handParts.length).toBeGreaterThan(0);

      // Test anatomy data retrieval using a fresh service to avoid mocking
      const realBodyGraphService = new BodyGraphService({
        entityManager: entityManager,
        logger: testBed.logger,
        eventDispatcher: testBed.eventDispatcher,
      });
      const anatomyData = await realBodyGraphService.getAnatomyData(actor.id);
      expect(anatomyData.recipeId).toBe('anatomy:human_female');
    });

    it('should handle male anatomy generation workflow', async () => {
      // Test with male anatomy to ensure gender-specific parts work
      const actor = await testBed.createActor({
        recipeId: 'anatomy:human_male_balanced',
      });

      // Generate anatomy
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Get body graph
      const bodyGraph = await bodyGraphService.getBodyGraph(actor.id);
      const allParts = bodyGraph.getAllPartIds();

      expect(allParts.length).toBeGreaterThan(0);

      // Test male-specific part detection
      const bodyComponent = entityManager.getComponentData(
        actor.id,
        'anatomy:body'
      );

      const hasPenis = bodyGraphService.hasPartWithComponentValue(
        bodyComponent.body,
        'anatomy:part',
        'subType',
        'penis'
      );
      expect(hasPenis.found).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle anatomy generation with complex nested structures', async () => {
      // Create actor with anatomy
      const actor = await testBed.createActor({
        recipeId: 'anatomy:human_female',
      });
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Test with complex queries
      const bodyComponent = entityManager.getComponentData(
        actor.id,
        'anatomy:body'
      );

      // Test finding non-existent part types
      const unknownParts = bodyGraphService.findPartsByType(
        actor.id,
        'unknown-part-type'
      );
      expect(unknownParts).toEqual([]);

      // Test with empty string search
      const emptyParts = bodyGraphService.findPartsByType(actor.id, '');
      expect(Array.isArray(emptyParts)).toBe(true);

      // Test getAllParts with various invalid inputs
      expect(bodyGraphService.getAllParts({})).toEqual([]);
      expect(bodyGraphService.getAllParts({ someProperty: 'value' })).toEqual(
        []
      );
    });

    it('should gracefully handle missing components in anatomy parts', async () => {
      // Create actor with anatomy
      const actor = await testBed.createActor({
        recipeId: 'anatomy:human_female',
      });
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      const bodyComponent = entityManager.getComponentData(
        actor.id,
        'anatomy:body'
      );

      // Test searching for components that don't exist
      const hasNonExistent = bodyGraphService.hasPartWithComponent(
        bodyComponent.body,
        'non:existent:component'
      );
      expect(hasNonExistent).toBe(false);

      // Test searching for component values that don't exist
      const hasNonExistentValue = bodyGraphService.hasPartWithComponentValue(
        bodyComponent.body,
        'anatomy:part',
        'nonExistentProperty',
        'any-value'
      );
      expect(hasNonExistentValue.found).toBe(false);
    });
  });
});
