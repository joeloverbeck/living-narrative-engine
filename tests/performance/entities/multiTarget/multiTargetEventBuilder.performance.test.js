/**
 * @file Performance tests for MultiTargetEventBuilder
 * Tests performance characteristics of multi-target event building and command processing
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import MultiTargetEventBuilder from '../../../../src/entities/multiTarget/multiTargetEventBuilder.js';
import TargetExtractionResult from '../../../../src/entities/multiTarget/targetExtractionResult.js';
import CommandProcessor from '../../../../src/commands/commandProcessor.js';
import { ATTEMPT_ACTION_ID } from '../../../../src/constants/eventIds.js';

describe('MultiTargetEventBuilder Performance', () => {
  let testBed;
  let logger;
  let commandProcessor;
  let mockEventDispatcher;
  let mockEventDispatchService;
  let mockEntity;

  beforeEach(() => {
    testBed = createTestBed();
    logger = testBed.mockLogger;

    // Mock event dispatchers
    mockEventDispatcher = {
      dispatch: jest.fn().mockReturnValue(true),
    };

    mockEventDispatchService = {
      dispatchWithErrorHandling: jest.fn().mockResolvedValue({
        success: true,
        result: { message: 'Action completed successfully' },
      }),
    };

    // Mock entity
    mockEntity = {
      getId: () => 'actor1',
      getComponent: (componentId) => {
        if (componentId === 'core:entity_reference') {
          return { definitionId: 'core:human' };
        }
        if (componentId === 'core:name') {
          return { value: 'Test Actor' };
        }
        return null;
      },
    };

    // Mock safe event dispatcher
    const mockSafeEventDispatcher = {
      dispatch: jest.fn().mockReturnValue(true),
    };

    // Create CommandProcessor
    commandProcessor = new CommandProcessor({
      logger,
      eventDispatcher: mockEventDispatcher,
      safeEventDispatcher: mockSafeEventDispatcher,
      eventDispatchService: mockEventDispatchService,
      entityManager: testBed.mockEntityManager,
      unifiedScopeResolver: testBed.mockUnifiedScopeResolver,
      worldStateService: testBed.mockWorldStateService,
      notesService: testBed.mockNotesService,
      actionIndex: testBed.mockActionIndex,
      targetDependencyResolver: testBed.mockTargetDependencyResolver,
      multiTargetResolver: testBed.mockMultiTargetResolver,
      legacyTargetCompatibilityLayer:
        testBed.mockLegacyTargetCompatibilityLayer,
      targetSystemAdapter: testBed.mockTargetSystemAdapter,
      multiTargetEventBuilder: new MultiTargetEventBuilder({ logger }),
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Performance Integration', () => {
    it('should create payloads within acceptable time limits', async () => {
      const startTime = performance.now();

      // Create multiple payloads to test performance
      for (let i = 0; i < 100; i++) {
        const testAction = {
          actionDefinitionId: `core:test_action_${i}`,
          commandString: `test command ${i}`,
          resolvedParameters: {
            targetId: `target_${i}`,
            weapon: `weapon_${i}`,
          },
        };

        await commandProcessor.dispatchAction(mockEntity, testAction);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / 100;

      // Each payload should be created in less than 10ms as per CommandProcessor expectations
      expect(averageTime).toBeLessThan(10);
    });

    it('should provide performance statistics', () => {
      // Test that CommandProcessor tracks payload creation statistics
      const initialStats = commandProcessor.getPayloadCreationStatistics();
      expect(initialStats).toMatchObject({
        totalPayloadsCreated: expect.any(Number),
        multiTargetPayloads: expect.any(Number),
        legacyPayloads: expect.any(Number),
        fallbackPayloads: expect.any(Number),
        averageCreationTime: expect.any(Number),
      });
    });
  });
});
