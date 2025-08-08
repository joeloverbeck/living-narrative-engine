/**
 * @file Integration tests for ActionFormattingStage with action tracing
 * @see src/actions/pipeline/stages/ActionFormattingStage.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ActionFormattingStage } from '../../../../src/actions/pipeline/stages/ActionFormattingStage.js';
import ActionAwareStructuredTrace from '../../../../src/actions/tracing/actionAwareStructuredTrace.js';
import ActionTraceFilter from '../../../../src/actions/tracing/actionTraceFilter.js';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';
import { ERROR_PHASES } from '../../../../src/actions/errors/actionErrorTypes.js';

describe('ActionFormattingStage - Integration with Action Tracing', () => {
  let formattingStage;
  let mockCommandFormatter;
  let mockEntityManager;
  let mockSafeEventDispatcher;
  let mockGetEntityDisplayNameFn;
  let mockErrorContextBuilder;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn().mockReturnValue({
        id: 'entity-1',
        name: 'Test Entity',
      }),
    };

    mockSafeEventDispatcher = {
      dispatch: jest.fn().mockReturnValue(true),
    };

    mockGetEntityDisplayNameFn = jest.fn((id) => `Display_${id}`);

    mockErrorContextBuilder = {
      buildErrorContext: jest
        .fn()
        .mockImplementation(({ error, actionDef, actorId, targetId }) => ({
          error: error?.message || error,
          actionId: actionDef.id,
          actorId,
          targetId,
          phase: ERROR_PHASES.VALIDATION,
        })),
    };

    mockCommandFormatter = {
      format: jest.fn(),
      formatMultiTarget: jest.fn(),
    };

    formattingStage = new ActionFormattingStage({
      commandFormatter: mockCommandFormatter,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockSafeEventDispatcher,
      getEntityDisplayNameFn: mockGetEntityDisplayNameFn,
      errorContextBuilder: mockErrorContextBuilder,
      logger: mockLogger,
    });
  });

  describe('Complete Formatting Workflow with Tracing', () => {
    it('should integrate action tracing into complete formatting workflow', async () => {
      const actionTraceFilter = new ActionTraceFilter({
        enabled: true,
        tracedActions: ['*'],
        verbosityLevel: 'verbose', // Changed to verbose to capture all data including statistics
        logger: mockLogger,
      });

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter,
        actorId: 'integration-test-actor',
        context: { integrationTest: true },
        logger: mockLogger,
      });

      const context = {
        trace,
        actor: { id: 'integration-test-actor' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'dialogue-action',
              name: 'Dialogue',
              template: '{actor} says to {target}: {text}',
            },
            targetContexts: [
              {
                type: 'entity',
                entityId: 'npc-bob',
                displayName: 'Bob',
              },
            ],
          },
          {
            actionDef: {
              id: 'multi-target-action',
              name: 'Multi Action',
              targets: {
                primary: { placeholder: 'primary' },
                secondary: { placeholder: 'secondary' },
              },
            },
            targetContexts: [
              { entityId: 'target-1', placeholder: 'primary' },
              { entityId: 'target-2', placeholder: 'secondary' },
            ],
            resolvedTargets: {
              primary: [{ id: 'target-1', displayName: 'Target 1' }],
              secondary: [{ id: 'target-2', displayName: 'Target 2' }],
            },
            targetDefinitions: {
              primary: { placeholder: 'primary' },
              secondary: { placeholder: 'secondary' },
            },
            isMultiTarget: true,
          },
        ],
      };

      // Set up mock responses
      mockCommandFormatter.format.mockReturnValue({
        ok: true,
        value: 'Actor says to Bob: Hello!',
      });

      mockCommandFormatter.formatMultiTarget.mockReturnValue({
        ok: true,
        value: 'Multi-target command executed',
      });

      const result = await formattingStage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions.length).toBeGreaterThan(0);

      // Verify trace data was captured
      const tracedActions = trace.getTracedActions();
      expect(tracedActions.size).toBeGreaterThan(0);

      // Check that each action has formatting data
      for (const [actionId, actionTrace] of tracedActions) {
        if (actionId !== '__stage_summary') {
          expect(actionTrace.stages.formatting).toBeDefined();
          expect(actionTrace.actorId).toBe('integration-test-actor');
        }
      }

      // Verify summary was captured
      const summaryTrace = trace.getActionTrace('__stage_summary');
      expect(summaryTrace).toBeDefined();
      expect(summaryTrace.stages).toBeDefined();
      expect(summaryTrace.stages.formatting).toBeDefined();
      expect(summaryTrace.stages.formatting.data).toBeDefined();
      expect(summaryTrace.stages.formatting.data.statistics).toBeDefined();
      expect(summaryTrace.stages.formatting.data.performance).toBeDefined();
    });

    it('should handle mixed formatting paths with comprehensive tracing', async () => {
      const actionTraceFilter = new ActionTraceFilter({
        enabled: true,
        tracedActions: ['*'],
        verbosityLevel: 'verbose',
        logger: mockLogger,
      });

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter,
        actorId: 'test-actor',
        context: {},
        logger: mockLogger,
      });

      const context = {
        trace,
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          // Per-action metadata with multi-target
          {
            actionDef: {
              id: 'action-multi',
              name: 'Multi Target Action',
              template: 'Use {item} on {target}',
            },
            targetContexts: [],
            resolvedTargets: {
              item: [{ id: 'sword', displayName: 'Sword' }],
              target: [{ id: 'enemy', displayName: 'Enemy' }],
            },
            targetDefinitions: {
              item: { placeholder: 'item' },
              target: { placeholder: 'target' },
            },
            isMultiTarget: true,
          },
          // Per-action metadata with legacy fallback
          {
            actionDef: {
              id: 'action-legacy',
              name: 'Legacy Action',
              template: 'Attack {target}',
            },
            targetContexts: [{ entityId: 'goblin', displayName: 'Goblin' }],
            resolvedTargets: null,
            targetDefinitions: null,
            isMultiTarget: false,
          },
          // Pure legacy action
          {
            actionDef: {
              id: 'action-simple',
              name: 'Simple Action',
              template: 'Look at {target}',
            },
            targetContexts: [{ entityId: 'door', displayName: 'Door' }],
          },
        ],
      };

      mockCommandFormatter.formatMultiTarget.mockReturnValue({
        ok: true,
        value: 'Use Sword on Enemy',
      });

      mockCommandFormatter.format.mockReturnValue({
        ok: true,
        value: 'Formatted command',
      });

      const result = await formattingStage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(3);

      // Verify all actions were traced
      const tracedActions = trace.getTracedActions();
      expect(tracedActions.has('action-multi')).toBe(true);
      expect(tracedActions.has('action-legacy')).toBe(true);
      expect(tracedActions.has('action-simple')).toBe(true);

      // Verify summary statistics
      const summaryTrace = trace.getActionTrace('__stage_summary');
      expect(summaryTrace).toBeDefined();
      expect(summaryTrace.stages).toBeDefined();
      expect(summaryTrace.stages.formatting).toBeDefined();
      const stats = summaryTrace.stages.formatting.data.statistics;
      expect(stats.total).toBe(3);
      expect(stats.successful).toBeGreaterThan(0);
      expect(stats.multiTarget).toBeGreaterThan(0);
      expect(stats.legacy).toBeGreaterThan(0);
    });

    it('should capture error scenarios with full context', async () => {
      const actionTraceFilter = new ActionTraceFilter({
        enabled: true,
        tracedActions: ['*'],
        verbosityLevel: 'verbose', // Changed to verbose to capture all data including errors
        logger: mockLogger,
      });

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter,
        actorId: 'test-actor',
        context: {},
        logger: mockLogger,
      });

      const context = {
        trace,
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'failing-action',
              name: 'Failing Action',
              template: 'Do {action}',
            },
            targetContexts: [{ entityId: 'target' }],
          },
          {
            actionDef: {
              id: 'throwing-action',
              name: 'Throwing Action',
              template: 'Execute {command}',
            },
            targetContexts: [{ entityId: 'target' }],
          },
        ],
      };

      // First formatter returns error
      mockCommandFormatter.format
        .mockReturnValueOnce({
          ok: false,
          error: 'Template validation failed',
        })
        .mockImplementationOnce(() => {
          throw new Error('Formatter exception');
        });

      const result = await formattingStage.executeInternal(context);

      // Should still return result with errors
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(2);

      // Verify error traces were captured
      const failingTrace = trace.getActionTrace('failing-action');
      expect(failingTrace).toBeDefined();

      const throwingTrace = trace.getActionTrace('throwing-action');
      expect(throwingTrace).toBeDefined();

      // Verify summary shows errors
      const summaryTrace = trace.getActionTrace('__stage_summary');
      expect(summaryTrace).toBeDefined();
      expect(summaryTrace.stages).toBeDefined();
      expect(summaryTrace.stages.formatting).toBeDefined();
      expect(summaryTrace.stages.formatting.data).toBeDefined();
      expect(summaryTrace.stages.formatting.data.errors).toBe(2);
      expect(
        summaryTrace.stages.formatting.data.statistics.failed
      ).toBeGreaterThan(0);
    });

    it('should track performance metrics across all actions', async () => {
      const actionTraceFilter = new ActionTraceFilter({
        enabled: true,
        tracedActions: ['*'],
        verbosityLevel: 'verbose',
        logger: mockLogger,
      });

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter,
        actorId: 'performance-test-actor',
        context: {},
        logger: mockLogger,
      });

      // Create 10 actions for performance testing
      const actionsWithTargets = Array(10)
        .fill()
        .map((_, i) => ({
          actionDef: {
            id: `action-${i}`,
            name: `Action ${i}`,
            template: 'Execute {target}',
          },
          targetContexts: [
            {
              entityId: `target-${i}`,
              displayName: `Target ${i}`,
            },
          ],
        }));

      const context = {
        trace,
        actor: { id: 'performance-test-actor' },
        actionsWithTargets,
      };

      // Simulate some processing time
      mockCommandFormatter.format.mockImplementation(() => {
        // Small delay to simulate processing
        const start = Date.now();
        while (Date.now() - start < 1) {
          // busy wait for 1ms
        }
        return {
          ok: true,
          value: 'Formatted',
        };
      });

      const startTime = Date.now();
      const result = await formattingStage.executeInternal(context);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(10);

      // Verify performance metrics
      const summaryTrace = trace.getActionTrace('__stage_summary');
      expect(summaryTrace).toBeDefined();
      expect(summaryTrace.stages).toBeDefined();
      expect(summaryTrace.stages.formatting).toBeDefined();
      const performance = summaryTrace.stages.formatting.data.performance;

      expect(performance.totalDuration).toBeDefined();
      expect(performance.totalDuration).toBeGreaterThan(0);
      expect(performance.totalDuration).toBeLessThanOrEqual(
        endTime - startTime
      );

      expect(performance.averagePerAction).toBeDefined();
      expect(performance.averagePerAction).toBe(performance.totalDuration / 10);

      // Verify each action has individual performance metrics
      for (let i = 0; i < 10; i++) {
        const actionTrace = trace.getActionTrace(`action-${i}`);
        expect(actionTrace).toBeDefined();
        expect(actionTrace.stages).toBeDefined();
        // Look for the formatting stage specifically
        const formattingStageData = actionTrace.stages.formatting;
        expect(formattingStageData).toBeDefined();
        expect(formattingStageData.data).toBeDefined();
        expect(formattingStageData.data.performance).toBeDefined();
        expect(
          formattingStageData.data.performance.duration
        ).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle fallback scenarios with detailed tracing', async () => {
      const actionTraceFilter = new ActionTraceFilter({
        enabled: true,
        tracedActions: ['*'],
        verbosityLevel: 'verbose', // Changed to verbose to capture all data including fallback flags
        logger: mockLogger,
      });

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter,
        actorId: 'fallback-test-actor',
        context: {},
        logger: mockLogger,
      });

      // Fix: The actionsWithTargets should have per-action metadata for the new path
      const context = {
        trace,
        actor: { id: 'fallback-test-actor' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'multi-target-with-fallback',
              name: 'Multi Target With Fallback',
              template: 'Use {primary} on {secondary}',
              targets: {
                primary: { placeholder: 'primary' },
                secondary: { placeholder: 'secondary' },
              },
            },
            targetContexts: [],
            // Add per-action metadata to trigger the new formatting path
            resolvedTargets: {
              primary: [{ id: 'target-1', displayName: 'Primary Target' }],
              secondary: [{ id: 'target-2', displayName: 'Secondary Target' }],
            },
            targetDefinitions: {
              primary: { placeholder: 'primary' },
              secondary: { placeholder: 'secondary' },
            },
            isMultiTarget: true,
          },
        ],
      };

      // Multi-target fails, fallback to legacy succeeds
      mockCommandFormatter.formatMultiTarget.mockReturnValue({
        ok: false,
        error: 'Multi-target not supported for this action',
      });

      mockCommandFormatter.format.mockReturnValue({
        ok: true,
        value: 'Fallback: Use Primary Target',
      });

      const result = await formattingStage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].command).toBe('Fallback: Use Primary Target');

      // Verify fallback was traced
      const actionTrace = trace.getActionTrace('multi-target-with-fallback');
      expect(actionTrace).toBeDefined();
      expect(actionTrace.stages).toBeDefined();

      // The fallback flag should be in the formatting stage data
      const formattingStageData = actionTrace.stages.formatting;
      expect(formattingStageData).toBeDefined();
      expect(formattingStageData.data).toBeDefined();
      expect(formattingStageData.data.fallbackUsed).toBe(true);

      // Verify formatter was called for fallback
      expect(mockCommandFormatter.formatMultiTarget).toHaveBeenCalled();
      expect(mockCommandFormatter.format).toHaveBeenCalled();
    });

    it('should work correctly with selective action tracing', async () => {
      const actionTraceFilter = new ActionTraceFilter({
        enabled: true,
        tracedActions: ['important-*'], // Only trace actions starting with 'important-'
        verbosityLevel: 'verbose',
        logger: mockLogger,
      });

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter,
        actorId: 'selective-test-actor',
        context: {},
        logger: mockLogger,
      });

      const context = {
        trace,
        actor: { id: 'selective-test-actor' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'important-action',
              name: 'Important Action',
              template: 'Do important {thing}',
            },
            targetContexts: [{ entityId: 'target-1' }],
          },
          {
            actionDef: {
              id: 'normal-action',
              name: 'Normal Action',
              template: 'Do normal {thing}',
            },
            targetContexts: [{ entityId: 'target-2' }],
          },
        ],
      };

      mockCommandFormatter.format.mockReturnValue({
        ok: true,
        value: 'Formatted',
      });

      const result = await formattingStage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(2);

      // Only important-action should be traced
      const tracedActions = trace.getTracedActions();
      expect(tracedActions.has('important-action')).toBe(true);
      expect(tracedActions.has('normal-action')).toBe(false);

      // Stage summary should still be captured
      expect(tracedActions.has('__stage_summary')).toBe(true);
    });
  });

  describe('Performance Benchmarking', () => {
    it('should demonstrate minimal performance overhead with tracing', async () => {
      // Run without tracing
      const contextWithoutTracing = {
        trace: null,
        actor: { id: 'benchmark-actor' },
        actionsWithTargets: Array(100)
          .fill()
          .map((_, i) => ({
            actionDef: {
              id: `action-${i}`,
              name: `Action ${i}`,
              template: 'Execute {target}',
            },
            targetContexts: [
              {
                entityId: `target-${i}`,
                displayName: `Target ${i}`,
              },
            ],
          })),
      };

      mockCommandFormatter.format.mockReturnValue({
        ok: true,
        value: 'Formatted',
      });

      const startWithout = performance.now();
      await formattingStage.executeInternal(contextWithoutTracing);
      const endWithout = performance.now();
      const timeWithoutTracing = endWithout - startWithout;

      // Run with tracing
      const actionTraceFilter = new ActionTraceFilter({
        enabled: true,
        tracedActions: ['*'],
        verbosityLevel: 'verbose',
        logger: mockLogger,
      });

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter,
        actorId: 'benchmark-actor',
        context: {},
        logger: mockLogger,
      });

      const contextWithTracing = {
        ...contextWithoutTracing,
        trace,
      };

      const startWith = performance.now();
      await formattingStage.executeInternal(contextWithTracing);
      const endWith = performance.now();
      const timeWithTracing = endWith - startWith;

      // Tracing overhead should be less than 5ms per action (500ms for 100 actions)
      const overhead = timeWithTracing - timeWithoutTracing;
      expect(overhead).toBeLessThan(500);

      // Verify all actions were traced
      const summaryTrace = trace.getActionTrace('__stage_summary');
      expect(summaryTrace).toBeDefined();
      expect(summaryTrace.stages).toBeDefined();
      expect(summaryTrace.stages.formatting).toBeDefined();
      expect(summaryTrace.stages.formatting.data.statistics.total).toBe(100);
    });
  });
});
