/**
 * @file Performance tests for pipeline with structured tracing
 * @see src/actions/pipeline/Pipeline.js
 * @see src/actions/tracing/structuredTrace.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { StructuredTrace } from '../../../src/actions/tracing/structuredTrace.js';
import { Pipeline } from '../../../src/actions/pipeline/Pipeline.js';
import { ComponentFilteringStage } from '../../../src/actions/pipeline/stages/ComponentFilteringStage.js';
import { PrerequisiteEvaluationStage } from '../../../src/actions/pipeline/stages/PrerequisiteEvaluationStage.js';
import { TargetResolutionStage } from '../../../src/actions/pipeline/stages/TargetResolutionStage.js';
import { ActionFormattingStage } from '../../../src/actions/pipeline/stages/ActionFormattingStage.js';

describe('Pipeline - Structured Trace Performance', () => {
  let pipeline;
  let structuredTrace;
  let mockLogger;
  let mockActionIndex;
  let mockErrorContextBuilder;
  let mockPrerequisiteEvaluationService;
  let mockTargetResolutionService;
  let mockCommandFormatter;
  let mockEntityManager;
  let mockSafeEventDispatcher;

  beforeEach(() => {
    // Create mocks
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockActionIndex = {
      getCandidateActions: jest.fn(),
    };

    mockErrorContextBuilder = {
      buildErrorContext: jest.fn().mockImplementation((params) => ({
        error: params.error?.message || params.error,
        phase: params.phase,
        actorId: params.actorId,
        additionalContext: params.additionalContext,
      })),
    };

    mockPrerequisiteEvaluationService = {
      evaluate: jest.fn().mockReturnValue(true),
    };

    mockTargetResolutionService = {
      resolveTargets: jest.fn(),
    };

    mockCommandFormatter = {
      format: jest
        .fn()
        .mockReturnValue({ ok: true, value: 'formatted command' }),
    };

    mockEntityManager = {
      getEntityById: jest.fn(),
      getAllComponentTypesForEntity: jest
        .fn()
        .mockReturnValue(['core:actor', 'core:position']),
    };

    mockSafeEventDispatcher = {
      dispatch: jest.fn(),
    };

    const getEntityDisplayNameFn = jest.fn().mockReturnValue('Test Entity');

    // Create test stages
    const stages = [
      new ComponentFilteringStage(
        mockActionIndex,
        mockErrorContextBuilder,
        mockLogger,
        mockEntityManager
      ),
      new PrerequisiteEvaluationStage(
        mockPrerequisiteEvaluationService,
        mockErrorContextBuilder,
        mockLogger
      ),
      new TargetResolutionStage(
        mockTargetResolutionService,
        mockErrorContextBuilder,
        mockLogger
      ),
      new ActionFormattingStage({
        commandFormatter: mockCommandFormatter,
        entityManager: mockEntityManager,
        safeEventDispatcher: mockSafeEventDispatcher,
        getEntityDisplayNameFn: getEntityDisplayNameFn,
        errorContextBuilder: mockErrorContextBuilder,
        logger: mockLogger,
      }),
    ];

    pipeline = new Pipeline(stages, mockLogger);
    structuredTrace = new StructuredTrace();
  });

  describe('Memory usage under load', () => {
    it('should handle large number of actions efficiently', async () => {
      // Arrange
      const actor = { id: 'test_actor', components: {} };
      const actionContext = { actorId: 'test_actor', currentTurn: 1 };

      // Create 100 candidate actions
      const candidateActions = [];
      for (let i = 0; i < 100; i++) {
        candidateActions.push({
          id: `core:action${i}`,
          name: `Action ${i}`,
          scope: { type: 'self' },
          prerequisites: [],
        });
      }

      mockActionIndex.getCandidateActions.mockReturnValue(candidateActions);
      mockTargetResolutionService.resolveTargets.mockResolvedValue([
        {
          entityId: 'test_actor',
          type: 'actor',
          valid: true,
          position: { x: 0, y: 0 },
        },
      ]);

      // Measure memory before
      const memBefore = process.memoryUsage().heapUsed;

      // Act
      const result = await pipeline.execute({
        actor,
        actionContext,
        candidateActions,
        trace: structuredTrace,
      });

      // Measure memory after
      const memAfter = process.memoryUsage().heapUsed;
      const memDiff = memAfter - memBefore;

      // Assert
      expect(result.success).toBe(true);

      // Check all spans were created
      const spans = structuredTrace.getSpans();
      expect(spans.length).toBe(5); // Pipeline + 4 stages

      // Memory usage should be reasonable (less than 10MB for 100 actions)
      expect(memDiff).toBeLessThan(10 * 1024 * 1024);

      // Performance should still be good
      const perfSummary = structuredTrace.getPerformanceSummary();
      expect(perfSummary.totalDuration).toBeLessThan(1000); // Less than 1 second
    });
  });

  describe('Performance analysis features', () => {
    it('should identify critical path correctly', async () => {
      // Arrange
      const actor = { id: 'test_actor', components: {} };
      const actionContext = { actorId: 'test_actor', currentTurn: 1 };
      const candidateActions = [
        {
          id: 'core:action1',
          name: 'Action 1',
          scope: { type: 'self' },
          prerequisites: [],
        },
      ];

      mockActionIndex.getCandidateActions.mockReturnValue(candidateActions);
      mockTargetResolutionService.resolveTargets.mockResolvedValue([
        {
          entityId: 'test_actor',
          type: 'actor',
          valid: true,
          position: { x: 0, y: 0 },
        },
      ]);

      // Act - execute the pipeline first
      const result = await pipeline.execute({
        actor,
        actionContext,
        candidateActions,
        trace: structuredTrace,
      });

      // Assert
      expect(result.success).toBe(true);

      // Now manually set the durations to be deterministic
      // This ensures our test is not dependent on actual execution time
      const allSpans = structuredTrace.getSpans();

      // Find each span and set its duration directly
      // We'll use Object.defineProperty to override the readonly duration getter
      allSpans.forEach((span) => {
        let mockedDuration;
        switch (span.operation) {
          case 'Pipeline':
            mockedDuration = 78; // Total time
            break;
          case 'ComponentFilteringStage':
            mockedDuration = 10;
            break;
          case 'PrerequisiteEvaluationStage':
            mockedDuration = 5;
            break;
          case 'TargetResolutionStage':
            mockedDuration = 50; // This is the slowest stage
            break;
          case 'ActionFormattingStage':
            mockedDuration = 8;
            break;
          default:
            mockedDuration = 1;
        }

        // Override the duration getter
        Object.defineProperty(span, 'duration', {
          get: () => mockedDuration,
          configurable: true,
        });
      });

      // Critical path should include Pipeline and the slowest stage (TargetResolutionStage with 50ms)
      const criticalPath = structuredTrace.getCriticalPath();
      expect(criticalPath).toEqual(['Pipeline', 'TargetResolutionStage']);

      // Pipeline should be the slowest operation (as it includes all stages)
      const perfSummary = structuredTrace.getPerformanceSummary();
      const slowestOp = perfSummary.slowestOperations[0];
      expect(slowestOp.operation).toBe('Pipeline');

      // TargetResolutionStage should be one of the slower stages
      const targetResolutionOp = perfSummary.slowestOperations.find(
        (op) => op.operation === 'TargetResolutionStage'
      );
      expect(targetResolutionOp).toBeDefined();
      expect(targetResolutionOp.duration).toBe(50); // Should have our mocked 50ms duration
    });
  });
});
