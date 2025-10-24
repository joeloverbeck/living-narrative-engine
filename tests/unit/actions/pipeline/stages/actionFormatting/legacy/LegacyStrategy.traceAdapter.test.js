/**
 * @file Unit tests for LegacyStrategy trace adapter functionality
 * Tests the adapter behavior indirectly through the format() method
 */

import { LegacyStrategy } from '../../../../../../../src/actions/pipeline/stages/actionFormatting/legacy/LegacyStrategy.js';

/**
 * Helper to create a minimal LegacyStrategy instance for testing
 */
const createStrategy = () => {
  const commandFormatter = {
    format: jest.fn(() => ({ ok: true, value: 'test command' })),
    formatMultiTarget: jest.fn(),
  };

  const fallbackFormatter = {
    formatWithFallback: jest.fn(),
  };

  const logger = {
    debug: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  };

  const targetNormalizationService = {
    normalize: jest.fn(() => ({
      error: null,
      params: { normalized: true },
      targetIds: { primary: ['target-1'] },
    })),
  };

  const createError = jest.fn(
    (payload, action, actorId, trace, resolvedTargetId, originalTargetId) => ({
      payload,
      actionId: action.id,
      actorId,
      resolvedTargetId,
      originalTargetId,
    })
  );

  const validateVisualProperties = jest.fn();

  const entityManager = {
    getEntityInstance: jest.fn((entityId) => ({ id: entityId, managed: true })),
  };

  const dependencies = {
    commandFormatter,
    entityManager,
    safeEventDispatcher: {},
    getEntityDisplayNameFn: jest.fn(),
    logger,
    fallbackFormatter,
    createError,
    targetNormalizationService,
    validateVisualProperties,
  };

  const strategy = new LegacyStrategy(dependencies);

  return {
    strategy,
    commandFormatter,
    logger,
    validateVisualProperties,
  };
};

describe('LegacyStrategy - Trace Adapter', () => {
  describe('Action-Aware Adapter Behavior', () => {
    it('should capture start event when trace has captureActionData method', async () => {
      const { strategy } = createStrategy();
      const mockTrace = {
        captureActionData: jest.fn(),
        info: jest.fn(),
      };
      const processingStats = {};

      await strategy.format({
        actor: { id: 'actor-1' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test-action',
              name: 'Test Action',
              description: 'Test',
            },
            targetContexts: [{ entityId: 'target-1', displayName: 'Target 1' }],
          },
        ],
        trace: mockTrace,
        processingStats,
        traceSource: 'test',
      });

      // Verify captureActionData was called for start event
      const startEventCall = mockTrace.captureActionData.mock.calls.find(
        (call) => call[2].status === 'formatting'
      );

      expect(startEventCall).toBeDefined();
      expect(startEventCall[0]).toBe('formatting');
      expect(startEventCall[1]).toBe('test-action');
      expect(startEventCall[2]).toMatchObject({
        status: 'formatting',
        formattingPath: 'legacy',
        targetContextCount: 1,
      });
    });

    it('should capture end event with completed status for single-target action', async () => {
      const { strategy } = createStrategy();
      const mockTrace = {
        captureActionData: jest.fn(),
        info: jest.fn(),
      };
      const processingStats = {};

      await strategy.format({
        actor: { id: 'actor-1' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test-action',
              name: 'Test Action',
              description: 'Test',
            },
            targetContexts: [
              { entityId: 'target-1', displayName: 'Target 1' },
              { entityId: 'target-2', displayName: 'Target 2' },
            ],
          },
        ],
        trace: mockTrace,
        processingStats,
        traceSource: 'test',
      });

      // Verify captureActionData was called for end event with completed status
      expect(mockTrace.captureActionData).toHaveBeenCalledWith(
        'formatting',
        'test-action',
        expect.objectContaining({
          status: 'completed',
          formatterMethod: 'format',
          successCount: 2,
          failureCount: 0,
        })
      );
    });

    it('should capture end event with partial status when some targets fail', async () => {
      const { strategy, commandFormatter } = createStrategy();
      const mockTrace = {
        captureActionData: jest.fn(),
        info: jest.fn(),
      };
      const processingStats = {};

      // Make first target succeed, second fail
      commandFormatter.format
        .mockReturnValueOnce({ ok: true, value: 'command 1' })
        .mockReturnValueOnce({ ok: false, error: 'Failed' });

      await strategy.format({
        actor: { id: 'actor-1' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test-action',
              name: 'Test Action',
              description: 'Test',
            },
            targetContexts: [
              { entityId: 'target-1', displayName: 'Target 1' },
              { entityId: 'target-2', displayName: 'Target 2' },
            ],
          },
        ],
        trace: mockTrace,
        processingStats,
        traceSource: 'test',
      });

      // Verify end event shows partial status
      expect(mockTrace.captureActionData).toHaveBeenCalledWith(
        'formatting',
        'test-action',
        expect.objectContaining({
          status: 'partial',
          successCount: 1,
          failureCount: 1,
        })
      );
    });

    it('should increment statistics in action-aware mode', async () => {
      const { strategy } = createStrategy();
      const mockTrace = {
        captureActionData: jest.fn(),
        info: jest.fn(),
      };
      const processingStats = {};

      await strategy.format({
        actor: { id: 'actor-1' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test-action',
              name: 'Test Action',
              description: 'Test',
            },
            targetContexts: [{ entityId: 'target-1', displayName: 'Target 1' }],
          },
        ],
        trace: mockTrace,
        processingStats,
        traceSource: 'test',
      });

      // Verify statistics were incremented
      expect(processingStats.successful).toBe(1);
      expect(processingStats.legacy).toBe(1);
    });

    it('should capture multi-target action metadata correctly', async () => {
      const { strategy, commandFormatter } = createStrategy();
      const mockTrace = {
        captureActionData: jest.fn(),
        info: jest.fn(),
      };
      const processingStats = {};

      commandFormatter.formatMultiTarget = jest.fn(() => ({
        ok: true,
        value: 'multi-target command',
      }));

      await strategy.format({
        actor: { id: 'actor-1' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'multi-action',
              name: 'Multi Action',
              description: 'Test',
              targets: {
                primary: { placeholder: 'primary' },
                secondary: { placeholder: 'secondary' },
              },
            },
            targetContexts: [
              {
                entityId: 'target-1',
                displayName: 'Target 1',
                placeholder: 'primary',
              },
              {
                entityId: 'target-2',
                displayName: 'Target 2',
                placeholder: 'secondary',
              },
            ],
          },
        ],
        trace: mockTrace,
        processingStats,
        traceSource: 'test',
      });

      // Verify multi-target metadata in start event
      expect(mockTrace.captureActionData).toHaveBeenCalledWith(
        'formatting',
        'multi-action',
        expect.objectContaining({
          isMultiTargetInLegacy: true,
          targetContextCount: 2,
        })
      );
    });

    it('should calculate performance duration in end event', async () => {
      const { strategy } = createStrategy();
      const mockTrace = {
        captureActionData: jest.fn(),
        info: jest.fn(),
      };
      const processingStats = {};

      await strategy.format({
        actor: { id: 'actor-1' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test-action',
              name: 'Test Action',
              description: 'Test',
            },
            targetContexts: [{ entityId: 'target-1', displayName: 'Target 1' }],
          },
        ],
        trace: mockTrace,
        processingStats,
        traceSource: 'test',
      });

      // Verify performance data is captured in end event
      const endCallArgs = mockTrace.captureActionData.mock.calls.find(
        (call) => call[2].status !== 'formatting'
      );

      expect(endCallArgs[2]).toHaveProperty('performance');
      expect(endCallArgs[2].performance).toHaveProperty('duration');
      expect(typeof endCallArgs[2].performance.duration).toBe('number');
      expect(endCallArgs[2].performance.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Standard Adapter Behavior (No-op Trace)', () => {
    it('should not call captureActionData when trace lacks the method', async () => {
      const { strategy } = createStrategy();
      const mockTrace = {
        info: jest.fn(), // Standard trace without captureActionData
      };

      await strategy.format({
        actor: { id: 'actor-1' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test-action',
              name: 'Test Action',
              description: 'Test',
            },
            targetContexts: [{ entityId: 'target-1', displayName: 'Target 1' }],
          },
        ],
        trace: mockTrace,
        traceSource: 'test',
      });

      // Standard trace should only call info, never captureActionData
      expect(mockTrace.info).toHaveBeenCalled();
    });

    it('should not throw when trace is undefined', async () => {
      const { strategy } = createStrategy();

      await expect(
        strategy.format({
          actor: { id: 'actor-1' },
          actionsWithTargets: [
            {
              actionDef: {
                id: 'test-action',
                name: 'Test Action',
                description: 'Test',
              },
              targetContexts: [
                { entityId: 'target-1', displayName: 'Target 1' },
              ],
            },
          ],
          trace: undefined,
          traceSource: 'test',
        })
      ).resolves.toBeDefined();
    });

    it('should not increment statistics when processingStats is undefined in standard mode', async () => {
      const { strategy } = createStrategy();
      const mockTrace = {
        info: jest.fn(),
      };

      // Should not throw when processingStats is undefined
      await expect(
        strategy.format({
          actor: { id: 'actor-1' },
          actionsWithTargets: [
            {
              actionDef: {
                id: 'test-action',
                name: 'Test Action',
                description: 'Test',
              },
              targetContexts: [
                { entityId: 'target-1', displayName: 'Target 1' },
              ],
            },
          ],
          trace: mockTrace,
          processingStats: undefined,
          traceSource: 'test',
        })
      ).resolves.toBeDefined();
    });

    it('should handle null trace gracefully', async () => {
      const { strategy } = createStrategy();

      await expect(
        strategy.format({
          actor: { id: 'actor-1' },
          actionsWithTargets: [
            {
              actionDef: {
                id: 'test-action',
                name: 'Test Action',
                description: 'Test',
              },
              targetContexts: [
                { entityId: 'target-1', displayName: 'Target 1' },
              ],
            },
          ],
          trace: null,
          traceSource: 'test',
        })
      ).resolves.toBeDefined();
    });
  });

  describe('Statistics Increment Behavior', () => {
    it('should increment multiple statistics correctly', async () => {
      const { strategy, commandFormatter } = createStrategy();
      const mockTrace = {
        captureActionData: jest.fn(),
        info: jest.fn(),
      };
      const processingStats = {};

      // Format two actions
      await strategy.format({
        actor: { id: 'actor-1' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'action-1',
              name: 'Action 1',
              description: 'Test',
            },
            targetContexts: [{ entityId: 'target-1', displayName: 'Target 1' }],
          },
          {
            actionDef: {
              id: 'action-2',
              name: 'Action 2',
              description: 'Test',
            },
            targetContexts: [{ entityId: 'target-2', displayName: 'Target 2' }],
          },
        ],
        trace: mockTrace,
        processingStats,
        traceSource: 'test',
      });

      // Both should increment successful and legacy
      expect(processingStats.successful).toBe(2);
      expect(processingStats.legacy).toBe(2);
    });

    it('should handle mixed success and failure statistics', async () => {
      const { strategy, commandFormatter } = createStrategy();
      const mockTrace = {
        captureActionData: jest.fn(),
        info: jest.fn(),
      };
      const processingStats = {};

      // First action succeeds, second fails
      commandFormatter.format
        .mockReturnValueOnce({ ok: true, value: 'command 1' })
        .mockReturnValueOnce({ ok: false, error: 'Failed' });

      await strategy.format({
        actor: { id: 'actor-1' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'action-1',
              name: 'Action 1',
              description: 'Test',
            },
            targetContexts: [{ entityId: 'target-1', displayName: 'Target 1' }],
          },
          {
            actionDef: {
              id: 'action-2',
              name: 'Action 2',
              description: 'Test',
            },
            targetContexts: [{ entityId: 'target-2', displayName: 'Target 2' }],
          },
        ],
        trace: mockTrace,
        processingStats,
        traceSource: 'test',
      });

      // One successful, one failed
      expect(processingStats.successful).toBe(1);
      expect(processingStats.legacy).toBe(1);
      expect(processingStats.failed).toBe(1);
    });

    it('should not throw when incrementing stats on non-object', async () => {
      const { strategy } = createStrategy();
      const mockTrace = {
        captureActionData: jest.fn(),
        info: jest.fn(),
      };

      // Pass non-object as processingStats - should not throw
      await expect(
        strategy.format({
          actor: { id: 'actor-1' },
          actionsWithTargets: [
            {
              actionDef: {
                id: 'test-action',
                name: 'Test Action',
                description: 'Test',
              },
              targetContexts: [
                { entityId: 'target-1', displayName: 'Target 1' },
              ],
            },
          ],
          trace: mockTrace,
          processingStats: 'not-an-object',
          traceSource: 'test',
        })
      ).resolves.toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty targetContexts array', async () => {
      const { strategy } = createStrategy();
      const mockTrace = {
        captureActionData: jest.fn(),
        info: jest.fn(),
      };
      const processingStats = {};

      await strategy.format({
        actor: { id: 'actor-1' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test-action',
              name: 'Test Action',
              description: 'Test',
            },
            targetContexts: [],
          },
        ],
        trace: mockTrace,
        processingStats,
        traceSource: 'test',
      });

      // Should still capture start event with 0 targets
      expect(mockTrace.captureActionData).toHaveBeenCalledWith(
        'formatting',
        'test-action',
        expect.objectContaining({
          targetContextCount: 0,
        })
      );
    });

    it('should handle empty actionsWithTargets array', async () => {
      const { strategy } = createStrategy();
      const mockTrace = {
        captureActionData: jest.fn(),
        info: jest.fn(),
      };
      const processingStats = {};

      const result = await strategy.format({
        actor: { id: 'actor-1' },
        actionsWithTargets: [],
        trace: mockTrace,
        processingStats,
        traceSource: 'test',
      });

      // Should return successfully with no formatted actions
      expect(result.formattedCommands).toEqual([]);
      expect(result.errors).toEqual([]);
    });
  });
});
