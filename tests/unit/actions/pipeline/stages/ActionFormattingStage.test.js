/**
 * @file Unit tests for ActionFormattingStage - Enhanced Multi-Target Support
 * @see src/actions/pipeline/stages/ActionFormattingStage.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ActionFormattingStage } from '../../../../../src/actions/pipeline/stages/ActionFormattingStage.js';
import { PipelineResult } from '../../../../../src/actions/pipeline/PipelineResult.js';
import { MultiTargetActionFormatter } from '../../../../../src/actions/formatters/MultiTargetActionFormatter.js';
import { ERROR_PHASES } from '../../../../../src/actions/errors/actionErrorTypes.js';

describe('ActionFormattingStage - Enhanced Multi-Target Support', () => {
  let stage;
  let mockEntityManager;
  let mockFormatter;
  let mockMultiTargetFormatter;
  let mockSafeEventDispatcher;
  let mockGetEntityDisplayNameFn;
  let mockErrorContextBuilder;
  let mockLogger;
  let mockContext;

  beforeEach(() => {
    mockEntityManager = {
      getEntityInstance: jest.fn(),
    };

    mockFormatter = {
      format: jest.fn(),
    };

    mockMultiTargetFormatter = {
      format: jest.fn(),
      formatMultiTarget: jest.fn(),
    };

    mockSafeEventDispatcher = {
      dispatch: jest.fn().mockReturnValue(true),
    };

    mockGetEntityDisplayNameFn = jest.fn((id) => `Display_${id}`);

    mockErrorContextBuilder = {
      buildErrorContext: jest.fn().mockReturnValue({
        error: 'Mock error context',
        phase: ERROR_PHASES.VALIDATION,
        actorId: 'test-actor',
      }),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    stage = new ActionFormattingStage({
      commandFormatter: mockMultiTargetFormatter,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockSafeEventDispatcher,
      getEntityDisplayNameFn: mockGetEntityDisplayNameFn,
      errorContextBuilder: mockErrorContextBuilder,
      logger: mockLogger,
    });

    // Multi-target context
    mockContext = {
      actor: { id: 'player' },
      actionsWithTargets: [
        {
          actionDef: {
            id: 'test:multi_action',
            name: 'Use Item',
            template: 'use {item} on {target}',
          },
          targetContexts: [], // Legacy format for compatibility
        },
      ],
      resolvedTargets: {
        primary: [
          { id: 'item1', displayName: 'Sword' },
          { id: 'item2', displayName: 'Shield' },
        ],
        secondary: [
          { id: 'npc1', displayName: 'Goblin' },
          { id: 'npc2', displayName: 'Orc' },
        ],
      },
      targetDefinitions: {
        primary: { placeholder: 'item' },
        secondary: { placeholder: 'target' },
      },
    };
  });

  describe('Legacy Format Support', () => {
    it('should format legacy single-target actions', async () => {
      const legacyContext = {
        actor: { id: 'player' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:legacy',
              name: 'Attack',
              template: 'attack {target}',
            },
            targetContexts: [
              { entityId: 'enemy1', displayName: 'Goblin' },
              { entityId: 'enemy2', displayName: 'Orc' },
            ],
          },
        ],
      };

      mockMultiTargetFormatter.format.mockReturnValue({
        ok: true,
        value: 'attack Goblin',
      });

      const result = await stage.executeInternal(legacyContext);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(2);
      expect(result.actions[0]).toEqual({
        id: 'test:legacy',
        name: 'Attack',
        command: 'attack Goblin',
        description: '',
        params: { targetId: 'enemy1' },
      });
      expect(mockMultiTargetFormatter.format).toHaveBeenCalledTimes(2);
    });

    it('should handle empty actionsWithTargets array', async () => {
      const result = await stage.executeInternal({
        actor: { id: 'player' },
        actionsWithTargets: [],
      });

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Multi-Target Formatting', () => {
    it('should format multi-target action when formatter supports it', async () => {
      mockMultiTargetFormatter.formatMultiTarget.mockReturnValue({
        ok: true,
        value: 'use Sword on Goblin',
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0]).toEqual({
        id: 'test:multi_action',
        name: 'Use Item',
        command: 'use Sword on Goblin',
        description: '',
        params: {
          targetIds: {
            primary: ['item1', 'item2'],
            secondary: ['npc1', 'npc2'],
          },
          isMultiTarget: true,
        },
      });

      expect(mockMultiTargetFormatter.formatMultiTarget).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'test:multi_action' }),
        mockContext.resolvedTargets,
        mockEntityManager,
        expect.any(Object),
        expect.objectContaining({
          targetDefinitions: mockContext.targetDefinitions,
        })
      );
    });

    it('should fallback to legacy formatting when formatMultiTarget not available', async () => {
      // Remove formatMultiTarget method
      mockMultiTargetFormatter.formatMultiTarget = undefined;
      mockMultiTargetFormatter.format.mockReturnValue({
        ok: true,
        value: 'use Sword',
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(mockMultiTargetFormatter.format).toHaveBeenCalled();
    });

    it('should handle combination generation in formatter', async () => {
      mockContext.actionsWithTargets[0].actionDef.generateCombinations = true;

      mockMultiTargetFormatter.formatMultiTarget.mockReturnValue({
        ok: true,
        value: [
          'use Sword on Goblin',
          'use Sword on Orc',
          'use Shield on Goblin',
          'use Shield on Orc',
        ],
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(mockMultiTargetFormatter.formatMultiTarget).toHaveBeenCalled();
    });

    it('should handle multi-target actions with no targets', async () => {
      const emptyTargetsContext = {
        ...mockContext,
        resolvedTargets: {
          primary: [],
          secondary: [],
        },
      };

      mockMultiTargetFormatter.formatMultiTarget.mockReturnValue({
        ok: true,
        value: 'no targets available',
      });

      const result = await stage.executeInternal(emptyTargetsContext);

      expect(result.success).toBe(true);
      expect(mockMultiTargetFormatter.formatMultiTarget).toHaveBeenCalled();
    });
  });

  describe('Integration with MultiTargetResolutionStage', () => {
    it('should work with data from MultiTargetResolutionStage', async () => {
      // This test verifies the stage works with the actual data structure
      // provided by MultiTargetResolutionStage
      const pipelineContext = {
        actor: { id: 'player' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'combat:throw',
              name: 'Throw',
              template: 'throw {item} at {target}',
              targets: {
                primary: { scope: 'actor.inventory[]', placeholder: 'item' },
                secondary: {
                  scope: 'location.actors[]',
                  placeholder: 'target',
                },
              },
            },
            targetContexts: [
              { entityId: 'rock1', displayName: 'Small Rock' },
              { entityId: 'knife1', displayName: 'Knife' },
            ],
          },
        ],
        resolvedTargets: {
          primary: [{ id: 'rock1', displayName: 'Small Rock' }],
          secondary: [{ id: 'enemy1', displayName: 'Goblin' }],
        },
        targetDefinitions: {
          primary: { placeholder: 'item' },
          secondary: { placeholder: 'target' },
        },
      };

      mockMultiTargetFormatter.formatMultiTarget.mockReturnValue({
        ok: true,
        value: 'throw Small Rock at Goblin',
      });

      const result = await stage.executeInternal(pipelineContext);

      expect(result.success).toBe(true);
      expect(result.actions[0].command).toBe('throw Small Rock at Goblin');
    });

    it('should detect multi-target vs legacy context correctly', async () => {
      // Test with multi-target context
      await stage.executeInternal(mockContext);
      expect(mockMultiTargetFormatter.formatMultiTarget).toHaveBeenCalled();

      jest.clearAllMocks();

      // Test with legacy context (no resolvedTargets/targetDefinitions)
      const legacyContext = {
        actor: { id: 'player' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:legacy',
              name: 'Legacy Action',
              template: 'legacy {target}',
            },
            targetContexts: [{ entityId: 'target1', displayName: 'Target' }],
          },
        ],
      };

      mockMultiTargetFormatter.format.mockReturnValue({
        ok: true,
        value: 'legacy Target',
      });

      await stage.executeInternal(legacyContext);
      expect(mockMultiTargetFormatter.format).toHaveBeenCalled();
      expect(mockMultiTargetFormatter.formatMultiTarget).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle formatter errors gracefully', async () => {
      mockMultiTargetFormatter.formatMultiTarget.mockReturnValue({
        ok: false,
        error: 'Template parsing failed',
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true); // Stage succeeds but reports errors
      expect(result.errors).toHaveLength(1);
      expect(result.actions).toHaveLength(0);
      expect(mockErrorContextBuilder.buildErrorContext).toHaveBeenCalled();
    });

    it('should handle formatter throwing exceptions', async () => {
      const thrownError = new Error('Formatter exploded!');
      mockMultiTargetFormatter.formatMultiTarget.mockImplementation(() => {
        throw thrownError;
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(1);
      expect(result.actions).toHaveLength(0);
      expect(mockErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith(
        expect.objectContaining({
          error: thrownError,
        })
      );
    });

    it('should handle missing target data', async () => {
      const emptyContext = {
        actor: { id: 'player' },
        actionsWithTargets: [],
        resolvedTargets: {},
        targetDefinitions: {},
      };

      const result = await stage.executeInternal(emptyContext);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(0);
    });

    it('should handle formatter returning null/undefined', async () => {
      mockMultiTargetFormatter.formatMultiTarget.mockReturnValue(undefined);

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain compatibility with existing pipeline', async () => {
      // Test that the enhanced stage still works with the existing pipeline architecture
      const legacyContext = {
        actor: { id: 'player' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'basic:action',
              name: 'Basic Action',
              template: 'basic action',
            },
            targetContexts: [{ entityId: 'target1', displayName: 'Target' }],
          },
        ],
      };

      mockMultiTargetFormatter.format.mockReturnValue({
        ok: true,
        value: 'formatted action',
      });

      const result = await stage.executeInternal(legacyContext);

      expect(result.success).toBe(true);
      expect(mockMultiTargetFormatter.format).toHaveBeenCalled();
    });

    it('should handle mixed success and failure results', async () => {
      const mixedContext = {
        actor: { id: 'player' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:success',
              name: 'Success Action',
              template: 'success',
            },
            targetContexts: [{ entityId: 'target1', displayName: 'Target' }],
          },
          {
            actionDef: {
              id: 'test:fail',
              name: 'Fail Action',
              template: 'fail',
            },
            targetContexts: [{ entityId: 'target2', displayName: 'Target' }],
          },
        ],
      };

      let callCount = 0;
      mockMultiTargetFormatter.format.mockImplementation((actionDef) => {
        callCount++;
        if (actionDef.id === 'test:success') {
          return { ok: true, value: 'success command' };
        } else {
          return { ok: false, error: 'Format failed' };
        }
      });

      const result = await stage.executeInternal(mixedContext);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].id).toBe('test:success');
      expect(result.errors).toHaveLength(1);
      expect(callCount).toBe(2);
    });
  });

  describe('Helper Methods', () => {
    it('should extract target IDs correctly', async () => {
      mockMultiTargetFormatter.formatMultiTarget.mockReturnValue({
        ok: true,
        value: 'formatted command',
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.actions[0].params.targetIds).toEqual({
        primary: ['item1', 'item2'],
        secondary: ['npc1', 'npc2'],
      });
    });

    it('should get primary target context for fallback', async () => {
      // Remove formatMultiTarget to trigger fallback
      mockMultiTargetFormatter.formatMultiTarget = undefined;
      mockMultiTargetFormatter.format.mockReturnValue({
        ok: true,
        value: 'fallback command',
      });

      await stage.executeInternal(mockContext);

      expect(mockMultiTargetFormatter.format).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          entityId: 'item1',
          displayName: 'Sword',
        }),
        expect.any(Object),
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('Tracing Integration', () => {
    it('should record trace steps and info for multi-target actions', async () => {
      const trace = {
        step: jest.fn(),
        info: jest.fn(),
      };

      mockMultiTargetFormatter.formatMultiTarget.mockReturnValue({
        ok: true,
        value: 'traced command',
      });

      await stage.executeInternal({
        ...mockContext,
        trace,
      });

      expect(trace.step).toHaveBeenCalledWith(
        'Formatting 1 actions with their targets',
        'ActionFormattingStage.execute'
      );
      expect(trace.info).toHaveBeenCalledWith(
        'Multi-target action formatting completed: 1 formatted actions, 0 errors',
        'ActionFormattingStage.execute'
      );
    });

    it('should record trace steps for legacy actions', async () => {
      const trace = {
        step: jest.fn(),
        info: jest.fn(),
      };

      const legacyContext = {
        actor: { id: 'player' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:legacy',
              name: 'Legacy',
              template: 'legacy',
            },
            targetContexts: [{ entityId: 'target1', displayName: 'Target' }],
          },
        ],
        trace,
      };

      mockMultiTargetFormatter.format.mockReturnValue({
        ok: true,
        value: 'legacy command',
      });

      await stage.executeInternal(legacyContext);

      expect(trace.info).toHaveBeenCalledWith(
        'Action formatting completed: 1 formatted actions, 0 errors',
        'ActionFormattingStage.execute'
      );
    });
  });
});
