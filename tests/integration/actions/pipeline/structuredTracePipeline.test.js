/**
 * @file Integration tests for pipeline with structured tracing
 * @see src/actions/pipeline/Pipeline.js
 * @see src/actions/tracing/structuredTrace.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { StructuredTrace } from '../../../../src/actions/tracing/structuredTrace.js';
import { TraceContext } from '../../../../src/actions/tracing/traceContext.js';
import { Pipeline } from '../../../../src/actions/pipeline/Pipeline.js';
import { ComponentFilteringStage } from '../../../../src/actions/pipeline/stages/ComponentFilteringStage.js';
import { PrerequisiteEvaluationStage } from '../../../../src/actions/pipeline/stages/PrerequisiteEvaluationStage.js';
import { TargetResolutionStage } from '../../../../src/actions/pipeline/stages/TargetResolutionStage.js';
import { ActionFormattingStage } from '../../../../src/actions/pipeline/stages/ActionFormattingStage.js';

describe('Pipeline - Structured Trace Integration', () => {
  let pipeline;
  let structuredTrace;
  let regularTrace;
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
      format: jest.fn().mockReturnValue({ ok: true, value: 'formatted command' }),
    };

    mockEntityManager = {
      getEntityById: jest.fn(),
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
        mockLogger
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
    regularTrace = new TraceContext();
  });

  // afterEach(() => {
  //   jest.clearAllMocks();
  // });

  describe('Full pipeline execution with structured tracing', () => {
    it('should create spans for pipeline and each stage', async () => {
      // Arrange
      const actor = { id: 'test_actor', components: {} };
      const actionContext = { actorId: 'test_actor', currentTurn: 1 };
      
      // Set up mock actions
      const candidateActions = [
        {
          id: 'core:action1',
          name: 'Action 1',
          scope: { type: 'self' },
          prerequisites: [],
        },
        {
          id: 'core:action2',
          name: 'Action 2',
          scope: { type: 'adjacent' },
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

      // Act
      const result = await pipeline.execute({
        actor,
        actionContext,
        candidateActions,
        trace: structuredTrace,
      });

      // Assert
      expect(result.success).toBe(true);
      
      // Check spans were created
      const spans = structuredTrace.getSpans();
      expect(spans.length).toBeGreaterThan(0);
      
      // Check root span is Pipeline
      const hierarchicalView = structuredTrace.getHierarchicalView();
      expect(hierarchicalView.operation).toBe('Pipeline');
      expect(hierarchicalView.children.length).toBe(4); // 4 stages
      
      // Check each stage has a span
      const stageNames = ['ComponentFilteringStage', 'PrerequisiteEvaluationStage', 'TargetResolutionStage', 'ActionFormattingStage'];
      hierarchicalView.children.forEach((child, index) => {
        expect(child.operation).toBe(stageNames[index]);
        expect(child.status).toBe('success');
      });
    });

    it('should capture errors in spans when stage fails', async () => {
      // Arrange
      const actor = { id: 'test_actor', components: {} };
      const actionContext = { actorId: 'test_actor', currentTurn: 1 };
      
      // Make component filtering throw an error
      mockActionIndex.getCandidateActions.mockImplementation(() => {
        throw new Error('Test error in component filtering');
      });

      // Act
      const result = await pipeline.execute({
        actor,
        actionContext,
        candidateActions: [],
        trace: structuredTrace,
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Check error was captured in span
      const spans = structuredTrace.getSpans();
      const errorSpan = spans.find(s => s.status === 'error');
      expect(errorSpan).toBeDefined();
      expect(errorSpan.error).toBeDefined();
      expect(errorSpan.error.message).toContain('Test error in component filtering');
    });

    it('should provide accurate performance metrics', async () => {
      // Arrange
      const actor = { id: 'test_actor', components: {} };
      const actionContext = { actorId: 'test_actor', currentTurn: 1 };
      const candidateActions = [{
        id: 'core:action1',
        name: 'Action 1',
        scope: { type: 'self' },
        prerequisites: [],
      }];
      
      mockActionIndex.getCandidateActions.mockReturnValue(candidateActions);
      
      // Add artificial delay to test timing
      mockTargetResolutionService.resolveTargets.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return [{
          entityId: 'test_actor',
          type: 'actor',
          valid: true,
          position: { x: 0, y: 0 },
        }];
      });

      // Act
      const result = await pipeline.execute({
        actor,
        actionContext,
        candidateActions,
        trace: structuredTrace,
      });

      // Assert
      expect(result.success).toBe(true);
      
      // Check performance summary
      const perfSummary = structuredTrace.getPerformanceSummary();
      expect(perfSummary.totalDuration).toBeGreaterThan(0);
      expect(perfSummary.operationCount).toBe(5); // Pipeline + 4 stages
      expect(perfSummary.criticalPath.length).toBe(5);
      expect(perfSummary.criticalPath[0]).toBe('Pipeline');
      
      // Check operation stats
      expect(perfSummary.operationStats['Pipeline']).toBeDefined();
      expect(perfSummary.operationStats['TargetResolutionStage']).toBeGreaterThan(10);
    });
  });

  describe('Backward compatibility with regular TraceContext', () => {
    it('should work normally with regular TraceContext', async () => {
      // Arrange
      const actor = { id: 'test_actor', components: {} };
      const actionContext = { actorId: 'test_actor', currentTurn: 1 };
      const candidateActions = [{
        id: 'core:action1',
        name: 'Action 1',
        scope: { type: 'self' },
        prerequisites: [],
      }];
      
      mockActionIndex.getCandidateActions.mockReturnValue(candidateActions);
      mockTargetResolutionService.resolveTargets.mockResolvedValue([{
        entityId: 'test_actor',
        type: 'actor',
        valid: true,
        position: { x: 0, y: 0 },
      }]);

      // Act
      const result = await pipeline.execute({
        actor,
        actionContext,
        candidateActions: [],
        trace: regularTrace,
      });

      // Assert
      expect(result.success).toBe(true);
      
      // Check regular trace logs were created
      expect(regularTrace.logs.length).toBeGreaterThan(0);
      expect(regularTrace.logs.some(log => log.message.includes('Starting pipeline execution'))).toBe(true);
      expect(regularTrace.logs.some(log => log.message.includes('Pipeline execution completed'))).toBe(true);
    });

    it('should work without any trace context', async () => {
      // Arrange
      const actor = { id: 'test_actor', components: {} };
      const actionContext = { actorId: 'test_actor', currentTurn: 1 };
      const candidateActions = [{
        id: 'core:action1',
        name: 'Action 1',
        scope: { type: 'self' },
        prerequisites: [],
      }];
      
      mockActionIndex.getCandidateActions.mockReturnValue(candidateActions);
      mockTargetResolutionService.resolveTargets.mockResolvedValue([{
        entityId: 'test_actor',
        type: 'actor',
        valid: true,
        position: { x: 0, y: 0 },
      }]);

      // Act
      const result = await pipeline.execute({
        actor,
        actionContext,
        candidateActions: [],
        // No trace provided
      });

      // Assert
      expect(result.success).toBe(true);
      // Should work without any errors
    });
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
      mockTargetResolutionService.resolveTargets.mockResolvedValue([{
        entityId: 'test_actor',
        type: 'actor',
        valid: true,
        position: { x: 0, y: 0 },
      }]);

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

  describe('Stage failure scenarios', () => {
    it('should continue to capture spans when pipeline stops early', async () => {
      // Arrange
      const actor = { id: 'test_actor', components: {} };
      const actionContext = { actorId: 'test_actor', currentTurn: 1 };
      
      // Component filtering returns no candidates
      mockActionIndex.getCandidateActions.mockReturnValue([]);

      // Act
      const result = await pipeline.execute({
        actor,
        actionContext,
        candidateActions: [],
        trace: structuredTrace,
      });

      // Assert
      expect(result.success).toBe(true);
      
      // Only ComponentFilteringStage should have run
      const spans = structuredTrace.getSpans();
      expect(spans.length).toBe(2); // Pipeline + ComponentFilteringStage
      
      const hierarchicalView = structuredTrace.getHierarchicalView();
      expect(hierarchicalView.children.length).toBe(1);
      expect(hierarchicalView.children[0].operation).toBe('ComponentFilteringStage');
    });

    it.skip('should handle errors in individual stages gracefully', async () => {
      // Arrange
      const actor = { id: 'test_actor', components: {} };
      const actionContext = { actorId: 'test_actor', currentTurn: 1 };
      const candidateActions = [{
        id: 'core:action1',
        name: 'Action 1',
        scope: { type: 'self' },
        prerequisites: [],
      }];
      
      mockActionIndex.getCandidateActions.mockReturnValue(candidateActions);
      
      // Make target resolution throw for one action
      mockTargetResolutionService.resolveTargets.mockImplementation(() => {
        return Promise.reject(new Error('Failed to resolve targets'));
      });

      // Act
      const result = await pipeline.execute({
        actor,
        actionContext,
        candidateActions,
        trace: structuredTrace,
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Check spans show the error
      const perfSummary = structuredTrace.getPerformanceSummary();
      expect(perfSummary.errorCount).toBe(1);
      
      // Target resolution stage should have error status
      const spans = structuredTrace.getSpans();
      const targetResolutionSpan = spans.find(s => s.operation === 'TargetResolutionStage');
      expect(targetResolutionSpan.status).toBe('error');
    });
  });

  describe('Performance analysis features', () => {
    it('should identify critical path correctly', async () => {
      // Arrange
      const actor = { id: 'test_actor', components: {} };
      const actionContext = { actorId: 'test_actor', currentTurn: 1 };
      const candidateActions = [{
        id: 'core:action1',
        name: 'Action 1',
        scope: { type: 'self' },
        prerequisites: [],
      }];
      
      mockActionIndex.getCandidateActions.mockReturnValue(candidateActions);
      
      // Add delays to different stages
      mockTargetResolutionService.resolveTargets.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
        return [{
          entityId: 'test_actor',
          type: 'actor',
          valid: true,
          position: { x: 0, y: 0 },
        }];
      });

      // Act
      const result = await pipeline.execute({
        actor,
        actionContext,
        candidateActions,
        trace: structuredTrace,
      });

      // Assert
      expect(result.success).toBe(true);
      
      // Critical path should include all stages
      const criticalPath = structuredTrace.getCriticalPath();
      expect(criticalPath).toEqual([
        'Pipeline',
        'ComponentFilteringStage',
        'PrerequisiteEvaluationStage',
        'TargetResolutionStage',
        'ActionFormattingStage',
      ]);
      
      // Slowest operation should be TargetResolutionStage
      const perfSummary = structuredTrace.getPerformanceSummary();
      const slowestOp = perfSummary.slowestOperations[0];
      expect(slowestOp.operation).toBe('TargetResolutionStage');
      expect(slowestOp.duration).toBeGreaterThanOrEqual(20);
    });
  });
});