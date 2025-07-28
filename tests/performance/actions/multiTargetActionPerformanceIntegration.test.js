/**
 * @file Performance Integration Tests for Multi-Target Actions
 * @description Tests for performance, memory usage, and scalability of the multi-target action system
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import { EntityManagerTestBed } from '../../common/entities/entityManagerTestBed.js';
import { createMockFacades } from '../../common/facades/testingFacadeRegistrations.js';
import { performance } from 'perf_hooks';

describe('Multi-Target Action Performance Integration', () => {
  let entityTestBed;
  let facades;
  let actionServiceFacade;
  let mockLogger;

  beforeEach(() => {
    entityTestBed = new EntityManagerTestBed();
    const testBed = createTestBed();
    mockLogger = testBed.mockLogger;

    // Create facades
    facades = createMockFacades({}, jest.fn);
    actionServiceFacade = facades.actionService;
  });

  afterEach(() => {
    entityTestBed.cleanup();
    actionServiceFacade.clearMockData();
  });

  describe('Large-Scale Processing', () => {
    it('should process actions with many potential targets efficiently', async () => {
      // Create action with potential for many combinations
      const actionDefinition = {
        id: 'test:large_scale_processing',
        name: 'process {items}',
        targets: {
          items: {
            name: 'items',
            scope: 'actor.core:inventory.items[]',
            required: true,
            multiple: true,
            maxCombinations: 50,
            validation: {
              type: 'array',
              minItems: 1,
              maxItems: 5,
            },
          },
        },
        operations: [
          {
            operation: {
              type: 'dispatchEvent',
              eventType: 'LARGE_SCALE_PROCESSED',
              payload: {
                itemCount: 'items.length',
              },
            },
          },
        ],
        template: 'process {items.length} items',
      };

      // Create large inventory
      const itemIds = Array.from({ length: 100 }, (_, i) => `item_${i}`);
      const playerEntity = await entityTestBed.createEntity('actor', {
        instanceId: 'player',
        overrides: {
          'core:inventory': { items: itemIds },
        },
      });

      // Create all items
      const itemEntities = [];
      for (let i = 0; i < itemIds.length; i++) {
        const itemEntity = await entityTestBed.createEntity('basic', {
          instanceId: itemIds[i],
          overrides: {
            'core:item': { name: `Item ${i}`, value: i },
          },
        });
        itemEntities.push(itemEntity);
      }

      // Mock discovery with performance tracking
      let discoveryTime = 0;
      const mockDiscoveryResult = [];

      // Simulate generation of action combinations (up to maxCombinations)
      for (let i = 0; i < Math.min(50, itemIds.length); i++) {
        mockDiscoveryResult.push({
          actionId: actionDefinition.id,
          targets: {
            items: [{ id: itemIds[i], displayName: `Item ${i}` }],
          },
          command: `process 1 items`,
          available: true,
        });
      }

      actionServiceFacade.setMockActions('player', mockDiscoveryResult);

      const startTime = performance.now();

      const availableActions =
        await actionServiceFacade.discoverActions('player');

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // Performance requirements
      expect(processingTime).toBeLessThan(500); // Should complete within 500ms
      expect(availableActions.length).toBeLessThanOrEqual(50); // Respects maxCombinations
      expect(availableActions.length).toBeGreaterThan(0); // Should find some valid combinations
    });

    it('should handle complex context resolution efficiently', async () => {
      const actionDefinition = {
        id: 'test:complex_context_performance',
        name: 'craft {recipe} with {materials}',
        targets: {
          recipe: {
            name: 'recipe',
            scope: 'game.recipes[]',
            required: true,
          },
          materials: {
            name: 'materials',
            scope: 'actor.core:inventory.items[]',
            contextFrom: 'recipe',
            required: true,
            multiple: true,
            maxCombinations: 20,
            validation: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  components: {
                    type: 'object',
                    properties: {
                      'core:material': {
                        type: 'object',
                        properties: {
                          type: {
                            type: 'string',
                            enum: { var: 'target.required_material_types' },
                          },
                        },
                        required: ['type'],
                      },
                    },
                    required: ['core:material'],
                  },
                },
              },
            },
          },
        },
        operations: [],
        template: 'craft with materials',
      };

      // Create multiple recipes with different requirements
      const recipes = Array.from({ length: 10 }, (_, i) => ({
        id: `recipe_${i}`,
        name: `Recipe ${i}`,
        required_material_types: ['metal', 'wood', 'cloth'][i % 3],
      }));

      // Create large material inventory
      const materialIds = Array.from({ length: 50 }, (_, i) => `material_${i}`);
      const playerEntity = await entityTestBed.createEntity('actor', {
        instanceId: 'player',
        overrides: {
          'core:inventory': { items: materialIds },
        },
      });

      // Create materials of different types
      for (let i = 0; i < materialIds.length; i++) {
        const materialType = ['metal', 'wood', 'cloth'][i % 3];
        await entityTestBed.createEntity('basic', {
          instanceId: materialIds[i],
          overrides: {
            'core:item': { name: `${materialType} Material ${i}` },
            'core:material': { type: materialType, quality: 50 + (i % 50) },
          },
        });
      }

      // Mock complex discovery result
      const mockDiscoveryResult = [];
      for (let i = 0; i < recipes.length; i++) {
        const recipe = recipes[i];
        const matchingMaterials = materialIds.filter((_, idx) => {
          const materialType = ['metal', 'wood', 'cloth'][idx % 3];
          return materialType === recipe.required_material_types;
        });

        // Add up to maxCombinations per recipe
        for (let j = 0; j < Math.min(2, matchingMaterials.length); j++) {
          mockDiscoveryResult.push({
            actionId: actionDefinition.id,
            targets: {
              recipe: { id: recipe.id, displayName: recipe.name },
              materials: [
                {
                  id: matchingMaterials[j],
                  displayName: `Material ${matchingMaterials[j]}`,
                },
              ],
            },
            command: 'craft with materials',
            available: true,
          });
        }
      }

      actionServiceFacade.setMockActions('player', mockDiscoveryResult);

      const startTime = performance.now();

      const availableActions =
        await actionServiceFacade.discoverActions('player');

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // Performance requirements for complex context resolution
      expect(processingTime).toBeLessThan(300); // Should complete within 300ms
      expect(availableActions.length).toBeGreaterThan(0);
      expect(availableActions.length).toBeLessThanOrEqual(200); // 10 recipes * 20 max combinations
    });
  });

  describe('Memory Usage', () => {
    it('should maintain reasonable memory usage during large operations', async () => {
      const actionDefinition = {
        id: 'test:memory_usage',
        name: 'memory test {items}',
        targets: {
          items: {
            name: 'items',
            scope: 'actor.core:inventory.items[]',
            required: true,
            multiple: true,
            maxCombinations: 30,
          },
        },
        operations: [],
        template: 'memory test',
      };

      // Create large dataset
      const itemIds = Array.from({ length: 200 }, (_, i) => `mem_item_${i}`);
      const playerEntity = await entityTestBed.createEntity('actor', {
        instanceId: 'player',
        overrides: {
          'core:inventory': { items: itemIds },
        },
      });

      // Create items with substantial data
      for (let i = 0; i < itemIds.length; i++) {
        await entityTestBed.createEntity('basic', {
          instanceId: itemIds[i],
          overrides: {
            'core:item': {
              name: `Memory Item ${i}`,
              description: `A test item with index ${i} for memory testing purposes.`,
              properties: Array.from({ length: 10 }, (_, j) => `property_${j}`),
            },
          },
        });
      }

      // Mock discovery with limited combinations
      const mockDiscoveryResult = [];
      for (let i = 0; i < Math.min(30, itemIds.length); i++) {
        mockDiscoveryResult.push({
          actionId: actionDefinition.id,
          targets: {
            items: [{ id: itemIds[i], displayName: `Memory Item ${i}` }],
          },
          command: 'memory test',
          available: true,
        });
      }

      actionServiceFacade.setMockActions('player', mockDiscoveryResult);

      // Monitor memory usage
      if (global.gc) {
        global.gc(); // Force garbage collection if available
      }
      const memBefore = process.memoryUsage();

      const availableActions =
        await actionServiceFacade.discoverActions('player');

      const memAfter = process.memoryUsage();
      const memoryIncrease = memAfter.heapUsed - memBefore.heapUsed;

      // Memory usage should be reasonable (less than 50MB increase)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      expect(availableActions.length).toBe(30);
    });

    it('should clean up memory after processing', async () => {
      // Create and process multiple action sets
      const iterations = 5;
      const memorySnapshots = [];

      for (let iter = 0; iter < iterations; iter++) {
        const actionDefinition = {
          id: `test:memory_cleanup_${iter}`,
          name: `test iteration ${iter}`,
          targets: {
            item: {
              name: 'item',
              scope: 'actor.core:inventory.items[]',
              required: true,
            },
          },
          operations: [],
          template: 'test action',
        };

        // Create test data
        const itemIds = Array.from(
          { length: 50 },
          (_, i) => `iter${iter}_item_${i}`
        );
        const playerEntity = await entityTestBed.createEntity('actor', {
          instanceId: `player_${iter}`,
          overrides: {
            'core:inventory': { items: itemIds },
          },
        });

        // Mock discovery
        const mockDiscoveryResult = itemIds.map((id) => ({
          actionId: actionDefinition.id,
          targets: { item: { id, displayName: `Item ${id}` } },
          command: 'test action',
          available: true,
        }));

        actionServiceFacade.setMockActions(
          `player_${iter}`,
          mockDiscoveryResult
        );

        // Process actions
        await actionServiceFacade.discoverActions(`player_${iter}`);

        // Clear mock data to simulate cleanup
        actionServiceFacade.clearMockData();

        // Take memory snapshot
        if (global.gc) {
          global.gc(); // Force garbage collection if available
        }
        memorySnapshots.push(process.memoryUsage().heapUsed);
      }

      // Memory should not continuously increase (allow for some variance)
      const firstSnapshot = memorySnapshots[0];
      const lastSnapshot = memorySnapshots[memorySnapshots.length - 1];
      const memoryGrowth = lastSnapshot - firstSnapshot;

      // Should not grow more than 10MB over iterations
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Concurrent Processing', () => {
    it('should handle multiple simultaneous action processing requests', async () => {
      const actionDefinition = {
        id: 'test:concurrent_processing',
        name: 'concurrent {item}',
        targets: {
          item: {
            name: 'item',
            scope: 'actor.core:inventory.items[]',
            required: true,
          },
        },
        operations: [],
        template: 'process concurrently',
      };

      // Create multiple players with items
      const playerCount = 5;
      const players = [];

      for (let i = 0; i < playerCount; i++) {
        const playerId = `player_${i}`;
        const itemId = `item_${i}`;

        const playerEntity = await entityTestBed.createEntity('actor', {
          instanceId: playerId,
          overrides: {
            'core:inventory': { items: [itemId] },
          },
        });

        const itemEntity = await entityTestBed.createEntity('basic', {
          instanceId: itemId,
          overrides: {
            'core:item': { name: `Item ${i}` },
          },
        });

        players.push({ playerId, itemId });

        // Mock discovery for each player
        actionServiceFacade.setMockActions(playerId, [
          {
            actionId: actionDefinition.id,
            targets: { item: { id: itemId, displayName: `Item ${i}` } },
            command: 'process concurrently',
            available: true,
          },
        ]);
      }

      // Process actions for all players concurrently
      const startTime = performance.now();

      const promises = players.map(({ playerId }) =>
        actionServiceFacade.discoverActions(playerId)
      );

      const results = await Promise.all(promises);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // All requests should succeed
      results.forEach((result, index) => {
        expect(result).toHaveLength(1);
        expect(result[0].targets.item.id).toBe(`item_${index}`);
      });

      // Concurrent processing should be efficient
      expect(totalTime).toBeLessThan(200); // Should complete within 200ms
    });

    it('should handle concurrent validation and execution', async () => {
      const actionDefinition = {
        id: 'test:concurrent_validation',
        name: 'validate {item}',
        targets: {
          item: {
            name: 'item',
            scope: 'actor.core:inventory.items[]',
            required: true,
          },
        },
        operations: [],
        template: 'validate item',
      };

      // Create test actors
      const actorCount = 3;
      const actors = [];

      for (let i = 0; i < actorCount; i++) {
        const actorId = `actor_${i}`;
        const itemId = `val_item_${i}`;

        const actorEntity = await entityTestBed.createEntity('actor', {
          instanceId: actorId,
          overrides: {
            'core:inventory': { items: [itemId] },
          },
        });

        const itemEntity = await entityTestBed.createEntity('basic', {
          instanceId: itemId,
          overrides: {
            'core:item': { name: `Validation Item ${i}` },
          },
        });

        actors.push({ actorId, itemId });

        // Mock validation results
        actionServiceFacade.setMockValidation(actorId, actionDefinition.id, {
          success: true,
          validatedAction: {
            actionId: actionDefinition.id,
            actorId: actorId,
            targets: { item: { id: itemId } },
          },
        });
      }

      const startTime = performance.now();

      // Validate actions concurrently
      const validationPromises = actors.map(({ actorId, itemId }) =>
        actionServiceFacade.validateAction({
          actionId: actionDefinition.id,
          actorId: actorId,
          targets: { item: { id: itemId } },
        })
      );

      const validationResults = await Promise.all(validationPromises);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // All validations should succeed
      validationResults.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.validatedAction.actorId).toBe(`actor_${index}`);
      });

      // Concurrent validation should be efficient
      expect(totalTime).toBeLessThan(150); // Should complete within 150ms
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance requirements for typical gameplay scenarios', async () => {
      // Simulate a typical gameplay scenario with multiple action types
      const scenarios = [
        {
          name: 'Simple action discovery',
          itemCount: 10,
          expectedTime: 50,
        },
        {
          name: 'Moderate complexity',
          itemCount: 50,
          expectedTime: 150,
        },
        {
          name: 'High complexity',
          itemCount: 100,
          expectedTime: 300,
        },
      ];

      for (const scenario of scenarios) {
        const actionDefinition = {
          id: `test:benchmark_${scenario.name}`,
          name: 'benchmark {item}',
          targets: {
            item: {
              name: 'item',
              scope: 'actor.core:inventory.items[]',
              required: true,
            },
          },
          operations: [],
          template: 'benchmark action',
        };

        // Create test data
        const itemIds = Array.from(
          { length: scenario.itemCount },
          (_, i) => `bench_item_${i}`
        );

        const playerEntity = await entityTestBed.createEntity('actor', {
          instanceId: 'benchmark_player_' + scenario.name.replace(/\s+/g, '_'),
          overrides: {
            'core:inventory': { items: itemIds },
          },
        });

        // Mock discovery
        const mockDiscoveryResult = itemIds.slice(0, 10).map((id) => ({
          actionId: actionDefinition.id,
          targets: { item: { id, displayName: `Item ${id}` } },
          command: 'benchmark action',
          available: true,
        }));

        const playerId =
          'benchmark_player_' + scenario.name.replace(/\s+/g, '_');
        actionServiceFacade.setMockActions(playerId, mockDiscoveryResult);

        const startTime = performance.now();

        const actions = await actionServiceFacade.discoverActions(playerId);

        const endTime = performance.now();
        const processingTime = endTime - startTime;

        expect(processingTime).toBeLessThan(scenario.expectedTime);
        expect(actions.length).toBeLessThanOrEqual(10);

        // Clean up for next scenario
        actionServiceFacade.clearMockData();
      }
    });
  });
});
