/**
 * @file Unit tests for ActionFormattingStage - Coverage Enhancement
 * @see src/actions/pipeline/stages/ActionFormattingStage.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ActionFormattingStage } from '../../../../../src/actions/pipeline/stages/ActionFormattingStage.js';
import { PipelineResult } from '../../../../../src/actions/pipeline/PipelineResult.js';
import { ERROR_PHASES } from '../../../../../src/actions/errors/actionErrorTypes.js';
import { TargetExtractionResult } from '../../../../../src/entities/multiTarget/targetExtractionResult.js';

describe('ActionFormattingStage - Coverage Enhancement', () => {
  let stage;
  let mockEntityManager;
  let mockFormatter;
  let mockSafeEventDispatcher;
  let mockGetEntityDisplayNameFn;
  let mockErrorContextBuilder;
  let mockLogger;

  beforeEach(() => {
    mockEntityManager = {
      getEntityInstance: jest.fn(),
    };

    mockFormatter = {
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
      commandFormatter: mockFormatter,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockSafeEventDispatcher,
      getEntityDisplayNameFn: mockGetEntityDisplayNameFn,
      errorContextBuilder: mockErrorContextBuilder,
      logger: mockLogger,
    });
  });

  describe('Mixed Mode Processing (Lines 111, 564-685)', () => {
    it('should log warning for mixed legacy and multi-target actions through legacy path', async () => {
      // Test line 111 - warning log for mixed mode
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
              template: 'multi {item} on {target}',
              targets: {
                primary: { scope: 'inventory', placeholder: 'item' },
                secondary: { scope: 'enemies', placeholder: 'target' },
              },
            },
            targetContexts: [
              { entityId: 'item1', displayName: 'Item' },
              { entityId: 'target1', displayName: 'Target' },
            ],
          },
        ],
      };

      mockFormatter.format.mockReturnValue({
        ok: true,
        value: 'formatted command',
      });

      mockFormatter.formatMultiTarget.mockReturnValue({
        ok: true,
        value: 'multi formatted command',
      });

      await stage.executeInternal(mixedContext);

      // Verify the warning was logged for mixed mode processing
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Processing mixed legacy and multi-target actions through legacy formatting path. ' +
          'Multi-target actions will be handled individually with fallback formatting.'
      );
    });

    it('should handle multi-target action in legacy context with successful formatMultiTarget', async () => {
      // Test lines 564-685 - multi-target action processing in legacy context
      const legacyContextWithMultiTarget = {
        actor: { id: 'player' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'combat:spell',
              name: 'Cast Spell',
              template: 'cast {spell} at {target}',
              targets: {
                primary: { scope: 'spells', placeholder: 'spell' },
                secondary: { scope: 'enemies', placeholder: 'target' },
              },
            },
            targetContexts: [
              {
                entityId: 'fireball',
                displayName: 'Fireball',
                placeholder: 'spell',
                contextFromId: 'spell_context',
              },
              {
                entityId: 'goblin',
                displayName: 'Goblin',
                placeholder: 'target',
                contextFromId: 'target_context',
              },
            ],
          },
        ],
      };

      // Mock entity instances for target extraction
      mockEntityManager.getEntityInstance.mockImplementation((id) => ({ id }));

      mockFormatter.formatMultiTarget.mockReturnValue({
        ok: true,
        value: ['cast Fireball at Goblin'],
      });

      const result = await stage.executeInternal(legacyContextWithMultiTarget);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0]).toEqual({
        id: 'combat:spell',
        name: 'Cast Spell',
        command: 'cast Fireball at Goblin',
        description: '',
        params: {
          targetIds: {
            spell: ['fireball'],
            target: ['goblin'],
          },
          isMultiTarget: true,
        },
        visual: null,
      });

      expect(mockFormatter.formatMultiTarget).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'combat:spell' }),
        expect.objectContaining({
          spell: expect.arrayContaining([
            expect.objectContaining({ id: 'fireball' }),
          ]),
          target: expect.arrayContaining([
            expect.objectContaining({ id: 'goblin' }),
          ]),
        }),
        mockEntityManager,
        expect.any(Object),
        expect.objectContaining({
          displayNameFn: mockGetEntityDisplayNameFn,
          targetDefinitions: expect.objectContaining({
            primary: expect.any(Object),
            secondary: expect.any(Object),
          }),
        })
      );
    });

    it('should fallback to legacy formatting when multi-target formatting fails in legacy context', async () => {
      // Test lines 612-644 - fallback scenario in legacy context
      const legacyContextWithMultiTarget = {
        actor: { id: 'player' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'combat:spell',
              name: 'Cast Spell',
              template: 'cast {spell} at {target}',
              targets: {
                primary: { scope: 'spells', placeholder: 'spell' },
                secondary: { scope: 'enemies', placeholder: 'target' },
              },
            },
            targetContexts: [
              {
                entityId: 'fireball',
                displayName: 'Fireball',
                placeholder: 'spell',
              },
              {
                entityId: 'goblin',
                displayName: 'Goblin',
                placeholder: 'target',
              },
            ],
          },
        ],
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => ({ id }));

      // Multi-target formatting fails
      mockFormatter.formatMultiTarget.mockReturnValue({
        ok: false,
        error: 'Multi-target formatting failed',
      });

      // Legacy formatting succeeds
      mockFormatter.format.mockReturnValue({
        ok: true,
        value: 'cast Fireball',
      });

      const result = await stage.executeInternal(legacyContextWithMultiTarget);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].command).toBe('cast Fireball');
      expect(result.actions[0].params.targetId).toBe('fireball');

      // Verify both formatters were called
      expect(mockFormatter.formatMultiTarget).toHaveBeenCalled();
      expect(mockFormatter.format).toHaveBeenCalled();
    });

    it('should handle multi-target action without formatMultiTarget method in legacy context', async () => {
      // Test lines 645-677 - fallback when formatMultiTarget not available
      const legacyContextWithMultiTarget = {
        actor: { id: 'player' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'combat:spell',
              name: 'Cast Spell',
              template: 'cast {spell}',
              targets: {
                primary: { scope: 'spells', placeholder: 'spell' },
              },
            },
            targetContexts: [
              {
                entityId: 'fireball',
                displayName: 'Fireball',
                placeholder: 'spell',
              },
            ],
          },
        ],
      };

      // Remove formatMultiTarget method
      mockFormatter.formatMultiTarget = undefined;

      mockEntityManager.getEntityInstance.mockImplementation((id) => ({ id }));

      mockFormatter.format.mockReturnValue({
        ok: true,
        value: 'cast Fireball',
      });

      const result = await stage.executeInternal(legacyContextWithMultiTarget);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].command).toBe('cast Fireball');

      expect(mockFormatter.format).toHaveBeenCalled();
    });

    it('should skip multi-target action when no resolved targets available in legacy context', async () => {
      // Test lines 678-685 - warning for multi-target action without proper targets
      const legacyContextWithMultiTarget = {
        actor: { id: 'player' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'combat:spell',
              name: 'Cast Spell',
              template: 'cast {spell} at {target}',
              targets: {
                primary: { scope: 'spells', placeholder: 'spell' },
                secondary: { scope: 'enemies', placeholder: 'target' },
              },
            },
            targetContexts: [], // Empty target contexts
          },
        ],
      };

      const result = await stage.executeInternal(legacyContextWithMultiTarget);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(0);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Skipping multi-target action 'combat:spell' in legacy formatting"
        )
      );
    });
  });

  describe('Complex Error Handling Scenarios (Lines 196-261, 291-315, 726-733)', () => {
    it('should handle multi-target formatting failure with no primary target available', async () => {
      // Test lines 223-232 - no targets available error path
      const contextWithPerActionMetadata = {
        actor: { id: 'player' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:action',
              name: 'Test Action',
              template: 'test {item}',
            },
            targetContexts: [],
            resolvedTargets: {}, // Empty resolved targets
            targetDefinitions: {
              primary: { placeholder: 'item' },
            },
            isMultiTarget: true,
          },
        ],
      };

      // Formatter doesn't have formatMultiTarget
      mockFormatter.formatMultiTarget = undefined;

      const result = await stage.executeInternal(contextWithPerActionMetadata);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);

      expect(mockErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'No targets available for action',
          actionDef: expect.objectContaining({ id: 'test:action' }),
          actorId: 'player',
          targetId: null,
        })
      );
    });

    it('should handle exceptions during legacy action formatting in per-action metadata', async () => {
      // Test lines 301-312 - exception handling in legacy action formatting
      const contextWithPerActionMetadata = {
        actor: { id: 'player' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:action',
              name: 'Test Action',
              template: 'test {target}',
            },
            targetContexts: [{ entityId: 'target1', displayName: 'Target 1' }],
            resolvedTargets: {
              primary: [{ id: 'target1', displayName: 'Target 1' }],
            },
            targetDefinitions: {
              primary: { placeholder: 'target' },
            },
            isMultiTarget: false,
          },
        ],
      };

      const thrownError = new Error('Formatter threw an exception');
      mockFormatter.format.mockImplementation(() => {
        throw thrownError;
      });

      const result = await stage.executeInternal(contextWithPerActionMetadata);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);

      expect(mockErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith(
        expect.objectContaining({
          error: thrownError,
          actionDef: expect.objectContaining({ id: 'test:action' }),
          actorId: 'player',
          targetId: 'target1',
        })
      );
    });

    it('should handle formatter errors with additional context details', async () => {
      // Test lines 726-733 - error handling with target ID extraction
      const legacyContext = {
        actor: { id: 'player' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:action',
              name: 'Test Action',
              template: 'test {target}',
            },
            targetContexts: [{ entityId: 'target1', displayName: 'Target 1' }],
          },
        ],
      };

      const errorWithTarget = new Error('Format failed');
      errorWithTarget.target = { entityId: 'extracted_target' };
      errorWithTarget.entityId = 'fallback_target';

      mockFormatter.format.mockImplementation(() => {
        throw errorWithTarget;
      });

      const result = await stage.executeInternal(legacyContext);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Failed to format command for action 'test:action'"
        ),
        expect.objectContaining({
          error: errorWithTarget,
          actionDef: expect.objectContaining({ id: 'test:action' }),
        })
      );
    });
  });

  describe('Target Extraction Edge Cases (Lines 778-782, 805-813, 888-935)', () => {
    it('should extract target IDs using TargetExtractionResult optimization', async () => {
      // Test lines 778-782 - optimized target extraction with TargetExtractionResult
      const mockTargetExtractionResult = {
        getEntityIdByPlaceholder: jest.fn(),
        getTargetNames: jest.fn().mockReturnValue(['primary', 'secondary']),
      };

      mockTargetExtractionResult.getEntityIdByPlaceholder.mockImplementation(
        (placeholder) => {
          if (placeholder === 'primary') return 'item1';
          if (placeholder === 'secondary') return 'target1';
          return null;
        }
      );

      const context = {
        actor: { id: 'player' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:action',
              name: 'Test Action',
              template: 'test {item} on {target}',
            },
          },
        ],
        resolvedTargets: mockTargetExtractionResult,
        targetDefinitions: {
          primary: { placeholder: 'item' },
          secondary: { placeholder: 'target' },
        },
      };

      mockFormatter.formatMultiTarget.mockReturnValue({
        ok: true,
        value: 'test item1 on target1',
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions[0].params.targetIds).toEqual({
        primary: ['item1'],
        secondary: ['target1'],
      });

      expect(mockTargetExtractionResult.getTargetNames).toHaveBeenCalled();
      expect(
        mockTargetExtractionResult.getEntityIdByPlaceholder
      ).toHaveBeenCalledWith('primary');
      expect(
        mockTargetExtractionResult.getEntityIdByPlaceholder
      ).toHaveBeenCalledWith('secondary');
    });

    it('should handle target extraction from contexts with missing required targets', async () => {
      // Test lines 888-935 - complex target extraction with validation
      const legacyContextWithMultiTarget = {
        actor: { id: 'player' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'combat:multicast',
              name: 'Multicast Spell',
              template:
                'cast {spell} at {primary_target} and {secondary_target}',
              targets: {
                primary: { placeholder: 'spell' },
                secondary: { placeholder: 'primary_target' },
                tertiary: { placeholder: 'secondary_target' },
              },
            },
            targetContexts: [
              {
                entityId: 'fireball',
                displayName: 'Fireball',
                placeholder: 'spell',
              },
              {
                entityId: 'goblin1',
                displayName: 'Goblin 1',
                placeholder: 'primary_target',
              },
              // Missing tertiary target - should cause validation failure
            ],
          },
        ],
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => ({ id }));

      const result = await stage.executeInternal(legacyContextWithMultiTarget);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(0); // No actions due to missing required target

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "Missing required target 'tertiary' for action 'combat:multicast'"
        )
      );
    });

    it('should properly group target contexts by placeholder', async () => {
      // Test target grouping logic in extractTargetsFromContexts
      const legacyContextWithMultiTarget = {
        actor: { id: 'player' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'combat:area_spell',
              name: 'Area Spell',
              template: 'cast {spell} targeting {enemies}',
              targets: {
                primary: { placeholder: 'spell' },
                secondary: { placeholder: 'enemies' },
              },
            },
            targetContexts: [
              {
                entityId: 'fireball',
                displayName: 'Fireball',
                placeholder: 'spell',
              },
              {
                entityId: 'goblin1',
                displayName: 'Goblin 1',
                placeholder: 'enemies',
              },
              {
                entityId: 'goblin2',
                displayName: 'Goblin 2',
                placeholder: 'enemies',
              },
              {
                entityId: 'orc1',
                displayName: 'Orc 1',
                // No placeholder - should default to 'primary'
              },
            ],
          },
        ],
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => ({ id }));

      mockFormatter.formatMultiTarget.mockReturnValue({
        ok: true,
        value: 'cast Fireball targeting enemies',
      });

      const result = await stage.executeInternal(legacyContextWithMultiTarget);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);

      // Verify the formatter was called with properly grouped targets
      expect(mockFormatter.formatMultiTarget).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          spell: expect.arrayContaining([
            expect.objectContaining({ id: 'fireball' }),
          ]),
          enemies: expect.arrayContaining([
            expect.objectContaining({ id: 'goblin1' }),
            expect.objectContaining({ id: 'goblin2' }),
          ]),
          primary: expect.arrayContaining([
            expect.objectContaining({ id: 'orc1' }),
          ]),
        }),
        expect.any(Object),
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('Error Creation Edge Cases (Lines 949-1001)', () => {
    it('should handle error creation with format result object containing details', async () => {
      const context = {
        actor: { id: 'player' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:action',
              name: 'Test Action',
              template: 'test {target}',
            },
            targetContexts: [{ entityId: 'target1', displayName: 'Target 1' }],
          },
        ],
      };

      const formatResultWithDetails = {
        ok: false,
        error: 'Template validation failed',
        details: {
          missingPlaceholder: 'target',
          templateError: 'Invalid syntax',
        },
      };

      mockFormatter.format.mockReturnValue(formatResultWithDetails);

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(1);

      expect(mockErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Template validation failed',
          additionalContext: expect.objectContaining({
            stage: 'action_formatting',
            formatDetails: {
              missingPlaceholder: 'target',
              templateError: 'Invalid syntax',
            },
          }),
        })
      );
    });

    it('should handle error creation with thrown Error object', async () => {
      const context = {
        actor: { id: 'player' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:action',
              name: 'Test Action',
              template: 'test {target}',
            },
            targetContexts: [{ entityId: 'target1', displayName: 'Target 1' }],
          },
        ],
      };

      const thrownError = new Error('Unexpected error');
      mockFormatter.format.mockImplementation(() => {
        throw thrownError;
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(1);

      expect(mockErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith(
        expect.objectContaining({
          error: thrownError,
          additionalContext: expect.objectContaining({
            stage: 'action_formatting',
            thrown: true,
          }),
        })
      );
    });
  });

  describe('Template Transformation Edge Cases (Lines 850-877)', () => {
    it('should transform complex templates for legacy fallback', async () => {
      const context = {
        actor: { id: 'player' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:action',
              name: 'Test Action',
              template: '  use   {item}   on   {target}   with   {tool}  ',
            },
          },
        ],
        resolvedTargets: {
          primary: [{ id: 'item1', displayName: 'Item 1' }],
        },
        targetDefinitions: {
          primary: { placeholder: 'item' },
          secondary: { placeholder: 'target' },
          tertiary: { placeholder: 'tool' },
        },
      };

      mockFormatter.formatMultiTarget.mockReturnValue({
        ok: false,
        error: 'Multi-target formatting failed',
      });

      mockFormatter.format.mockReturnValue({
        ok: true,
        value: 'use Item 1 on with',
      });

      await stage.executeInternal(context);

      // Verify the template was transformed and cleaned up
      expect(mockFormatter.format).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'use on with', // Spaces cleaned up, placeholders removed/transformed
        }),
        expect.any(Object),
        expect.any(Object),
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('Additional Coverage for Remaining Lines', () => {
    it('should handle per-action metadata multi-target fallback with no primary target (lines 223-232)', async () => {
      const contextWithPerActionMetadata = {
        actor: { id: 'player' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:action',
              name: 'Test Action',
              template: 'test {item}',
            },
            targetContexts: [],
            resolvedTargets: {
              // No primary targets, but has other targets
              secondary: [{ id: 'item1', displayName: 'Item 1' }],
            },
            targetDefinitions: {
              primary: { placeholder: 'item' },
            },
            isMultiTarget: true,
          },
        ],
      };

      mockFormatter.formatMultiTarget.mockReturnValue({
        ok: false,
        error: 'Multi-target formatting failed',
      });

      const result = await stage.executeInternal(contextWithPerActionMetadata);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);

      expect(mockErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
          actionDef: expect.objectContaining({ id: 'test:action' }),
          actorId: 'player',
          targetId: null,
          additionalContext: expect.objectContaining({
            stage: 'action_formatting',
            thrown: true,
          }),
        })
      );
    });

    it('should handle legacy formatting fallback failure in per-action metadata (lines 212-222)', async () => {
      const contextWithPerActionMetadata = {
        actor: { id: 'player' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:action',
              name: 'Test Action',
              template: 'test {item}',
            },
            targetContexts: [],
            resolvedTargets: {
              primary: [{ id: 'item1', displayName: 'Item 1' }],
            },
            targetDefinitions: {
              primary: { placeholder: 'item' },
            },
            isMultiTarget: true,
          },
        ],
      };

      mockFormatter.formatMultiTarget.mockReturnValue({
        ok: false,
        error: 'Multi-target formatting failed',
      });

      mockFormatter.format.mockReturnValue({
        ok: false,
        error: 'Legacy formatting also failed',
      });

      const result = await stage.executeInternal(contextWithPerActionMetadata);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);

      expect(mockErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Legacy formatting also failed',
          targetId: 'item1',
          additionalContext: expect.objectContaining({
            stage: 'action_formatting',
          }),
        })
      );
    });

    it('should handle fallback scenario with missing primary target in formatMultiTargetActions (line 496)', async () => {
      const context = {
        actor: { id: 'player' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:action',
              name: 'Test Action',
              template: 'test {item}',
            },
          },
        ],
        resolvedTargets: {
          // No primary targets available
          secondary: [{ id: 'item1', displayName: 'Item 1' }],
        },
        targetDefinitions: {
          primary: { placeholder: 'item' },
        },
      };

      mockFormatter.formatMultiTarget.mockReturnValue({
        ok: false,
        error: 'Multi-target formatting failed',
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);

      expect(mockErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
          targetId: null,
          additionalContext: expect.objectContaining({
            stage: 'action_formatting',
            thrown: true,
          }),
        })
      );
    });

    it('should handle multi-target per-action metadata fallback success path (lines 204-211)', async () => {
      const contextWithPerActionMetadata = {
        actor: { id: 'player' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:action',
              name: 'Test Action',
              template: 'test {item}',
            },
            targetContexts: [],
            resolvedTargets: {
              primary: [{ id: 'item1', displayName: 'Item 1' }],
            },
            targetDefinitions: {
              primary: { placeholder: 'item' },
            },
            isMultiTarget: true,
          },
        ],
      };

      // Multi-target formatting fails
      mockFormatter.formatMultiTarget.mockReturnValue({
        ok: false,
        error: 'Multi-target formatting failed',
      });

      // Legacy fallback succeeds
      mockFormatter.format.mockReturnValue({
        ok: true,
        value: 'test Item 1',
      });

      const result = await stage.executeInternal(contextWithPerActionMetadata);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0]).toEqual({
        id: 'test:action',
        name: 'Test Action',
        command: 'test Item 1',
        description: '',
        params: { targetId: 'item1' },
        visual: null,
      });
      expect(result.errors).toHaveLength(0);
    });

    it('should handle error when no primary target in per-action metadata (line 224)', async () => {
      const contextWithPerActionMetadata = {
        actor: { id: 'player' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:action',
              name: 'Test Action',
              template: 'test {item}',
            },
            targetContexts: [],
            resolvedTargets: {}, // No targets at all
            targetDefinitions: {
              primary: { placeholder: 'item' },
            },
            isMultiTarget: true,
          },
        ],
      };

      mockFormatter.formatMultiTarget.mockReturnValue({
        ok: false,
        error: 'Multi-target formatting failed',
      });

      const result = await stage.executeInternal(contextWithPerActionMetadata);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);

      expect(mockErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Multi-target formatting failed',
          actionDef: expect.objectContaining({ id: 'test:action' }),
          actorId: 'player',
          targetId: null,
        })
      );
    });

    it('should handle legacy formatting when formatMultiTarget unavailable in per-action metadata (lines 234-249)', async () => {
      const contextWithPerActionMetadata = {
        actor: { id: 'player' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:action',
              name: 'Test Action',
              template: 'test {item}',
            },
            targetContexts: [],
            resolvedTargets: {
              primary: [{ id: 'item1', displayName: 'Item 1' }],
            },
            targetDefinitions: {
              primary: { placeholder: 'item' },
            },
            isMultiTarget: true,
          },
        ],
      };

      // Remove formatMultiTarget method to trigger fallback path
      mockFormatter.formatMultiTarget = undefined;

      mockFormatter.format.mockReturnValue({
        ok: true,
        value: 'test Item 1',
      });

      const result = await stage.executeInternal(contextWithPerActionMetadata);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0]).toEqual({
        id: 'test:action',
        name: 'Test Action',
        command: 'test Item 1',
        description: '',
        params: { targetId: 'item1' },
        visual: null,
      });
      expect(result.errors).toHaveLength(0);

      expect(mockFormatter.format).toHaveBeenCalled();
    });

    it('should handle error creation when legacy formatting fails without formatMultiTarget in per-action metadata (line 249)', async () => {
      const contextWithPerActionMetadata = {
        actor: { id: 'player' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:action',
              name: 'Test Action',
              template: 'test {item}',
            },
            targetContexts: [],
            resolvedTargets: {
              primary: [{ id: 'item1', displayName: 'Item 1' }],
            },
            targetDefinitions: {
              primary: { placeholder: 'item' },
            },
            isMultiTarget: true,
          },
        ],
      };

      // Remove formatMultiTarget method to trigger fallback path
      mockFormatter.formatMultiTarget = undefined;

      // Legacy formatting fails
      mockFormatter.format.mockReturnValue({
        ok: false,
        error: 'Legacy formatting failed',
      });

      const result = await stage.executeInternal(contextWithPerActionMetadata);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);

      expect(mockErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Legacy formatting failed',
          actionDef: expect.objectContaining({ id: 'test:action' }),
          actorId: 'player',
          targetId: 'item1',
        })
      );
    });

    it('should handle error creation in per-action metadata legacy processing (line 291)', async () => {
      const contextWithPerActionMetadata = {
        actor: { id: 'player' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:action',
              name: 'Test Action',
              template: 'test {target}',
            },
            targetContexts: [{ entityId: 'target1', displayName: 'Target 1' }],
            resolvedTargets: {
              primary: [{ id: 'target1', displayName: 'Target 1' }],
            },
            targetDefinitions: {
              primary: { placeholder: 'target' },
            },
            isMultiTarget: false, // Legacy action in per-action metadata
          },
        ],
      };

      mockFormatter.format.mockReturnValue({
        ok: false,
        error: 'Legacy formatting failed',
      });

      const result = await stage.executeInternal(contextWithPerActionMetadata);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);

      expect(mockErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Legacy formatting failed',
          actionDef: expect.objectContaining({ id: 'test:action' }),
          actorId: 'player',
          targetId: 'target1',
        })
      );
    });

    it('should handle error creation in formatMultiTargetActions fallback (line 496)', async () => {
      const context = {
        actor: { id: 'player' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:action',
              name: 'Test Action',
              template: 'test {item}',
            },
          },
        ],
        resolvedTargets: {
          primary: [{ id: 'item1', displayName: 'Item 1' }],
        },
        targetDefinitions: {
          primary: { placeholder: 'item' },
        },
      };

      // Remove formatMultiTarget to trigger the else branch (line 470)
      mockFormatter.formatMultiTarget = undefined;

      // Legacy fallback fails
      mockFormatter.format.mockReturnValue({
        ok: false,
        error: 'Legacy fallback failed',
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);

      expect(mockErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Legacy fallback failed',
          actionDef: expect.objectContaining({ id: 'test:action' }),
          actorId: 'player',
          targetId: 'item1',
        })
      );
    });

    it('should handle error creation in legacy context multi-target fallback (line 633)', async () => {
      const legacyContextWithMultiTarget = {
        actor: { id: 'player' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'combat:spell',
              name: 'Cast Spell',
              template: 'cast {spell}',
              targets: {
                primary: { scope: 'spells', placeholder: 'spell' },
              },
            },
            targetContexts: [
              {
                entityId: 'fireball',
                displayName: 'Fireball',
                placeholder: 'spell',
              },
            ],
          },
        ],
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => ({ id }));

      // Multi-target formatting fails
      mockFormatter.formatMultiTarget.mockReturnValue({
        ok: false,
        error: 'Multi-target formatting failed',
      });

      // Legacy fallback also fails
      mockFormatter.format.mockReturnValue({
        ok: false,
        error: 'Legacy fallback failed',
      });

      const result = await stage.executeInternal(legacyContextWithMultiTarget);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);

      expect(mockErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Legacy fallback failed',
          actionDef: expect.objectContaining({ id: 'combat:spell' }),
          actorId: 'player',
          targetId: 'fireball',
        })
      );
    });

    it('should handle error creation in legacy context without formatMultiTarget (line 666)', async () => {
      const legacyContextWithMultiTarget = {
        actor: { id: 'player' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'combat:spell',
              name: 'Cast Spell',
              template: 'cast {spell}',
              targets: {
                primary: { scope: 'spells', placeholder: 'spell' },
              },
            },
            targetContexts: [
              {
                entityId: 'fireball',
                displayName: 'Fireball',
                placeholder: 'spell',
              },
            ],
          },
        ],
      };

      // Remove formatMultiTarget method to trigger else branch
      mockFormatter.formatMultiTarget = undefined;
      mockEntityManager.getEntityInstance.mockImplementation((id) => ({ id }));

      // Legacy formatting fails
      mockFormatter.format.mockReturnValue({
        ok: false,
        error: 'Legacy formatting failed',
      });

      const result = await stage.executeInternal(legacyContextWithMultiTarget);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);

      expect(mockErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Legacy formatting failed',
          actionDef: expect.objectContaining({ id: 'combat:spell' }),
          actorId: 'player',
          targetId: 'fireball',
        })
      );
    });

    it('should exercise #createTargetExtractionResult method branches (lines 805-813)', async () => {
      // Note: This method appears to be unused in current codebase
      // This test is included for complete coverage but the method may be dead code

      // Create a scenario that would theoretically exercise the method if it were called
      // The method processes resolvedTargets with arrays and creates TargetExtractionResult
      const context = {
        actor: { id: 'player' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:action',
              name: 'Test Action',
              template: 'test {item}',
            },
          },
        ],
        resolvedTargets: {
          primary: [{ id: 'item1', displayName: 'Item 1' }],
          secondary: [], // Empty array to test the condition on line 807
          tertiary: [{ id: 'item3', displayName: 'Item 3' }], // Non-empty array
        },
        targetDefinitions: {
          primary: { placeholder: 'item' },
          secondary: { placeholder: 'empty' },
          tertiary: { placeholder: 'item3' },
        },
      };

      mockFormatter.formatMultiTarget.mockReturnValue({
        ok: true,
        value: 'test Item 1',
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);

      // The #createTargetExtractionResult method is not directly accessible for testing
      // It appears to be unused based on code analysis
      // The current test verifies the overall functionality still works correctly
      expect(result.actions[0].params.targetIds).toEqual({
        primary: ['item1'],
        secondary: [], // Empty array is included in the output
        tertiary: ['item3'],
      });
    });
  });
});
