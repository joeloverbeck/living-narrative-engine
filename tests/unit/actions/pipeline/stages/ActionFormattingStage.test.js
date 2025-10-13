/**
 * @file Unit tests for ActionFormattingStage - Enhanced Multi-Target Support and Action Tracing
 * @see src/actions/pipeline/stages/ActionFormattingStage.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ActionFormattingStage } from '../../../../../src/actions/pipeline/stages/ActionFormattingStage.js';
import { PipelineResult } from '../../../../../src/actions/pipeline/PipelineResult.js';
import { MultiTargetActionFormatter } from '../../../../../src/actions/formatters/MultiTargetActionFormatter.js';
import { ERROR_PHASES } from '../../../../../src/actions/errors/actionErrorTypes.js';
import ActionAwareStructuredTrace from '../../../../../src/actions/tracing/actionAwareStructuredTrace.js';
import { StructuredTrace } from '../../../../../src/actions/tracing/structuredTrace.js';

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
            template: 'use {item} on {enemy}',
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
        secondary: { placeholder: 'enemy' },
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
        visual: null,
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
        visual: null,
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

  describe('Mixed Action Type Warning Coverage', () => {
    it('should log warning when processing mixed legacy and multi-target actions', async () => {
      const mixedContext = {
        actor: { id: 'player' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'legacy:action',
              name: 'Legacy Action',
              template: 'legacy {target}',
            },
            targetContexts: [{ entityId: 'target1', displayName: 'Target' }],
          },
          {
            actionDef: {
              id: 'multi:action',
              name: 'Multi Action',
              template: 'multi {item} {target}',
              targets: {
                primary: { placeholder: 'item' },
                secondary: { placeholder: 'target' },
              },
            },
            targetContexts: [{ entityId: 'target2', displayName: 'Target2' }],
          },
        ],
      };

      mockMultiTargetFormatter.format.mockReturnValue({
        ok: true,
        value: 'formatted action',
      });

      await stage.executeInternal(mixedContext);

      // Verify warning was logged for mixed action types in legacy path
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Processing mixed legacy and multi-target actions through legacy formatting path. ' +
          'Multi-target actions will be handled individually with fallback formatting.'
      );
    });

    it('should not log warning when all actions are legacy format', async () => {
      const legacyOnlyContext = {
        actor: { id: 'player' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'legacy1:action',
              name: 'Legacy Action 1',
              template: 'legacy1 {target}',
            },
            targetContexts: [{ entityId: 'target1', displayName: 'Target1' }],
          },
          {
            actionDef: {
              id: 'legacy2:action',
              name: 'Legacy Action 2',
              template: 'legacy2 {target}',
            },
            targetContexts: [{ entityId: 'target2', displayName: 'Target2' }],
          },
        ],
      };

      mockMultiTargetFormatter.format.mockReturnValue({
        ok: true,
        value: 'formatted action',
      });

      await stage.executeInternal(legacyOnlyContext);

      // Should not log warning for all legacy actions
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining(
          'Processing mixed legacy and multi-target actions'
        )
      );
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

  describe('Multi-Target Fallback Coverage', () => {
    it('should fallback to legacy formatting when multi-target fails with primary target', async () => {
      // Test covers lines 161-181
      mockMultiTargetFormatter.formatMultiTarget.mockReturnValue({
        ok: false,
        error: 'Multi-target formatting failed',
        details: { reason: 'Template parsing error' },
      });

      mockMultiTargetFormatter.format.mockReturnValue({
        ok: true,
        value: 'fallback: use Sword',
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0]).toEqual({
        id: 'test:multi_action',
        name: 'Use Item',
        command: 'fallback: use Sword',
        description: '',
        params: { targetId: 'item1' },
        visual: null,
      });

      // Verify legacy formatter was called with transformed template
      const formatCall = mockMultiTargetFormatter.format.mock.calls[0];
      expect(formatCall[0]).toMatchObject({
        id: 'test:multi_action',
        template: 'use {target} on Goblin',
      });
      expect(formatCall[1]).toMatchObject({
        type: 'entity',
        entityId: 'item1',
        displayName: 'Sword',
      });
    });

    it('should create error when multi-target fails and legacy fallback also fails', async () => {
      // Test also covers lines 161-181
      mockMultiTargetFormatter.formatMultiTarget.mockReturnValue({
        ok: false,
        error: 'Multi-target formatting failed',
      });

      mockMultiTargetFormatter.format.mockReturnValue({
        ok: false,
        error: 'Legacy formatting also failed',
        details: { missingPlaceholder: 'target' },
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);

      // Verify error context includes the target ID from primary target
      expect(mockErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Legacy formatting also failed',
          actionDef: expect.objectContaining({ id: 'test:multi_action' }),
          actorId: 'player',
          targetId: 'item1',
          additionalContext: expect.objectContaining({
            stage: 'action_formatting',
            formatDetails: { missingPlaceholder: 'target' },
          }),
        })
      );
    });

    it('should fallback to secondary target when multi-target fails with no primary target', async () => {
      // Test covers lines 161-181 with secondary target fallback
      const noPrimaryTargetContext = {
        ...mockContext,
        resolvedTargets: {
          secondary: [{ id: 'npc1', displayName: 'Goblin' }],
          // No primary targets - will use first available (secondary)
        },
      };

      mockMultiTargetFormatter.formatMultiTarget.mockReturnValue({
        ok: false,
        error: 'Multi-target formatting failed',
      });

      mockMultiTargetFormatter.format.mockReturnValue({
        ok: true,
        value: 'use on Goblin',
      });

      const result = await stage.executeInternal(noPrimaryTargetContext);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.errors).toHaveLength(0);

      // Verify legacy formatter was called with secondary target
      expect(mockMultiTargetFormatter.format).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          entityId: 'npc1',
          displayName: 'Goblin',
        }),
        expect.any(Object),
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should handle formatter without formatMultiTarget when no targets exist at all', async () => {
      // Test covers lines 223-232
      const noTargetsContext = {
        ...mockContext,
        resolvedTargets: {}, // Truly empty - no targets at all
      };

      // Remove formatMultiTarget to trigger the else branch
      mockMultiTargetFormatter.formatMultiTarget = undefined;

      const result = await stage.executeInternal(noTargetsContext);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);

      // Verify error context for no targets available
      expect(mockErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'No targets available for action',
          actionDef: expect.objectContaining({ id: 'test:multi_action' }),
          actorId: 'player',
          targetId: null,
          phase: ERROR_PHASES.VALIDATION,
        })
      );

      // Verify format was not called
      expect(mockMultiTargetFormatter.format).not.toHaveBeenCalled();
    });

    it('should handle empty resolved targets object', async () => {
      // Additional test for edge case
      const emptyResolvedTargetsContext = {
        ...mockContext,
        resolvedTargets: {},
      };

      mockMultiTargetFormatter.formatMultiTarget.mockReturnValue({
        ok: false,
        error: 'No targets to format',
      });

      const result = await stage.executeInternal(emptyResolvedTargetsContext);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
    });

    it('should properly transform template placeholders for legacy fallback', async () => {
      // Test the template transformation logic
      const complexTemplateContext = {
        ...mockContext,
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:complex',
              name: 'Complex Action',
              template: 'use {item} on {target} with {tool}',
            },
          },
        ],
        targetDefinitions: {
          primary: { placeholder: 'item' },
          secondary: { placeholder: 'target' },
          tertiary: { placeholder: 'tool' },
        },
      };

      mockMultiTargetFormatter.formatMultiTarget.mockReturnValue({
        ok: false,
        error: 'Complex template failed',
      });

      mockMultiTargetFormatter.format.mockReturnValue({
        ok: true,
        value: 'use Sword on',
      });

      await stage.executeInternal(complexTemplateContext);

      // Verify the template was transformed correctly
      expect(mockMultiTargetFormatter.format).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'use Goblin on Goblin with',
        }),
        expect.any(Object),
        expect.any(Object),
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('Per-Action Metadata Processing', () => {
    it('should process actions based on their individual metadata when mixed', async () => {
      // Create both legacy and multi-target actions with per-action metadata
      const context = {
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'core:follow',
              name: 'Follow',
              template: 'follow {target}',
            },
            targetContexts: [
              {
                entityId: 'npc_001',
                displayName: 'Guard Captain',
                type: 'entity',
              },
            ],
            // Per-action metadata for legacy action
            resolvedTargets: {
              primary: [
                {
                  id: 'npc_001',
                  displayName: 'Guard Captain',
                  entity: { id: 'npc_001' },
                },
              ],
            },
            targetDefinitions: {
              primary: {
                scope: 'core:potential_leaders',
                placeholder: 'target',
              },
            },
            isMultiTarget: false,
          },
          {
            actionDef: {
              id: 'movement:go',
              name: 'Go',
              template: 'go to {destination}',
              targets: {
                primary: {
                  scope: 'location.exits',
                  placeholder: 'destination',
                },
              },
            },
            targetContexts: [
              {
                entityId: 'room_tavern',
                displayName: 'The Gilded Bean',
                type: 'entity',
              },
            ],
            // Per-action metadata for multi-target action
            resolvedTargets: {
              primary: [
                {
                  id: 'room_tavern',
                  displayName: 'The Gilded Bean',
                  entity: { id: 'room_tavern' },
                },
              ],
            },
            targetDefinitions: {
              primary: {
                scope: 'location.exits',
                placeholder: 'destination',
              },
            },
            isMultiTarget: true,
          },
        ],
      };

      // Mock the formatter to support multi-target
      mockMultiTargetFormatter.formatMultiTarget.mockReturnValueOnce({
        ok: true,
        value: 'go to The Gilded Bean',
      });

      mockMultiTargetFormatter.format.mockReturnValueOnce({
        ok: true,
        value: 'follow Guard Captain',
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(2);

      // Verify legacy action was formatted correctly
      const followAction = result.actions.find((a) => a.id === 'core:follow');
      expect(followAction).toBeDefined();
      expect(followAction.command).toBe('follow Guard Captain');
      expect(followAction.params.targetId).toBe('npc_001');

      // Verify multi-target action was formatted with multi-target formatter
      const goAction = result.actions.find((a) => a.id === 'movement:go');
      expect(goAction).toBeDefined();
      expect(goAction.command).toBe('go to The Gilded Bean');
      expect(goAction.params.isMultiTarget).toBe(true);
      expect(goAction.params.targetIds).toEqual({ primary: ['room_tavern'] });

      // Verify the multi-target formatter was called for the multi-target action
      expect(mockMultiTargetFormatter.formatMultiTarget).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'movement:go' }),
        expect.objectContaining({ primary: expect.any(Array) }),
        expect.any(Object),
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should handle actions without per-action metadata gracefully', async () => {
      // Test backward compatibility - actions without the new metadata
      const context = {
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:old-style',
              name: 'Old Style',
              template: 'old {target}',
            },
            targetContexts: [
              {
                entityId: 'target_001',
                displayName: 'Target 1',
                type: 'entity',
              },
            ],
            // No per-action metadata
          },
        ],
      };

      mockMultiTargetFormatter.format.mockReturnValue({
        ok: true,
        value: 'old Target 1',
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].command).toBe('old Target 1');

      // Should use legacy formatter
      expect(mockMultiTargetFormatter.format).toHaveBeenCalled();
      expect(mockMultiTargetFormatter.formatMultiTarget).not.toHaveBeenCalled();
    });
  });

  describe('Per-Action Metadata Error Handling', () => {
    it('should handle multi-target failure with no primary target fallback in per-action metadata', async () => {
      const context = {
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:multi-target',
              name: 'Multi Target',
              template: 'use {item} on {target}',
            },
            targetContexts: [],
            resolvedTargets: {
              // Empty targets - no primary target available
            },
            targetDefinitions: {
              primary: { placeholder: 'item' },
              secondary: { placeholder: 'target' },
            },
            isMultiTarget: true,
          },
        ],
      };

      mockMultiTargetFormatter.formatMultiTarget.mockReturnValue({
        ok: false,
        error: 'Multi-target formatting failed',
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);

      // Verify error context was built correctly
      expect(mockErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Multi-target formatting failed',
          actionDef: expect.objectContaining({ id: 'test:multi-target' }),
          actorId: 'test-actor',
          targetId: null, // No primary target available
        })
      );
    });

    it('should handle exceptions during per-action metadata processing', async () => {
      const context = {
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:exception',
              name: 'Exception Action',
              template: 'exception {target}',
            },
            targetContexts: [
              {
                entityId: 'target_001',
                displayName: 'Target 1',
                type: 'entity',
              },
            ],
            resolvedTargets: { primary: [{ id: 'target_001' }] },
            targetDefinitions: { primary: { placeholder: 'target' } },
            isMultiTarget: false,
          },
        ],
      };

      // Mock formatter to throw an exception
      const thrownError = new Error('Formatter exception');
      mockMultiTargetFormatter.format.mockImplementation(() => {
        throw thrownError;
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);

      // Verify error context was built for the exception
      expect(mockErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith(
        expect.objectContaining({
          error: thrownError,
          actionDef: expect.objectContaining({ id: 'test:exception' }),
          actorId: 'test-actor',
          targetId: 'target_001',
        })
      );
    });

    it('should handle fallback formatter failure when multi-target fails in per-action metadata', async () => {
      const context = {
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:fallback-fail',
              name: 'Fallback Fail',
              template: 'use {item} on {target}',
            },
            targetContexts: [],
            resolvedTargets: {
              primary: [{ id: 'item_001', displayName: 'Sword' }],
            },
            targetDefinitions: {
              primary: { placeholder: 'item' },
              secondary: { placeholder: 'target' },
            },
            isMultiTarget: true,
          },
        ],
      };

      // Multi-target formatter fails
      mockMultiTargetFormatter.formatMultiTarget.mockReturnValue({
        ok: false,
        error: 'Multi-target failed',
      });

      // Fallback formatter also fails
      mockMultiTargetFormatter.format.mockReturnValue({
        ok: false,
        error: 'Fallback also failed',
        details: { reason: 'No valid placeholder' },
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);

      // Verify error context includes fallback error and target ID
      expect(mockErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Fallback also failed',
          actionDef: expect.objectContaining({ id: 'test:fallback-fail' }),
          actorId: 'test-actor',
          targetId: 'item_001', // Primary target ID
          additionalContext: expect.objectContaining({
            stage: 'action_formatting',
            formatDetails: { reason: 'No valid placeholder' },
          }),
        })
      );
    });

    it('should handle formatMultiTarget not available with per-action metadata', async () => {
      const context = {
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:no-multi-formatter',
              name: 'No Multi Formatter',
              template: 'use {item}',
            },
            targetContexts: [],
            resolvedTargets: {
              primary: [{ id: 'item_001', displayName: 'Sword' }],
            },
            targetDefinitions: {
              primary: { placeholder: 'item' },
            },
            isMultiTarget: true,
          },
        ],
      };

      // Remove formatMultiTarget method
      const formatterWithoutMulti = { ...mockMultiTargetFormatter };
      delete formatterWithoutMulti.formatMultiTarget;

      const stageWithoutMulti = new ActionFormattingStage({
        commandFormatter: formatterWithoutMulti,
        entityManager: mockEntityManager,
        safeEventDispatcher: mockSafeEventDispatcher,
        getEntityDisplayNameFn: mockGetEntityDisplayNameFn,
        errorContextBuilder: mockErrorContextBuilder,
        logger: mockLogger,
      });

      formatterWithoutMulti.format.mockReturnValue({
        ok: false,
        error: 'Legacy formatter failed',
      });

      const result = await stageWithoutMulti.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);

      // Verify error was created with primary target ID
      expect(mockErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith(
        expect.objectContaining({
          actionDef: expect.objectContaining({ id: 'test:no-multi-formatter' }),
          actorId: 'test-actor',
          targetId: 'item_001',
        })
      );
    });
  });
});

describe('ActionFormattingStage - Action Tracing Integration', () => {
  let stage;
  let mockCommandFormatter;
  let mockEntityManager;
  let mockSafeEventDispatcher;
  let mockGetEntityDisplayNameFn;
  let mockErrorContextBuilder;
  let mockLogger;

  beforeEach(() => {
    mockCommandFormatter = {
      format: jest.fn(),
      formatMultiTarget: jest.fn(),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn(),
    };

    mockSafeEventDispatcher = {
      dispatch: jest.fn(),
    };

    mockGetEntityDisplayNameFn = jest.fn().mockReturnValue('Display Name');

    mockErrorContextBuilder = {
      buildErrorContext: jest.fn().mockReturnValue({
        error: 'Error context',
        actionId: 'test-action',
      }),
    };

    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };

    stage = new ActionFormattingStage({
      commandFormatter: mockCommandFormatter,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockSafeEventDispatcher,
      getEntityDisplayNameFn: mockGetEntityDisplayNameFn,
      errorContextBuilder: mockErrorContextBuilder,
      logger: mockLogger,
    });
  });

  describe('Action-Aware Trace Detection', () => {
    it('should detect action-aware traces and use tracing execution path', async () => {
      const mockActionTraceFilter = {
        shouldTrace: jest.fn().mockReturnValue(true),
        getVerbosityLevel: jest.fn().mockReturnValue('verbose'),
        getInclusionConfig: jest.fn().mockReturnValue({}),
        isEnabled: jest.fn().mockReturnValue(true),
      };

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockActionTraceFilter,
        actorId: 'test-actor',
        context: { test: true },
        logger: mockLogger,
      });

      const context = {
        trace,
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test-action',
              name: 'Test Action',
              template: 'Test {target}',
            },
            targetContexts: [
              {
                type: 'entity',
                entityId: 'target-1',
                displayName: 'Target 1',
              },
            ],
          },
        ],
      };

      mockCommandFormatter.format.mockReturnValue({
        ok: true,
        value: 'Test Target 1',
      });

      const result = await stage.executeInternal(context);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].command).toBe('Test Target 1');

      // Verify trace data was captured
      const tracedActions = trace.getTracedActions();
      expect(tracedActions.has('test-action')).toBe(true);

      const actionTrace = trace.getActionTrace('test-action');
      expect(actionTrace.stages.formatting).toBeDefined();

      // Verify stage summary was captured
      const summaryTrace = trace.getActionTrace('__stage_summary');
      expect(summaryTrace).toBeDefined();
      expect(summaryTrace.stages.formatting.data.statistics).toBeDefined();
    });

    it('should use standard execution for regular traces', async () => {
      const trace = new StructuredTrace();
      const context = {
        trace,
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test-action',
              name: 'Test Action',
              template: 'Test {target}',
            },
            targetContexts: [
              {
                type: 'entity',
                entityId: 'target-1',
                displayName: 'Target 1',
              },
            ],
          },
        ],
      };

      mockCommandFormatter.format.mockReturnValue({
        ok: true,
        value: 'Test Target 1',
      });

      const result = await stage.executeInternal(context);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].command).toBe('Test Target 1');

      // Should not have action trace data since it's a regular trace
      expect(trace.captureActionData).toBeUndefined();
    });
  });

  describe('Formatting Path Tracing', () => {
    it('should capture per-action metadata path decision', async () => {
      const mockActionTraceFilter = {
        shouldTrace: jest.fn().mockReturnValue(true),
        getVerbosityLevel: jest.fn().mockReturnValue('verbose'),
        getInclusionConfig: jest.fn().mockReturnValue({}),
        isEnabled: jest.fn().mockReturnValue(true),
      };

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockActionTraceFilter,
        actorId: 'test-actor',
        context: {},
        logger: mockLogger,
      });

      // Test per-action metadata path
      const context = {
        trace,
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: { id: 'action-1', name: 'Action 1' },
            targetContexts: [{ entityId: 'target-1' }],
            resolvedTargets: { primary: [{ id: 'target-1' }] },
            targetDefinitions: { primary: { placeholder: 'target' } },
            isMultiTarget: true,
          },
        ],
      };

      mockCommandFormatter.formatMultiTarget.mockReturnValue({
        ok: true,
        value: 'Multi-target formatted',
      });

      await stage.executeInternal(context);

      const actionTrace = trace.getActionTrace('action-1');
      expect(actionTrace.stages.formatting).toBeDefined();

      // Verify formatting path was captured
      const summaryTrace = trace.getActionTrace('__stage_summary');
      expect(summaryTrace.stages.formatting.data.formattingPath).toBe(
        'per-action'
      );
    });

    it('should capture multi-target path decision', async () => {
      const mockActionTraceFilter = {
        shouldTrace: jest.fn().mockReturnValue(true),
        getVerbosityLevel: jest.fn().mockReturnValue('verbose'),
        getInclusionConfig: jest.fn().mockReturnValue({}),
        isEnabled: jest.fn().mockReturnValue(true),
      };

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockActionTraceFilter,
        actorId: 'test-actor',
        context: {},
        logger: mockLogger,
      });

      const context = {
        trace,
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: { id: 'action-1', name: 'Action 1' },
            targetContexts: [],
          },
        ],
        resolvedTargets: { primary: [{ id: 'target-1' }] },
        targetDefinitions: { primary: { placeholder: 'target' } },
      };

      mockCommandFormatter.formatMultiTarget.mockReturnValue({
        ok: true,
        value: 'Multi-target formatted',
      });

      await stage.executeInternal(context);

      const summaryTrace = trace.getActionTrace('__stage_summary');
      expect(summaryTrace.stages.formatting.data.formattingPath).toBe(
        'multi-target'
      );
    });

    it('should capture legacy path decision', async () => {
      const mockActionTraceFilter = {
        shouldTrace: jest.fn().mockReturnValue(true),
        getVerbosityLevel: jest.fn().mockReturnValue('verbose'),
        getInclusionConfig: jest.fn().mockReturnValue({}),
        isEnabled: jest.fn().mockReturnValue(true),
      };

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockActionTraceFilter,
        actorId: 'test-actor',
        context: {},
        logger: mockLogger,
      });

      const context = {
        trace,
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: { id: 'action-1', name: 'Action 1' },
            targetContexts: [{ entityId: 'target-1' }],
          },
        ],
      };

      mockCommandFormatter.format.mockReturnValue({
        ok: true,
        value: 'Legacy formatted',
      });

      await stage.executeInternal(context);

      const summaryTrace = trace.getActionTrace('__stage_summary');
      expect(summaryTrace.stages.formatting.data.formattingPath).toBe('legacy');
    });
  });

  describe('Fallback Usage Tracing', () => {
    it('should capture multi-target traced execution fallback with template transformation', async () => {
      const mockActionTraceFilter = {
        shouldTrace: jest.fn().mockReturnValue(true),
        getVerbosityLevel: jest.fn().mockReturnValue('verbose'),
        getInclusionConfig: jest.fn().mockReturnValue({}),
        isEnabled: jest.fn().mockReturnValue(true),
      };

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockActionTraceFilter,
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
              id: 'action-1',
              name: 'Action 1',
              template: 'use {item} on {target}',
            },
            targetContexts: [],
          },
        ],
        resolvedTargets: {
          primary: [{ id: 'item_001', displayName: 'Sword' }],
          secondary: [{ id: 'target_001', displayName: 'Enemy' }],
        },
        targetDefinitions: {
          primary: { placeholder: 'item' },
          secondary: { placeholder: 'target' },
        },
      };

      // Multi-target formatter fails initially
      mockCommandFormatter.formatMultiTarget.mockReturnValue({
        ok: false,
        error: 'Multi-target formatting failed',
      });

      // Fallback formatter succeeds with transformed template
      mockCommandFormatter.format.mockReturnValue({
        ok: true,
        value: 'use Sword on',
      });

      await stage.executeInternal(context);

      const actionTrace = trace.getActionTrace('action-1');
      expect(actionTrace).toBeDefined();

      // Verify fallback was used
      const formattingStages = Object.values(actionTrace.stages);
      const completionCapture = formattingStages.find(
        (s) => s.data?.fallbackUsed !== undefined
      );
      expect(completionCapture).toBeDefined();
      expect(completionCapture.data.fallbackUsed).toBe(true);

      // Verify template transformation was applied
      expect(mockCommandFormatter.format).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'use Enemy on Enemy',
        }),
        expect.any(Object),
        expect.any(Object),
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should handle direct fallback to legacy when formatMultiTarget not available in traced execution', async () => {
      const mockActionTraceFilter = {
        shouldTrace: jest.fn().mockReturnValue(true),
        getVerbosityLevel: jest.fn().mockReturnValue('verbose'),
        getInclusionConfig: jest.fn().mockReturnValue({}),
        isEnabled: jest.fn().mockReturnValue(true),
      };

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockActionTraceFilter,
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
              id: 'action-2',
              name: 'Action 2',
              template: 'cast {spell}',
            },
            targetContexts: [],
          },
        ],
        resolvedTargets: {
          primary: [{ id: 'spell_001', displayName: 'Fireball' }],
        },
        targetDefinitions: {
          primary: { placeholder: 'spell' },
        },
      };

      // Remove formatMultiTarget to trigger direct fallback
      const formatterWithoutMulti = { ...mockCommandFormatter };
      delete formatterWithoutMulti.formatMultiTarget;

      const stageWithoutMulti = new ActionFormattingStage({
        commandFormatter: formatterWithoutMulti,
        entityManager: mockEntityManager,
        safeEventDispatcher: mockSafeEventDispatcher,
        getEntityDisplayNameFn: mockGetEntityDisplayNameFn,
        errorContextBuilder: mockErrorContextBuilder,
        logger: mockLogger,
      });

      formatterWithoutMulti.format.mockReturnValue({
        ok: true,
        value: 'cast Fireball',
      });

      await stageWithoutMulti.executeInternal(context);

      const actionTrace = trace.getActionTrace('action-2');
      expect(actionTrace).toBeDefined();

      // Verify fallback was used immediately since formatMultiTarget not available
      const formattingStages = Object.values(actionTrace.stages);
      const completionCapture = formattingStages.find(
        (s) => s.data?.fallbackUsed !== undefined
      );
      expect(completionCapture).toBeDefined();
      expect(completionCapture.data.fallbackUsed).toBe(true);

      // Verify legacy formatter was called directly
      expect(formatterWithoutMulti.format).toHaveBeenCalled();
    });

    it('should capture fallback usage when multi-target formatting fails', async () => {
      const mockActionTraceFilter = {
        shouldTrace: jest.fn().mockReturnValue(true),
        getVerbosityLevel: jest.fn().mockReturnValue('verbose'),
        getInclusionConfig: jest.fn().mockReturnValue({}),
        isEnabled: jest.fn().mockReturnValue(true),
      };

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockActionTraceFilter,
        actorId: 'test-actor',
        context: {},
        logger: mockLogger,
      });

      const context = {
        trace,
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: { id: 'action-1', name: 'Action 1' },
            targetContexts: [{ entityId: 'target-1' }],
            resolvedTargets: {
              primary: [{ id: 'target-1', displayName: 'Target 1' }],
            },
            targetDefinitions: { primary: { placeholder: 'target' } },
            isMultiTarget: true,
          },
        ],
      };

      // Multi-target fails, fallback succeeds
      mockCommandFormatter.formatMultiTarget.mockReturnValue({
        ok: false,
        error: 'Multi-target formatting failed',
      });

      mockCommandFormatter.format.mockReturnValue({
        ok: true,
        value: 'Fallback formatted',
      });

      await stage.executeInternal(context);

      const actionTrace = trace.getActionTrace('action-1');
      expect(actionTrace).toBeDefined();
      expect(actionTrace.stages.formatting).toBeDefined();

      // Find the completion capture which should have fallbackUsed flag
      const formattingStages = Object.values(actionTrace.stages);
      const completionCapture = formattingStages.find(
        (s) => s.data?.fallbackUsed !== undefined
      );
      expect(completionCapture).toBeDefined();
      expect(completionCapture.data.fallbackUsed).toBe(true);
    });
  });

  describe('Multi-Target Error Conditions in Traced Execution', () => {
    it('should handle formatter returning null in traced multi-target execution', async () => {
      const mockActionTraceFilter = {
        shouldTrace: jest.fn().mockReturnValue(true),
        getVerbosityLevel: jest.fn().mockReturnValue('verbose'),
        getInclusionConfig: jest.fn().mockReturnValue({}),
        isEnabled: jest.fn().mockReturnValue(true),
      };

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockActionTraceFilter,
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
              id: 'action-null',
              name: 'Null Action',
              template: 'null {target}',
            },
            targetContexts: [],
          },
        ],
        resolvedTargets: {
          primary: [{ id: 'target_001', displayName: 'Target' }],
        },
        targetDefinitions: {
          primary: { placeholder: 'target' },
        },
      };

      // Formatter returns null
      mockCommandFormatter.formatMultiTarget.mockReturnValue(null);

      const result = await stage.executeInternal(context);

      expect(result.actions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);

      // Verify error was captured in trace
      const actionTrace = trace.getActionTrace('action-null');
      expect(actionTrace).toBeDefined();

      const formattingStages = Object.values(actionTrace.stages);
      const errorCapture = formattingStages.find(
        (s) => s.data?.status === 'failed'
      );
      expect(errorCapture).toBeDefined();
    });

    it('should handle formatter returning undefined in traced multi-target execution', async () => {
      const mockActionTraceFilter = {
        shouldTrace: jest.fn().mockReturnValue(true),
        getVerbosityLevel: jest.fn().mockReturnValue('verbose'),
        getInclusionConfig: jest.fn().mockReturnValue({}),
        isEnabled: jest.fn().mockReturnValue(true),
      };

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockActionTraceFilter,
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
              id: 'action-undefined',
              name: 'Undefined Action',
              template: 'undefined {target}',
            },
            targetContexts: [],
          },
        ],
        resolvedTargets: {
          primary: [{ id: 'target_002', displayName: 'Target2' }],
        },
        targetDefinitions: {
          primary: { placeholder: 'target' },
        },
      };

      // Formatter returns undefined
      mockCommandFormatter.formatMultiTarget.mockReturnValue(undefined);

      const result = await stage.executeInternal(context);

      expect(result.actions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);

      // Verify error context was built (note: undefined results in processing error)
      expect(mockErrorContextBuilder.buildErrorContext).toHaveBeenCalled();
    });

    it('should handle exception during multi-target traced execution', async () => {
      const mockActionTraceFilter = {
        shouldTrace: jest.fn().mockReturnValue(true),
        getVerbosityLevel: jest.fn().mockReturnValue('verbose'),
        getInclusionConfig: jest.fn().mockReturnValue({}),
        isEnabled: jest.fn().mockReturnValue(true),
      };

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockActionTraceFilter,
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
              id: 'action-exception',
              name: 'Exception Action',
              template: 'exception {target}',
            },
            targetContexts: [],
          },
        ],
        resolvedTargets: {
          primary: [{ id: 'target_003', displayName: 'Target3' }],
        },
        targetDefinitions: {
          primary: { placeholder: 'target' },
        },
      };

      const thrownError = new Error('Multi-target formatter exploded');
      mockCommandFormatter.formatMultiTarget.mockImplementation(() => {
        throw thrownError;
      });

      const result = await stage.executeInternal(context);

      expect(result.actions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);

      // Verify exception was captured in trace
      const actionTrace = trace.getActionTrace('action-exception');
      expect(actionTrace).toBeDefined();

      const formattingStages = Object.values(actionTrace.stages);
      const errorCapture = formattingStages.find((s) => s.data?.error);
      expect(errorCapture).toBeDefined();
      expect(errorCapture.data.error).toBe('Multi-target formatter exploded');

      // Verify performance data was still captured
      expect(errorCapture.data.performance?.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Tracing', () => {
    it('should capture error details when formatting fails', async () => {
      const mockActionTraceFilter = {
        shouldTrace: jest.fn().mockReturnValue(true),
        getVerbosityLevel: jest.fn().mockReturnValue('verbose'),
        getInclusionConfig: jest.fn().mockReturnValue({}),
        isEnabled: jest.fn().mockReturnValue(true),
      };

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockActionTraceFilter,
        actorId: 'test-actor',
        context: {},
        logger: mockLogger,
      });

      const context = {
        trace,
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: { id: 'action-1', name: 'Action 1' },
            targetContexts: [{ entityId: 'target-1' }],
          },
        ],
      };

      mockCommandFormatter.format.mockReturnValue({
        ok: false,
        error: 'Formatting failed',
      });

      await stage.executeInternal(context);

      const actionTrace = trace.getActionTrace('action-1');
      expect(actionTrace).toBeDefined();
      expect(actionTrace.stages.formatting).toBeDefined();

      // Verify error was captured in summary
      const summaryTrace = trace.getActionTrace('__stage_summary');
      expect(summaryTrace.stages.formatting.data.errors).toBeGreaterThan(0);
    });

    it('should capture exception details when formatting throws', async () => {
      const mockActionTraceFilter = {
        shouldTrace: jest.fn().mockReturnValue(true),
        getVerbosityLevel: jest.fn().mockReturnValue('verbose'),
        getInclusionConfig: jest.fn().mockReturnValue({}),
        isEnabled: jest.fn().mockReturnValue(true),
      };

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockActionTraceFilter,
        actorId: 'test-actor',
        context: {},
        logger: mockLogger,
      });

      const context = {
        trace,
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: { id: 'action-1', name: 'Action 1' },
            targetContexts: [{ entityId: 'target-1' }],
            resolvedTargets: { primary: [{ id: 'target-1' }] },
            targetDefinitions: { primary: { placeholder: 'target' } },
            isMultiTarget: true,
          },
        ],
      };

      mockCommandFormatter.formatMultiTarget.mockImplementation(() => {
        throw new Error('Formatter exploded');
      });

      await stage.executeInternal(context);

      const actionTrace = trace.getActionTrace('action-1');
      expect(actionTrace).toBeDefined();

      // Find the error capture
      const formattingStages = Object.values(actionTrace.stages);
      const errorCapture = formattingStages.find((s) => s.data?.error);
      expect(errorCapture).toBeDefined();
      expect(errorCapture.data.error).toBe('Formatter exploded');
    });
  });

  describe('Performance Metrics', () => {
    it('should capture performance metrics for each action', async () => {
      const mockActionTraceFilter = {
        shouldTrace: jest.fn().mockReturnValue(true),
        getVerbosityLevel: jest.fn().mockReturnValue('verbose'),
        getInclusionConfig: jest.fn().mockReturnValue({}),
        isEnabled: jest.fn().mockReturnValue(true),
      };

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockActionTraceFilter,
        actorId: 'test-actor',
        context: {},
        logger: mockLogger,
      });

      const context = {
        trace,
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: { id: 'action-1' },
            targetContexts: [{ entityId: 't1' }],
          },
          {
            actionDef: { id: 'action-2' },
            targetContexts: [{ entityId: 't2' }],
          },
          {
            actionDef: { id: 'action-3' },
            targetContexts: [{ entityId: 't3' }],
          },
        ],
      };

      mockCommandFormatter.format.mockReturnValue({
        ok: true,
        value: 'Formatted',
      });

      await stage.executeInternal(context);

      // Check that each action has performance data
      for (let i = 1; i <= 3; i++) {
        const actionTrace = trace.getActionTrace(`action-${i}`);
        expect(actionTrace).toBeDefined();

        // Find the completion capture with performance data
        const formattingStages = Object.values(actionTrace.stages);
        const performanceCapture = formattingStages.find(
          (s) => s.data?.performance
        );
        expect(performanceCapture).toBeDefined();
        expect(performanceCapture.data.performance.duration).toBeDefined();
        expect(
          performanceCapture.data.performance.duration
        ).toBeGreaterThanOrEqual(0);
      }

      // Check stage summary has aggregate performance metrics
      const summaryTrace = trace.getActionTrace('__stage_summary');
      expect(
        summaryTrace.stages.formatting.data.performance.totalDuration
      ).toBeDefined();
      expect(
        summaryTrace.stages.formatting.data.performance.averagePerAction
      ).toBeDefined();
    });
  });

  describe('Statistics Tracking', () => {
    it('should track statistics across all formatting paths', async () => {
      const mockActionTraceFilter = {
        shouldTrace: jest.fn().mockReturnValue(true),
        getVerbosityLevel: jest.fn().mockReturnValue('verbose'),
        getInclusionConfig: jest.fn().mockReturnValue({}),
        isEnabled: jest.fn().mockReturnValue(true),
      };

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockActionTraceFilter,
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
            actionDef: { id: 'action-1' },
            targetContexts: [],
            resolvedTargets: { primary: [{ id: 't1' }] },
            targetDefinitions: { primary: { placeholder: 'target' } },
            isMultiTarget: true,
          },
          // Per-action metadata with legacy
          {
            actionDef: { id: 'action-2' },
            targetContexts: [{ entityId: 't2' }],
            resolvedTargets: null,
            targetDefinitions: null,
            isMultiTarget: false,
          },
          // Regular legacy
          {
            actionDef: { id: 'action-3' },
            targetContexts: [{ entityId: 't3' }],
          },
        ],
      };

      mockCommandFormatter.formatMultiTarget.mockReturnValue({
        ok: true,
        value: 'Multi formatted',
      });

      mockCommandFormatter.format.mockReturnValue({
        ok: true,
        value: 'Legacy formatted',
      });

      await stage.executeInternal(context);

      const summaryTrace = trace.getActionTrace('__stage_summary');
      const stats = summaryTrace.stages.formatting.data.statistics;

      expect(stats.total).toBe(3);
      expect(stats.successful).toBeGreaterThan(0);
      expect(stats.failed).toBe(0);
      expect(stats.multiTarget).toBeGreaterThan(0);
      expect(stats.legacy).toBeGreaterThan(0);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain existing behavior for non-traced execution', async () => {
      const trace = new StructuredTrace();
      const context = {
        trace,
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test-action',
              name: 'Test Action',
              template: 'Test {target}',
            },
            targetContexts: [
              {
                type: 'entity',
                entityId: 'target-1',
                displayName: 'Target 1',
              },
            ],
          },
        ],
      };

      mockCommandFormatter.format.mockReturnValue({
        ok: true,
        value: 'Test Target 1',
      });

      const result = await stage.executeInternal(context);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0]).toEqual({
        id: 'test-action',
        name: 'Test Action',
        command: 'Test Target 1',
        description: '',
        params: { targetId: 'target-1' },
        visual: null,
      });
    });

    it('should handle empty action arrays gracefully with tracing', async () => {
      const mockActionTraceFilter = {
        shouldTrace: jest.fn().mockReturnValue(true),
        getVerbosityLevel: jest.fn().mockReturnValue('verbose'),
        getInclusionConfig: jest.fn().mockReturnValue({}),
        isEnabled: jest.fn().mockReturnValue(true),
      };

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockActionTraceFilter,
        actorId: 'test-actor',
        context: {},
        logger: mockLogger,
      });

      const context = {
        trace,
        actor: { id: 'test-actor' },
        actionsWithTargets: [],
      };

      const result = await stage.executeInternal(context);

      expect(result.actions).toEqual([]);

      // Check that summary was still captured
      const summaryTrace = trace.getActionTrace('__stage_summary');
      expect(summaryTrace).toBeDefined();
      expect(summaryTrace.stages.formatting.data.statistics.total).toBe(0);
    });
  });

  describe('Performance Impact', () => {
    it('should have minimal performance impact when tracing is enabled', async () => {
      const mockActionTraceFilter = {
        shouldTrace: jest.fn().mockReturnValue(true),
        getVerbosityLevel: jest.fn().mockReturnValue('verbose'),
        getInclusionConfig: jest.fn().mockReturnValue({}),
        isEnabled: jest.fn().mockReturnValue(true),
      };

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockActionTraceFilter,
        actorId: 'test-actor',
        context: {},
        logger: mockLogger,
      });

      const context = {
        trace,
        actor: { id: 'test-actor' },
        actionsWithTargets: Array(100)
          .fill()
          .map((_, i) => ({
            actionDef: {
              id: `action-${i}`,
              name: `Action ${i}`,
              template: 'Test {target}',
            },
            targetContexts: [
              {
                type: 'entity',
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

      const startTime = performance.now();
      await stage.executeInternal(context);
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Should complete within reasonable time even with tracing
      expect(executionTime).toBeLessThan(1000); // 1 second for 100 actions
      expect(mockCommandFormatter.format).toHaveBeenCalledTimes(100);

      // Verify all actions were traced
      const summaryTrace = trace.getActionTrace('__stage_summary');
      expect(summaryTrace.stages.formatting.data.statistics.total).toBe(100);
    });
  });

  describe('Legacy Traced Multi-Target Processing', () => {
    it('should process multi-target actions through legacy traced path with formatMultiTarget available', async () => {
      const mockActionTraceFilter = {
        shouldTrace: jest.fn().mockReturnValue(true),
        getVerbosityLevel: jest.fn().mockReturnValue('verbose'),
        getInclusionConfig: jest.fn().mockReturnValue({}),
        isEnabled: jest.fn().mockReturnValue(true),
      };

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockActionTraceFilter,
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
              id: 'legacy-multi:action',
              name: 'Legacy Multi Action',
              template: 'use {item} on {enemy}',
              targets: {
                primary: { placeholder: 'item' },
                secondary: { placeholder: 'enemy' },
              },
            },
            targetContexts: [
              {
                entityId: 'item_001',
                displayName: 'Sword',
                placeholder: 'item',
              },
              {
                entityId: 'enemy_001',
                displayName: 'Goblin',
                placeholder: 'enemy',
              },
            ],
          },
        ],
      };

      // Mock entity manager to return entities
      mockEntityManager.getEntityInstance.mockImplementation((id) => ({ id }));

      mockCommandFormatter.formatMultiTarget.mockReturnValue({
        ok: true,
        value: ['use Sword on Goblin'],
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0]).toEqual({
        id: 'legacy-multi:action',
        name: 'Legacy Multi Action',
        command: 'use Sword on Goblin',
        description: '',
        params: {
          targetIds: { item: ['item_001'], enemy: ['enemy_001'] },
          isMultiTarget: true,
        },
        visual: null,
      });

      // Verify trace captured the legacy multi-target processing
      const actionTrace = trace.getActionTrace('legacy-multi:action');
      expect(actionTrace).toBeDefined();

      const formattingStages = Object.values(actionTrace.stages);
      const startCapture = formattingStages.find(
        (s) => s.data?.isMultiTargetInLegacy === true
      );
      expect(startCapture).toBeDefined();
    });

    it('should handle multi-target action fallback to legacy formatting in legacy traced path', async () => {
      const mockActionTraceFilter = {
        shouldTrace: jest.fn().mockReturnValue(true),
        getVerbosityLevel: jest.fn().mockReturnValue('verbose'),
        getInclusionConfig: jest.fn().mockReturnValue({}),
        isEnabled: jest.fn().mockReturnValue(true),
      };

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockActionTraceFilter,
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
              id: 'legacy-fallback:action',
              name: 'Legacy Fallback Action',
              template: 'cast {spell} at {target}',
              targets: {
                primary: { placeholder: 'spell' },
                secondary: { placeholder: 'target' },
              },
            },
            targetContexts: [
              {
                entityId: 'spell_001',
                displayName: 'Fireball',
                placeholder: 'spell',
              },
              {
                entityId: 'enemy_002',
                displayName: 'Orc',
                placeholder: 'target',
              },
            ],
          },
        ],
      };

      // Multi-target formatting fails, fallback to legacy
      mockCommandFormatter.formatMultiTarget.mockReturnValue({
        ok: false,
        error: 'Multi-target failed in legacy path',
      });

      mockCommandFormatter.format.mockReturnValue({
        ok: true,
        value: 'cast Fireball',
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0]).toEqual({
        id: 'legacy-fallback:action',
        name: 'Legacy Fallback Action',
        command: 'cast Fireball',
        description: '',
        params: { targetId: 'spell_001' },
        visual: null,
      });

      // Verify both formatMultiTarget and fallback format were called
      expect(mockCommandFormatter.formatMultiTarget).toHaveBeenCalled();
      expect(mockCommandFormatter.format).toHaveBeenCalled();

      // Verify trace captured the fallback in legacy path
      const summaryTrace = trace.getActionTrace('__stage_summary');
      expect(
        summaryTrace.stages.formatting.data.statistics.successful
      ).toBeGreaterThan(0);
      expect(
        summaryTrace.stages.formatting.data.statistics.legacy
      ).toBeGreaterThan(0);
    });

    it('should handle multi-target action without formatMultiTarget in legacy traced path', async () => {
      const mockActionTraceFilter = {
        shouldTrace: jest.fn().mockReturnValue(true),
        getVerbosityLevel: jest.fn().mockReturnValue('verbose'),
        getInclusionConfig: jest.fn().mockReturnValue({}),
        isEnabled: jest.fn().mockReturnValue(true),
      };

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockActionTraceFilter,
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
              id: 'legacy-no-multi:action',
              name: 'Legacy No Multi Action',
              template: 'swing {weapon} at {target}',
              targets: {
                primary: { placeholder: 'weapon' },
                secondary: { placeholder: 'target' },
              },
            },
            targetContexts: [
              {
                entityId: 'weapon_001',
                displayName: 'Axe',
                placeholder: 'weapon',
              },
              {
                entityId: 'enemy_003',
                displayName: 'Troll',
                placeholder: 'target',
              },
            ],
          },
        ],
      };

      // Remove formatMultiTarget method
      const formatterWithoutMulti = { ...mockCommandFormatter };
      delete formatterWithoutMulti.formatMultiTarget;

      const stageWithoutMulti = new ActionFormattingStage({
        commandFormatter: formatterWithoutMulti,
        entityManager: mockEntityManager,
        safeEventDispatcher: mockSafeEventDispatcher,
        getEntityDisplayNameFn: mockGetEntityDisplayNameFn,
        errorContextBuilder: mockErrorContextBuilder,
        logger: mockLogger,
      });

      formatterWithoutMulti.format.mockReturnValue({
        ok: true,
        value: 'swing Axe',
      });

      const result = await stageWithoutMulti.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0]).toEqual({
        id: 'legacy-no-multi:action',
        name: 'Legacy No Multi Action',
        command: 'swing Axe',
        description: '',
        params: { targetId: 'weapon_001' },
        visual: null,
      });

      // Verify only legacy formatter was called
      expect(formatterWithoutMulti.format).toHaveBeenCalled();

      // Verify trace captured statistics
      const summaryTrace = trace.getActionTrace('__stage_summary');
      expect(
        summaryTrace.stages.formatting.data.statistics.legacy
      ).toBeGreaterThan(0);
    });

    it('should skip multi-target action with no resolved targets in legacy traced path', async () => {
      const mockActionTraceFilter = {
        shouldTrace: jest.fn().mockReturnValue(true),
        getVerbosityLevel: jest.fn().mockReturnValue('verbose'),
        getInclusionConfig: jest.fn().mockReturnValue({}),
        isEnabled: jest.fn().mockReturnValue(true),
      };

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockActionTraceFilter,
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
              id: 'legacy-no-targets:action',
              name: 'Legacy No Targets Action',
              template: 'missing {item} and {target}',
              targets: {
                primary: { placeholder: 'item' },
                secondary: { placeholder: 'target' },
              },
            },
            targetContexts: [], // Empty target contexts - no resolved targets
          },
        ],
      };

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(0);

      // Verify warning was logged about skipping the action
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Skipping multi-target action 'legacy-no-targets:action'"
        )
      );

      // Verify trace captured that the action was skipped
      const actionTrace = trace.getActionTrace('legacy-no-targets:action');
      expect(actionTrace).toBeDefined();

      const formattingStages = Object.values(actionTrace.stages);
      const startCapture = formattingStages.find(
        (s) => s.data?.isMultiTargetInLegacy === true
      );
      expect(startCapture).toBeDefined();
    });

    it('should process regular legacy actions alongside multi-target in legacy traced path', async () => {
      const mockActionTraceFilter = {
        shouldTrace: jest.fn().mockReturnValue(true),
        getVerbosityLevel: jest.fn().mockReturnValue('verbose'),
        getInclusionConfig: jest.fn().mockReturnValue({}),
        isEnabled: jest.fn().mockReturnValue(true),
      };

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockActionTraceFilter,
        actorId: 'test-actor',
        context: {},
        logger: mockLogger,
      });

      const context = {
        trace,
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          // Regular legacy action
          {
            actionDef: {
              id: 'regular-legacy:action',
              name: 'Regular Legacy Action',
              template: 'look at {target}',
            },
            targetContexts: [
              { entityId: 'object_001', displayName: 'Chest' },
              { entityId: 'object_002', displayName: 'Door' },
            ],
          },
          // Multi-target action in legacy path
          {
            actionDef: {
              id: 'multi-in-legacy:action',
              name: 'Multi in Legacy Action',
              template: 'combine {item1} and {item2}',
              targets: {
                primary: { placeholder: 'item1' },
                secondary: { placeholder: 'item2' },
              },
            },
            targetContexts: [
              {
                entityId: 'item_001',
                displayName: 'Gem',
                placeholder: 'item1',
              },
              {
                entityId: 'item_002',
                displayName: 'Ring',
                placeholder: 'item2',
              },
            ],
          },
        ],
      };

      mockCommandFormatter.format.mockReturnValue({
        ok: true,
        value: 'look at Chest',
      });

      mockCommandFormatter.formatMultiTarget.mockReturnValue({
        ok: true,
        value: 'combine Gem and Ring',
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(3); // 2 regular + 1 multi

      // Verify both types were processed
      const regularActions = result.actions.filter(
        (a) => a.id === 'regular-legacy:action'
      );
      expect(regularActions).toHaveLength(2);

      const multiAction = result.actions.find(
        (a) => a.id === 'multi-in-legacy:action'
      );
      expect(multiAction).toBeDefined();
      expect(multiAction.params.isMultiTarget).toBe(true);

      // Verify trace captured mixed processing
      const summaryTrace = trace.getActionTrace('__stage_summary');
      expect(
        summaryTrace.stages.formatting.data.statistics.legacy
      ).toBeGreaterThan(0);
      expect(
        summaryTrace.stages.formatting.data.statistics.multiTarget
      ).toBeGreaterThan(0);
    });
  });

  describe('Error Logging in Legacy Actions', () => {
    it('should log detailed warning for formatting failures with target ID extraction', async () => {
      const mockActionTraceFilter = {
        shouldTrace: jest.fn().mockReturnValue(true),
        getVerbosityLevel: jest.fn().mockReturnValue('verbose'),
        getInclusionConfig: jest.fn().mockReturnValue({}),
        isEnabled: jest.fn().mockReturnValue(true),
      };

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockActionTraceFilter,
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
              id: 'error-logging:action',
              name: 'Error Logging Action',
              template: 'error action with {target}',
            },
            targetContexts: [
              { entityId: 'target_with_error', displayName: 'Error Target' },
            ],
          },
        ],
      };

      // Formatter fails with error result
      mockCommandFormatter.format.mockReturnValue({
        ok: false,
        error: 'Formatting failed',
        details: { missingData: 'target placeholder' },
      });

      await stage.executeInternal(context);

      // Verify detailed warning was logged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Failed to format command for action 'error-logging:action' with target 'target_with_error'",
        expect.objectContaining({
          formatResult: expect.objectContaining({
            ok: false,
            error: 'Formatting failed',
            details: { missingData: 'target placeholder' },
          }),
          actionDef: expect.objectContaining({ id: 'error-logging:action' }),
          targetContext: expect.objectContaining({
            entityId: 'target_with_error',
          }),
        })
      );
    });

    it('should log warning for exceptions with target ID extraction from error object', async () => {
      const mockActionTraceFilter = {
        shouldTrace: jest.fn().mockReturnValue(true),
        getVerbosityLevel: jest.fn().mockReturnValue('verbose'),
        getInclusionConfig: jest.fn().mockReturnValue({}),
        isEnabled: jest.fn().mockReturnValue(true),
      };

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockActionTraceFilter,
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
              id: 'exception-logging:action',
              name: 'Exception Logging Action',
              template: 'exception action with {target}',
            },
            targetContexts: [
              { entityId: 'target_exception', displayName: 'Exception Target' },
            ],
          },
        ],
      };

      // Formatter throws exception with target information
      const thrownError = new Error('Formatter threw error');
      thrownError.target = { entityId: 'extracted_target_id' };
      thrownError.entityId = 'fallback_target_id';

      mockCommandFormatter.format.mockImplementation(() => {
        throw thrownError;
      });

      await stage.executeInternal(context);

      // Verify warning was logged with target ID extracted from error
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Failed to format command for action 'exception-logging:action' with target 'extracted_target_id'",
        expect.objectContaining({
          error: thrownError,
          actionDef: expect.objectContaining({
            id: 'exception-logging:action',
          }),
          targetContext: expect.objectContaining({
            entityId: 'target_exception',
          }),
        })
      );

      // Verify error context was built with extracted target ID
      expect(mockErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith(
        expect.objectContaining({
          error: thrownError,
          actionDef: expect.objectContaining({
            id: 'exception-logging:action',
          }),
          actorId: 'test-actor',
          targetId: 'extracted_target_id', // Error context extracting target ID
          additionalContext: expect.objectContaining({
            stage: 'action_formatting',
          }),
        })
      );
    });

    it('should handle target ID extraction fallback chain in error logging', async () => {
      const mockActionTraceFilter = {
        shouldTrace: jest.fn().mockReturnValue(true),
        getVerbosityLevel: jest.fn().mockReturnValue('verbose'),
        getInclusionConfig: jest.fn().mockReturnValue({}),
        isEnabled: jest.fn().mockReturnValue(true),
      };

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockActionTraceFilter,
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
              id: 'fallback-target:action',
              name: 'Fallback Target Action',
              template: 'fallback action with {target}',
            },
            targetContexts: [
              { entityId: 'context_target', displayName: 'Context Target' },
            ],
          },
        ],
      };

      // Formatter throws exception with only entityId property
      const thrownError = new Error('Formatter threw error');
      thrownError.entityId = 'error_entity_id';
      // No target.entityId property to test fallback

      mockCommandFormatter.format.mockImplementation(() => {
        throw thrownError;
      });

      await stage.executeInternal(context);

      // Verify warning was logged with fallback target ID
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Failed to format command for action 'fallback-target:action' with target 'error_entity_id'",
        expect.objectContaining({
          error: thrownError,
          actionDef: expect.objectContaining({ id: 'fallback-target:action' }),
          targetContext: expect.objectContaining({
            entityId: 'context_target',
          }),
        })
      );
    });

    it('should use context target ID when error has no target information', async () => {
      const mockActionTraceFilter = {
        shouldTrace: jest.fn().mockReturnValue(true),
        getVerbosityLevel: jest.fn().mockReturnValue('verbose'),
        getInclusionConfig: jest.fn().mockReturnValue({}),
        isEnabled: jest.fn().mockReturnValue(true),
      };

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockActionTraceFilter,
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
              id: 'context-fallback:action',
              name: 'Context Fallback Action',
              template: 'context fallback with {target}',
            },
            targetContexts: [
              {
                entityId: 'final_context_target',
                displayName: 'Final Context Target',
              },
            ],
          },
        ],
      };

      // Formatter throws exception with no target information
      const thrownError = new Error('Generic formatter error');
      // No target properties to test final fallback

      mockCommandFormatter.format.mockImplementation(() => {
        throw thrownError;
      });

      await stage.executeInternal(context);

      // Verify warning was logged with context target ID as final fallback
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Failed to format command for action 'context-fallback:action' with target 'final_context_target'",
        expect.objectContaining({
          error: thrownError,
          actionDef: expect.objectContaining({ id: 'context-fallback:action' }),
          targetContext: expect.objectContaining({
            entityId: 'final_context_target',
          }),
        })
      );
    });
  });

  describe('Template Transformation Helpers', () => {
    it('should handle template transformation with empty target definitions', async () => {
      const context = {
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'empty-defs:action',
              name: 'Empty Definitions Action',
              template: 'action with {placeholder}',
            },
            targetContexts: [],
          },
        ],
        resolvedTargets: {
          primary: [{ id: 'target_001', displayName: 'Target' }],
        },
        targetDefinitions: {}, // Empty target definitions
      };

      mockCommandFormatter.formatMultiTarget.mockReturnValue({
        ok: false,
        error: 'Multi-target failed',
      });

      mockCommandFormatter.format.mockReturnValue({
        ok: true,
        value: 'action with {placeholder}', // Template should remain unchanged
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);

      // Verify template transformation was called with empty target definitions
      expect(mockCommandFormatter.format).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'action with',
        }),
        expect.any(Object),
        expect.any(Object),
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should handle template transformation with null target definitions', async () => {
      const context = {
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'null-defs:action',
              name: 'Null Definitions Action',
              template: 'null action with {item}',
            },
            targetContexts: [{ entityId: 'item_001' }],
          },
        ],
        resolvedTargets: {
          primary: [{ id: 'item_001', displayName: 'Item' }],
        },
        targetDefinitions: null, // Null target definitions - will use legacy path
      };

      // When targetDefinitions is null, it takes the legacy path
      // No multi-target call should be made
      mockCommandFormatter.format.mockReturnValue({
        ok: true,
        value: 'null action with Item',
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);

      // With null target definitions, uses legacy path - template unchanged
      expect(mockCommandFormatter.format).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'null action with {item}', // Should remain unchanged
        }),
        expect.any(Object),
        expect.any(Object),
        expect.any(Object),
        expect.any(Object)
      );

      // Should not call formatMultiTarget when targetDefinitions is null
      expect(mockCommandFormatter.formatMultiTarget).not.toHaveBeenCalled();
    });

    it('should clean up extra spaces in transformed template', async () => {
      const context = {
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'spacing:action',
              name: 'Spacing Action',
              template:
                'complex   {primary}    and   {secondary}   with  {tertiary}  end',
            },
            targetContexts: [],
          },
        ],
        resolvedTargets: {
          primary: [{ id: 'item_001', displayName: 'Primary' }],
        },
        targetDefinitions: {
          primary: { placeholder: 'primary' },
          secondary: { placeholder: 'secondary' },
          tertiary: { placeholder: 'tertiary' },
        },
      };

      mockCommandFormatter.formatMultiTarget.mockReturnValue({
        ok: false,
        error: 'Multi-target failed',
      });

      mockCommandFormatter.format.mockReturnValue({
        ok: true,
        value: 'complex Primary with end',
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);

      // Verify template was cleaned up - extra spaces removed
      expect(mockCommandFormatter.format).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'complex {target} and with end', // Cleaned up spaces
        }),
        expect.any(Object),
        expect.any(Object),
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should handle complex template transformation with multiple placeholders', async () => {
      const context = {
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'complex-transform:action',
              name: 'Complex Transform Action',
              template:
                'cast {spell} using {focus} targeting {enemy} in {location} with {component}',
            },
            targetContexts: [],
          },
        ],
        resolvedTargets: {
          primary: [{ id: 'spell_001', displayName: 'Fireball' }],
        },
        targetDefinitions: {
          primary: { placeholder: 'spell' }, // This becomes {target}
          secondary: { placeholder: 'focus' }, // This gets removed
          tertiary: { placeholder: 'enemy' }, // This gets removed
          quaternary: { placeholder: 'location' }, // This gets removed
          quinary: { placeholder: 'component' }, // This gets removed
        },
      };

      mockCommandFormatter.formatMultiTarget.mockReturnValue({
        ok: false,
        error: 'Multi-target failed',
      });

      mockCommandFormatter.format.mockReturnValue({
        ok: true,
        value: 'cast Fireball using targeting in with',
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);

      // Verify complex template transformation
      expect(mockCommandFormatter.format).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'cast {target} using targeting in with',
        }),
        expect.any(Object),
        expect.any(Object),
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should handle template with no placeholders to transform', async () => {
      const context = {
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'no-placeholders:action',
              name: 'No Placeholders Action',
              template: 'simple action with no placeholders',
            },
            targetContexts: [],
          },
        ],
        resolvedTargets: {
          primary: [{ id: 'item_001', displayName: 'Item' }],
        },
        targetDefinitions: {
          primary: { placeholder: 'nonexistent' },
        },
      };

      mockCommandFormatter.formatMultiTarget.mockReturnValue({
        ok: false,
        error: 'Multi-target failed',
      });

      mockCommandFormatter.format.mockReturnValue({
        ok: true,
        value: 'simple action with no placeholders',
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);

      // Template should remain completely unchanged
      expect(mockCommandFormatter.format).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'simple action with no placeholders',
        }),
        expect.any(Object),
        expect.any(Object),
        expect.any(Object),
        expect.any(Object)
      );
    });
  });
});
