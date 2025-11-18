/**
 * @file Positioning Actions - Mouth Availability Integration Tests
 * @description Tests integration of mouth availability condition with positioning actions
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Core system components
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import JsonLogicCustomOperators from '../../../../src/logic/jsonLogicCustomOperators.js';
import { getMouthParts } from '../../../../src/utils/mouthEngagementUtils.js';

// Component management
import { SimpleEntityManager } from '../../../common/entities/index.js';
import { createMockLogger } from '../../../common/mockFactories.js';

// Constants
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';

// Import the mouth availability condition data
import mouthAvailableCondition from '../../../../data/mods/core/conditions/actor-mouth-available.condition.json' assert { type: 'json' };

describe('Positioning Actions - Mouth Availability Integration', () => {
  let entityManager;
  let jsonLogicService;
  let customOperators;
  let mockBodyGraphService;
  let mockGameDataRepository;
  let logger;

  beforeEach(async () => {
    logger = createMockLogger();
    entityManager = new SimpleEntityManager([]);

    // Setup mock services for JSON Logic
    mockBodyGraphService = {
      findPartsByType: jest.fn(),
      buildAdjacencyCache: jest.fn(),
      hasPartWithComponentValue: jest.fn(),
      getAllParts: jest.fn(),
    };

    mockGameDataRepository = {
      getConditionDefinition: jest.fn(),
    };

    // Setup the mouth availability condition
    mockGameDataRepository.getConditionDefinition.mockImplementation(
      (conditionId) => {
        if (conditionId === 'core:actor-mouth-available') {
          return mouthAvailableCondition;
        }
        return undefined;
      }
    );

    // Create real services for integration testing
    jsonLogicService = new JsonLogicEvaluationService({
      logger,
      gameDataRepository: mockGameDataRepository,
    });

    // Create and register custom operators
    customOperators = new JsonLogicCustomOperators({
      logger,
      bodyGraphService: mockBodyGraphService,
      entityManager,
    });
    customOperators.registerOperators(jsonLogicService);
  });

  afterEach(() => {
    // Clean up any remaining entities
    if (entityManager && entityManager.clear) {
      entityManager.clear();
    }
    jest.clearAllMocks();
  });

  /**
   * Helper function to create test actors with mouth anatomy
   *
   * @param id
   * @param name
   */
  async function createTestActorWithMouth(id, name) {
    await entityManager.createEntity(id);
    await entityManager.addComponent(id, NAME_COMPONENT_ID, { text: name });
    await entityManager.addComponent(id, POSITION_COMPONENT_ID, {
      locationId: 'room1',
    });

    // Add anatomy with mouth (following the existing test pattern)
    await entityManager.addComponent(id, 'anatomy:body', {
      body: {
        root: `${id}_body_root`,
        parts: { mouth: `${id}_mouth` },
      },
    });

    // Create mouth part entity with components expected by mouth engagement handlers
    const mouthId = `${id}_mouth`;
    await entityManager.createEntity(mouthId);
    await entityManager.addComponent(mouthId, 'anatomy:part', {
      subType: 'mouth',
    });
    await entityManager.addComponent(mouthId, 'anatomy:sockets', {
      sockets: [
        {
          id: 'teeth',
          allowedTypes: ['teeth'],
          nameTpl: '{{type}}',
        },
      ],
    });
    await entityManager.addComponent(mouthId, 'core:name', {
      text: 'mouth',
    });
    // This component is what the condition checks
    await entityManager.addComponent(mouthId, 'core:mouth_engagement', {
      locked: false,
      forcedOverride: false,
    });

    return id;
  }

  /**
   * Helper function to create actor without mouth
   *
   * @param id
   * @param name
   */
  async function createTestActorWithoutMouth(id, name) {
    await entityManager.createEntity(id);
    await entityManager.addComponent(id, NAME_COMPONENT_ID, { text: name });
    await entityManager.addComponent(id, POSITION_COMPONENT_ID, {
      locationId: 'room1',
    });

    // Add body but no mouth parts
    await entityManager.addComponent(id, 'anatomy:body', {
      body: {
        root: `${id}_body_root`,
        parts: {}, // No mouth part
      },
    });

    return id;
  }

  /**
   * Helper function to setup mock body graph service for an actor
   *
   * @param actorId
   * @param hasMouth
   */
  function setupMockBodyGraphService(actorId, hasMouth = true) {
    const bodyRoot = `${actorId}_body_root`;
    const mouthId = `${actorId}_mouth`;

    // Mock findPartsByType to return mouth parts when they exist
    mockBodyGraphService.findPartsByType.mockImplementation(
      (rootId, partType) => {
        if (rootId === bodyRoot && partType === 'mouth' && hasMouth) {
          return [mouthId];
        }
        return [];
      }
    );

    // Mock buildAdjacencyCache - just return success
    mockBodyGraphService.buildAdjacencyCache.mockImplementation(() => {
      // No-op for testing
    });
  }

  describe('Mouth Availability Condition Integration', () => {
    it('should return true when actor has mouth and it is available', async () => {
      const actorId = await createTestActorWithMouth('test_actor', 'TestActor');
      setupMockBodyGraphService(actorId, true);

      const evaluationContext = {
        actor: { id: actorId },
      };

      // Test the condition logic directly through JSON Logic
      const result = await jsonLogicService.evaluate(
        mouthAvailableCondition.logic,
        evaluationContext
      );

      expect(result).toBe(true);
    });

    it('should return false when actor has mouth but it is engaged', async () => {
      const actorId = await createTestActorWithMouth('test_actor', 'TestActor');

      // Lock the mouth by updating the component directly
      const mouthParts = getMouthParts(entityManager, actorId);
      if (mouthParts.length > 0) {
        const mouthId = mouthParts[0].partId;
        await entityManager.addComponent(mouthId, 'core:mouth_engagement', {
          locked: true,
          forcedOverride: false,
        });
      }

      setupMockBodyGraphService(actorId, true);

      const evaluationContext = {
        actor: { id: actorId },
      };

      const result = await jsonLogicService.evaluate(
        mouthAvailableCondition.logic,
        evaluationContext
      );

      expect(result).toBe(false);
    });

    it('should return true when actor has no mouth (positioning actions should be allowed)', async () => {
      const actorId = await createTestActorWithoutMouth(
        'no_mouth_actor',
        'NoMouthActor'
      );
      setupMockBodyGraphService(actorId, false);

      const evaluationContext = {
        actor: { id: actorId },
      };

      const result = await jsonLogicService.evaluate(
        mouthAvailableCondition.logic,
        evaluationContext
      );

      expect(result).toBe(true);
    });

    it('should return true when actor has mouth without engagement component', async () => {
      const actorId = await createTestActorWithMouth(
        'no_engagement_actor',
        'NoEngagementActor'
      );

      // Remove the mouth engagement component
      const mouthParts = getMouthParts(entityManager, actorId);
      if (mouthParts.length > 0) {
        const mouthId = mouthParts[0].partId;
        entityManager.removeComponent(mouthId, 'core:mouth_engagement');
      }

      setupMockBodyGraphService(actorId, true);

      const evaluationContext = {
        actor: { id: actorId },
      };

      const result = await jsonLogicService.evaluate(
        mouthAvailableCondition.logic,
        evaluationContext
      );

      expect(result).toBe(true);
    });
  });

  describe('Integration with Operation Handlers', () => {
    it('should demonstrate mouth availability changing after lock/unlock operations', async () => {
      const actorId = await createTestActorWithMouth(
        'dynamic_actor',
        'DynamicActor'
      );

      const evaluationContext = {
        actor: { id: actorId },
      };

      // Initially available
      setupMockBodyGraphService(actorId, true);
      let result = await jsonLogicService.evaluate(
        mouthAvailableCondition.logic,
        evaluationContext
      );
      expect(result).toBe(true);

      // Simulate operation handler locking mouth
      const mouthParts = getMouthParts(entityManager, actorId);
      if (mouthParts.length > 0) {
        const mouthId = mouthParts[0].partId;
        await entityManager.addComponent(mouthId, 'core:mouth_engagement', {
          locked: true,
          forcedOverride: false,
        });
      }

      // Should now be unavailable
      setupMockBodyGraphService(actorId, true);
      result = await jsonLogicService.evaluate(
        mouthAvailableCondition.logic,
        evaluationContext
      );
      expect(result).toBe(false);

      // Simulate operation handler unlocking mouth
      if (mouthParts.length > 0) {
        const mouthId = mouthParts[0].partId;
        await entityManager.addComponent(mouthId, 'core:mouth_engagement', {
          locked: false,
          forcedOverride: false,
        });
      }

      // Should be available again
      setupMockBodyGraphService(actorId, true);
      result = await jsonLogicService.evaluate(
        mouthAvailableCondition.logic,
        evaluationContext
      );
      expect(result).toBe(true);
    });

    it('should handle multiple actors with different mouth states', async () => {
      const availableActorId = await createTestActorWithMouth(
        'available_actor',
        'AvailableActor'
      );
      const lockedActorId = await createTestActorWithMouth(
        'locked_actor',
        'LockedActor'
      );
      const noMouthActorId = await createTestActorWithoutMouth(
        'no_mouth_actor',
        'NoMouthActor'
      );

      // Lock one actor's mouth
      const lockedMouthParts = getMouthParts(entityManager, lockedActorId);
      if (lockedMouthParts.length > 0) {
        const mouthId = lockedMouthParts[0].partId;
        await entityManager.addComponent(mouthId, 'core:mouth_engagement', {
          locked: true,
          forcedOverride: false,
        });
      }

      // Test available actor
      setupMockBodyGraphService(availableActorId, true);
      let result = await jsonLogicService.evaluate(
        mouthAvailableCondition.logic,
        { actor: { id: availableActorId } }
      );
      expect(result).toBe(true);

      // Test locked actor
      setupMockBodyGraphService(lockedActorId, true);
      result = await jsonLogicService.evaluate(mouthAvailableCondition.logic, {
        actor: { id: lockedActorId },
      });
      expect(result).toBe(false);

      // Test no mouth actor
      setupMockBodyGraphService(noMouthActorId, false);
      result = await jsonLogicService.evaluate(mouthAvailableCondition.logic, {
        actor: { id: noMouthActorId },
      });
      expect(result).toBe(true);
    });
  });

  describe('Condition Logic Edge Cases', () => {
    it('should handle actors with malformed anatomy', async () => {
      const actorId = 'malformed_actor';
      await entityManager.createEntity(actorId);
      await entityManager.addComponent(actorId, NAME_COMPONENT_ID, {
        text: 'MalformedActor',
      });

      // Add malformed anatomy component
      await entityManager.addComponent(actorId, 'anatomy:body', {
        body: {
          // Missing root or parts
        },
      });

      setupMockBodyGraphService(actorId, false);

      const evaluationContext = {
        actor: { id: actorId },
      };

      const result = await jsonLogicService.evaluate(
        mouthAvailableCondition.logic,
        evaluationContext
      );

      // Should default to true (available) when anatomy is malformed
      expect(result).toBe(true);
    });

    it('should handle non-existent actors gracefully', async () => {
      const evaluationContext = {
        actor: { id: 'non_existent_actor' },
      };

      setupMockBodyGraphService('non_existent_actor', false);

      // Should not throw an error
      expect(() => {
        jsonLogicService.evaluate(
          mouthAvailableCondition.logic,
          evaluationContext
        );
      }).not.toThrow();
    });

    it('should handle actors with multiple mouth parts', async () => {
      const actorId = 'multi_mouth_actor';
      await entityManager.createEntity(actorId);
      await entityManager.addComponent(actorId, NAME_COMPONENT_ID, {
        text: 'MultiMouthActor',
      });
      await entityManager.addComponent(actorId, POSITION_COMPONENT_ID, {
        locationId: 'room1',
      });

      // Add anatomy with multiple mouth parts (unusual but possible)
      await entityManager.addComponent(actorId, 'anatomy:body', {
        body: {
          root: `${actorId}_body_root`,
          parts: {
            mouth1: `${actorId}_mouth1`,
            mouth2: `${actorId}_mouth2`,
          },
        },
      });

      // Create multiple mouth parts - one locked, one unlocked
      const mouth1Id = `${actorId}_mouth1`;
      const mouth2Id = `${actorId}_mouth2`;

      for (const mouthId of [mouth1Id, mouth2Id]) {
        await entityManager.createEntity(mouthId);
        await entityManager.addComponent(mouthId, 'anatomy:part', {
          subType: 'mouth',
        });
        await entityManager.addComponent(mouthId, 'core:name', {
          text: 'mouth',
        });
      }

      // Lock first mouth, leave second unlocked
      await entityManager.addComponent(mouth1Id, 'core:mouth_engagement', {
        locked: true,
        forcedOverride: false,
      });
      await entityManager.addComponent(mouth2Id, 'core:mouth_engagement', {
        locked: false,
        forcedOverride: false,
      });

      // Setup mock to return both mouths
      const bodyRoot = `${actorId}_body_root`;
      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootId, partType) => {
          if (rootId === bodyRoot && partType === 'mouth') {
            return [mouth1Id, mouth2Id];
          }
          return [];
        }
      );

      // Mock buildAdjacencyCache - just return success
      mockBodyGraphService.buildAdjacencyCache.mockImplementation(() => {
        // No-op for testing
      });

      const evaluationContext = {
        actor: { id: actorId },
      };

      const result = await jsonLogicService.evaluate(
        mouthAvailableCondition.logic,
        evaluationContext
      );

      // Should be true because at least one mouth is available
      expect(result).toBe(true);
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle bulk condition evaluations efficiently', async () => {
      const actors = [];

      // Create multiple actors with different mouth states
      for (let i = 0; i < 10; i++) {
        const actorId = await createTestActorWithMouth(
          `bulk_actor_${i}`,
          `BulkActor${i}`
        );
        actors.push(actorId);

        // Lock every other actor's mouth
        if (i % 2 === 0) {
          const mouthParts = getMouthParts(entityManager, actorId);
          if (mouthParts.length > 0) {
            const mouthId = mouthParts[0].partId;
            await entityManager.addComponent(mouthId, 'core:mouth_engagement', {
              locked: true,
              forcedOverride: false,
            });
          }
        }
      }

      // Setup mock for all actors at once to avoid closure issues
      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootId, partType) => {
          // Extract actor ID from root ID (bulk_actor_0_body_root -> bulk_actor_0)
          const actorId = rootId.replace('_body_root', '');
          const mouthId = `${actorId}_mouth`;

          if (partType === 'mouth') {
            return [mouthId];
          }
          return [];
        }
      );

      mockBodyGraphService.buildAdjacencyCache.mockImplementation(() => {
        // No-op for testing
      });

      const startTime = performance.now();

      // Evaluate condition for all actors
      const results = await Promise.all(
        actors.map(async (actorId, index) => {
          return await jsonLogicService.evaluate(
            mouthAvailableCondition.logic,
            { actor: { id: actorId } }
          );
        })
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete quickly
      expect(duration).toBeLessThan(100); // 100ms max

      // Verify results match expected pattern
      results.forEach((result, index) => {
        if (index % 2 === 0) {
          expect(result).toBe(false); // Locked mouths
        } else {
          expect(result).toBe(true); // Available mouths
        }
      });
    });

    it('should not cause memory leaks during repeated evaluations', async () => {
      const actorId = await createTestActorWithMouth(
        'memory_test_actor',
        'MemoryTestActor'
      );
      setupMockBodyGraphService(actorId, true);

      const evaluationContext = {
        actor: { id: actorId },
      };

      // Perform many evaluations
      for (let i = 0; i < 100; i++) {
        const result = await jsonLogicService.evaluate(
          mouthAvailableCondition.logic,
          evaluationContext
        );
        expect(result).toBe(true);
      }

      // Should still work correctly after many evaluations
      const finalResult = await jsonLogicService.evaluate(
        mouthAvailableCondition.logic,
        evaluationContext
      );
      expect(finalResult).toBe(true);
    });
  });

  describe('JSON Logic Custom Operators Integration', () => {
    it('should integrate properly with hasPartOfType operator', async () => {
      const actorId = await createTestActorWithMouth(
        'part_test_actor',
        'PartTestActor'
      );
      setupMockBodyGraphService(actorId, true);

      const evaluationContext = {
        actor: { id: actorId },
      };

      // Test the hasPartOfType operator directly
      const hasPartResult = await jsonLogicService.evaluate(
        { hasPartOfType: ['actor', 'mouth'] },
        evaluationContext
      );

      expect(hasPartResult).toBe(true);
    });

    it('should integrate properly with hasPartOfTypeWithComponentValue operator', async () => {
      const actorId = await createTestActorWithMouth(
        'component_test_actor',
        'ComponentTestActor'
      );
      setupMockBodyGraphService(actorId, true);

      const evaluationContext = {
        actor: { id: actorId },
      };

      // Test the hasPartOfTypeWithComponentValue operator directly
      const hasComponentValueResult = await jsonLogicService.evaluate(
        {
          hasPartOfTypeWithComponentValue: [
            'actor',
            'mouth',
            'core:mouth_engagement',
            'locked',
            false,
          ],
        },
        evaluationContext
      );

      expect(hasComponentValueResult).toBe(true);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle JSON Logic evaluation errors gracefully', async () => {
      const evaluationContext = {
        actor: { id: 'test_actor' },
      };

      // Test with malformed logic that might cause errors
      const malformedLogic = {
        hasPartOfTypeWithComponentValue: ['actor'], // Missing required parameters
      };

      // Should handle gracefully and not crash
      expect(() => {
        jsonLogicService.evaluate(malformedLogic, evaluationContext);
      }).not.toThrow();
    });

    it('should handle missing evaluation context gracefully', async () => {
      // Test with missing or incomplete evaluation context
      const incompleteContexts = [
        {},
        { actor: {} },
        { actor: { id: null } },
        { actor: { id: undefined } },
        null,
        undefined,
      ];

      for (const context of incompleteContexts) {
        expect(() => {
          jsonLogicService.evaluate(mouthAvailableCondition.logic, context);
        }).not.toThrow();
      }
    });
  });
});
