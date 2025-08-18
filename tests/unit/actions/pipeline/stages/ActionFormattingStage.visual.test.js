/**
 * @file Unit tests for ActionFormattingStage visual properties handling
 * @see src/actions/pipeline/stages/ActionFormattingStage.js
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ActionFormattingStage } from '../../../../../src/actions/pipeline/stages/ActionFormattingStage.js';
import ActionAwareStructuredTrace from '../../../../../src/actions/tracing/actionAwareStructuredTrace.js';

describe('ActionFormattingStage - Visual Properties', () => {
  let stage;
  let mockCommandFormatter;
  let mockEntityManager;
  let mockSafeEventDispatcher;
  let mockGetEntityDisplayNameFn;
  let mockErrorContextBuilder;
  let mockLogger;
  let mockActionDef;
  let mockTargetContext;
  let mockFormatResult;

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

    mockActionDef = {
      id: 'test:action',
      name: 'Test Action',
      template: 'test {target}',
      description: 'Test action description',
    };

    mockTargetContext = {
      entityId: 'player_entity',
    };

    mockFormatResult = {
      ok: true,
      value: 'formatted command string',
    };
  });

  describe('actionInfo visual property handling', () => {
    it('should include visual properties in actionInfo objects', async () => {
      const actionDefWithVisual = {
        ...mockActionDef,
        visual: {
          backgroundColor: '#ff0000',
          textColor: '#ffffff',
        },
      };

      const context = {
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: actionDefWithVisual,
            targetContexts: [mockTargetContext],
          },
        ],
      };

      mockCommandFormatter.format.mockReturnValue(mockFormatResult);

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].visual).toBeDefined();
      expect(result.actions[0].visual.backgroundColor).toBe('#ff0000');
      expect(result.actions[0].visual.textColor).toBe('#ffffff');
    });

    it('should handle missing visual properties with null', async () => {
      const context = {
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: mockActionDef,
            targetContexts: [mockTargetContext],
          },
        ],
      };

      mockCommandFormatter.format.mockReturnValue(mockFormatResult);

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].visual).toBeNull();
    });

    it('should handle partial visual properties', async () => {
      const actionDefWithPartialVisual = {
        ...mockActionDef,
        visual: {
          backgroundColor: '#ff0000',
          // No textColor
        },
      };

      const context = {
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: actionDefWithPartialVisual,
            targetContexts: [mockTargetContext],
          },
        ],
      };

      mockCommandFormatter.format.mockReturnValue(mockFormatResult);

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].visual.backgroundColor).toBe('#ff0000');
      expect(result.actions[0].visual.textColor).toBeUndefined();
    });

    it('should test integration with formattedActions array', async () => {
      const actionDefWithVisual = {
        ...mockActionDef,
        visual: {
          backgroundColor: '#00ff00',
        },
      };

      const context = {
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: actionDefWithVisual,
            targetContexts: [mockTargetContext],
          },
        ],
      };

      mockCommandFormatter.format.mockReturnValue(mockFormatResult);

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].visual.backgroundColor).toBe('#00ff00');
    });
  });

  describe('Multi-target visual property handling', () => {
    it('should include visual properties in multi-target actionInfo objects', async () => {
      const actionDefWithVisual = {
        ...mockActionDef,
        visual: {
          backgroundColor: '#0000ff',
          textColor: '#ffffff',
          hoverBackgroundColor: '#ff00ff',
          hoverTextColor: '#000000',
        },
      };

      const context = {
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: actionDefWithVisual,
            targetContexts: [],
          },
        ],
        resolvedTargets: {
          primary: [{ id: 'target1', displayName: 'Target 1' }],
        },
        targetDefinitions: {
          primary: { placeholder: 'target' },
        },
      };

      mockCommandFormatter.formatMultiTarget.mockReturnValue({
        ok: true,
        value: 'multi-target formatted',
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].visual).toEqual({
        backgroundColor: '#0000ff',
        textColor: '#ffffff',
        hoverBackgroundColor: '#ff00ff',
        hoverTextColor: '#000000',
      });
    });

    it('should handle visual properties in multi-target fallback scenarios', async () => {
      const actionDefWithVisual = {
        ...mockActionDef,
        visual: {
          backgroundColor: '#ffff00',
        },
      };

      const context = {
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: actionDefWithVisual,
            targetContexts: [],
          },
        ],
        resolvedTargets: {
          primary: [{ id: 'target1', displayName: 'Target 1' }],
        },
        targetDefinitions: {
          primary: { placeholder: 'target' },
        },
      };

      // Multi-target fails, fallback to legacy
      mockCommandFormatter.formatMultiTarget.mockReturnValue({
        ok: false,
        error: 'Multi-target formatting failed',
      });

      mockCommandFormatter.format.mockReturnValue(mockFormatResult);

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].visual).toEqual({
        backgroundColor: '#ffff00',
      });
    });
  });

  describe('Per-action metadata visual property handling', () => {
    it('should include visual properties in per-action metadata path', async () => {
      const actionDefWithVisual = {
        ...mockActionDef,
        visual: {
          backgroundColor: '#ff8800',
        },
      };

      const context = {
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: actionDefWithVisual,
            targetContexts: [mockTargetContext],
            resolvedTargets: {
              primary: [{ id: 'target1', displayName: 'Target 1' }],
            },
            targetDefinitions: {
              primary: { placeholder: 'target' },
            },
            isMultiTarget: false, // Legacy processing in per-action path
          },
        ],
      };

      mockCommandFormatter.format.mockReturnValue(mockFormatResult);

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].visual).toEqual({
        backgroundColor: '#ff8800',
      });
    });

    it('should include visual properties in multi-target per-action metadata', async () => {
      const actionDefWithVisual = {
        ...mockActionDef,
        visual: {
          backgroundColor: '#88ff00',
          textColor: '#000000',
        },
      };

      const context = {
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: actionDefWithVisual,
            targetContexts: [],
            resolvedTargets: {
              primary: [{ id: 'target1', displayName: 'Target 1' }],
            },
            targetDefinitions: {
              primary: { placeholder: 'target' },
            },
            isMultiTarget: true,
          },
        ],
      };

      mockCommandFormatter.formatMultiTarget.mockReturnValue({
        ok: true,
        value: 'per-action multi-target formatted',
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].visual).toEqual({
        backgroundColor: '#88ff00',
        textColor: '#000000',
      });
    });
  });

  describe('Visual property validation', () => {
    it('should handle invalid visual property structure gracefully', async () => {
      const actionDefWithInvalidVisual = {
        ...mockActionDef,
        visual: 'invalid-visual-data', // Should be object
      };

      const context = {
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: actionDefWithInvalidVisual,
            targetContexts: [mockTargetContext],
          },
        ],
      };

      mockCommandFormatter.format.mockReturnValue(mockFormatResult);

      const result = await stage.executeInternal(context);

      // Should still process successfully, visual property just passed through
      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].visual).toBe('invalid-visual-data');
    });

    it('should handle null visual properties', async () => {
      const actionDefWithNullVisual = {
        ...mockActionDef,
        visual: null,
      };

      const context = {
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: actionDefWithNullVisual,
            targetContexts: [mockTargetContext],
          },
        ],
      };

      mockCommandFormatter.format.mockReturnValue(mockFormatResult);

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].visual).toBeNull();
    });

    it('should handle undefined visual properties', async () => {
      const actionDefWithUndefinedVisual = {
        ...mockActionDef,
        visual: undefined,
      };

      const context = {
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: actionDefWithUndefinedVisual,
            targetContexts: [mockTargetContext],
          },
        ],
      };

      mockCommandFormatter.format.mockReturnValue(mockFormatResult);

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].visual).toBeNull();
    });
  });

  describe('Visual property flow through different formatting paths', () => {
    it('should preserve visual properties in traced execution', async () => {
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

      const actionDefWithVisual = {
        ...mockActionDef,
        visual: {
          backgroundColor: '#abcdef',
        },
      };

      const context = {
        trace,
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: actionDefWithVisual,
            targetContexts: [mockTargetContext],
          },
        ],
      };

      mockCommandFormatter.format.mockReturnValue(mockFormatResult);

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].visual).toEqual({
        backgroundColor: '#abcdef',
      });
    });

    it('should preserve visual properties in legacy multi-target processing', async () => {
      const actionDefWithVisual = {
        ...mockActionDef,
        visual: {
          backgroundColor: '#fed123',
          textColor: '#456789',
        },
        targets: {
          primary: { placeholder: 'target' },
        },
      };

      const context = {
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: actionDefWithVisual,
            targetContexts: [
              {
                entityId: 'target1',
                displayName: 'Target 1',
                placeholder: 'target',
              },
            ],
          },
        ],
      };

      mockEntityManager.getEntityInstance.mockReturnValue({ id: 'target1' });
      mockCommandFormatter.formatMultiTarget.mockReturnValue({
        ok: true,
        value: 'legacy multi-target result',
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].visual).toEqual({
        backgroundColor: '#fed123',
        textColor: '#456789',
      });
    });
  });

  describe('Multiple actions with visual properties', () => {
    it('should handle multiple actions with different visual properties', async () => {
      const action1 = {
        ...mockActionDef,
        id: 'test:action1',
        visual: {
          backgroundColor: '#111111',
        },
      };

      const action2 = {
        ...mockActionDef,
        id: 'test:action2',
        visual: {
          backgroundColor: '#222222',
          textColor: '#333333',
        },
      };

      const action3 = {
        ...mockActionDef,
        id: 'test:action3',
        // No visual properties
      };

      const context = {
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: action1,
            targetContexts: [mockTargetContext],
          },
          {
            actionDef: action2,
            targetContexts: [mockTargetContext],
          },
          {
            actionDef: action3,
            targetContexts: [mockTargetContext],
          },
        ],
      };

      mockCommandFormatter.format.mockReturnValue(mockFormatResult);

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(3);

      // First action with background color only
      expect(result.actions[0].visual).toEqual({
        backgroundColor: '#111111',
      });

      // Second action with both background and text color
      expect(result.actions[1].visual).toEqual({
        backgroundColor: '#222222',
        textColor: '#333333',
      });

      // Third action with no visual properties
      expect(result.actions[2].visual).toBeNull();
    });
  });
});
