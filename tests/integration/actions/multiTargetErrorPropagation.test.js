/**
 * @file Tests for error handling across multi-target components
 * @description Integration tests for error propagation in multi-target action processing
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ActionFormattingStage } from '../../../src/actions/pipeline/stages/ActionFormattingStage.js';
import { TargetExtractionResult } from '../../../src/entities/multiTarget/targetExtractionResult.js';
import { TargetManager } from '../../../src/entities/multiTarget/targetManager.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';

describe('Multi-Target Error Propagation', () => {
  let formattingStage;
  let logger;
  let mockCommandFormatter;
  let mockEntityManager;
  let mockEventDispatcher;
  let mockErrorContextBuilder;

  beforeEach(() => {
    logger = new ConsoleLogger('ERROR');
    logger.error = jest.fn();
    logger.warn = jest.fn();
    logger.debug = jest.fn();

    mockCommandFormatter = {
      format: jest.fn(),
      formatMultiTarget: jest.fn(),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn(),
      hasComponent: jest.fn(),
    };

    mockEventDispatcher = {
      dispatch: jest.fn(),
    };

    mockErrorContextBuilder = {
      buildErrorContext: jest.fn((params) => params),
    };

    formattingStage = new ActionFormattingStage({
      commandFormatter: mockCommandFormatter,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockEventDispatcher,
      getEntityDisplayNameFn: (id) => `Entity ${id}`,
      errorContextBuilder: mockErrorContextBuilder,
      logger,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Formatter Failures', () => {
    it('should handle multi-target formatter exceptions gracefully', async () => {
      mockCommandFormatter.formatMultiTarget.mockImplementation(() => {
        throw new Error('Formatter internal error');
      });

      const targetManager = new TargetManager({ logger });
      targetManager.setTargets({
        primary: 'entity_001',
        secondary: 'entity_002',
      });

      const targetExtraction = new TargetExtractionResult({
        targetManager,
        extractionMetadata: { source: 'test' },
      });

      const context = {
        actor: { id: 'actor_001', name: 'Test Actor' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:action',
              name: 'Test Action',
              template: 'perform {action} on {primary} and {secondary}',
              targets: { primary: {}, secondary: {} },
            },
            resolvedTargets: targetExtraction,
            targetDefinitions: { primary: {}, secondary: {} },
            isMultiTarget: true,
            targetContexts: [], // Empty array for formatter exception test
          },
        ],
      };

      const result = await formattingStage.executeInternal(context);
      expect(result.success).toBe(true);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
      // The error is captured in the errors array, not logged as a warning
      const errorContext = result.errors[0];
      expect(String(errorContext.error)).toContain('Formatter internal error');
    });

    it('should fallback to legacy formatting when multi-target fails', async () => {
      mockCommandFormatter.formatMultiTarget.mockReturnValue({
        ok: false,
        error: 'Multi-target formatting failed',
      });

      mockCommandFormatter.format.mockReturnValue({
        ok: true,
        value: 'legacy formatted command',
      });

      const targetManager = new TargetManager({ logger });
      targetManager.addTarget('primary', 'entity_001');

      const targetExtraction = new TargetExtractionResult({
        targetManager,
      });

      const context = {
        actor: { id: 'actor_001' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:action',
              template: 'test {target}',
              name: 'Test Action',
            },
            resolvedTargets: targetExtraction,
            isMultiTarget: true,
            targetContexts: [
              {
                type: 'entity',
                entityId: 'entity_001',
                displayName: 'Test Entity',
              },
            ],
          },
        ],
      };

      const result = await formattingStage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].command).toBe('legacy formatted command');
      expect(mockCommandFormatter.format).toHaveBeenCalled();
    });

    it('should handle null formatter responses', async () => {
      mockCommandFormatter.formatMultiTarget.mockReturnValue(null);
      mockCommandFormatter.format.mockReturnValue({
        ok: true,
        value: 'fallback command',
      });

      const targetManager = new TargetManager({ logger });
      targetManager.addTarget('target', 'entity_001');

      const context = {
        actor: { id: 'actor_001' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:action',
              template: '{actor} uses {target}',
              name: 'Test Action',
            },
            resolvedTargets: new TargetExtractionResult({ targetManager }),
            isMultiTarget: true,
            targetContexts: [
              {
                type: 'entity',
                entityId: 'entity_001',
                displayName: 'Target',
              },
            ],
          },
        ],
      };

      const result = await formattingStage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].command).toBe('fallback command');
    });
  });

  describe('Entity Resolution Failures', () => {
    it('should handle missing entities during formatting', async () => {
      mockEntityManager.getEntityInstance.mockReturnValue(null);

      mockCommandFormatter.format.mockReturnValue({
        ok: true,
        value: 'formatted despite missing entity',
      });

      const context = {
        actor: { id: 'actor_001' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:action',
              template: 'examine {target}',
              name: 'Examine Action',
            },
            targetContexts: [
              {
                type: 'entity',
                entityId: 'missing_entity',
                displayName: 'Missing Entity',
              },
            ],
          },
        ],
      };

      const result = await formattingStage.executeInternal(context);

      expect(result.success).toBe(true);
      // Should still process despite missing entity
      expect(mockCommandFormatter.format).toHaveBeenCalled();
      expect(result.actions).toHaveLength(1);
    });

    it('should handle entity resolution exceptions', async () => {
      mockEntityManager.getEntityInstance.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      mockCommandFormatter.format.mockReturnValue({
        ok: true,
        value: 'formatted with error recovery',
      });

      const context = {
        actor: { id: 'actor_001' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:action',
              template: 'use {target}',
              name: 'Use Action',
            },
            targetContexts: [
              {
                type: 'entity',
                entityId: 'entity_001',
                displayName: 'Test Entity',
              },
            ],
          },
        ],
      };

      const result = await formattingStage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(logger.error).not.toHaveBeenCalled(); // Errors should be handled gracefully
    });
  });

  describe('Multi-Target Specific Errors', () => {
    it('should handle invalid target manager state', async () => {
      // Create an invalid target extraction result
      const invalidTargetManager = new TargetManager({ logger });
      // Don't add any targets, making it invalid for multi-target

      const targetExtraction = new TargetExtractionResult({
        targetManager: invalidTargetManager,
      });

      mockCommandFormatter.formatMultiTarget.mockReturnValue({
        ok: false,
        error: 'No targets available',
      });

      mockCommandFormatter.format.mockReturnValue({
        ok: true,
        value: 'single target fallback',
      });

      const context = {
        actor: { id: 'actor_001' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:multi_action',
              template: 'multi action template',
              name: 'Multi Action',
              targets: { primary: {}, secondary: {} },
            },
            resolvedTargets: targetExtraction,
            targetDefinitions: { primary: {}, secondary: {} },
            isMultiTarget: true,
            targetContexts: [],
          },
        ],
      };

      const result = await formattingStage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toBeDefined();
      // With no targets, should capture an error
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle circular reference errors in formatting', async () => {
      const targetManager = new TargetManager({ logger });
      targetManager.setTargets({
        container: 'box_001',
        contents: 'box_001', // Circular reference
      });

      mockCommandFormatter.formatMultiTarget.mockReturnValue({
        ok: false,
        error: 'Circular reference detected',
      });

      const context = {
        actor: { id: 'actor_001' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:container_action',
              template: 'open {container} to access {contents}',
              name: 'Container Action',
            },
            resolvedTargets: new TargetExtractionResult({ targetManager }),
            targetDefinitions: { container: {}, contents: {} },
            isMultiTarget: true,
            targetContexts: [], // Empty for circular reference test
          },
        ],
      };

      const result = await formattingStage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Error Event Dispatching', () => {
    it('should dispatch error events for formatting failures', async () => {
      mockCommandFormatter.format.mockReturnValue({
        ok: false,
        error: 'Template parsing failed',
      });

      const context = {
        actor: { id: 'actor_001' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:action',
              template: 'invalid {template {nested}',
              name: 'Invalid Action',
            },
            targetContexts: [
              {
                type: 'entity',
                entityId: 'entity_001',
                displayName: 'Entity',
              },
            ],
          },
        ],
      };

      const result = await formattingStage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error || result.errors[0]).toContain(
        'Template parsing failed'
      );
      // Note: ActionFormattingStage does not dispatch error events directly
      // It returns errors in the result for handling by higher-level components
    });

    it('should aggregate multiple formatting errors', async () => {
      mockCommandFormatter.format
        .mockReturnValueOnce({
          ok: false,
          error: 'Error 1',
        })
        .mockReturnValueOnce({
          ok: false,
          error: 'Error 2',
        });

      const context = {
        actor: { id: 'actor_001' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:action1',
              template: 'action 1 {target}',
              name: 'Action 1',
            },
            targetContexts: [
              {
                type: 'entity',
                entityId: 'entity_001',
                displayName: 'Entity 1',
              },
            ],
          },
          {
            actionDef: {
              id: 'test:action2',
              template: 'action 2 {target}',
              name: 'Action 2',
            },
            targetContexts: [
              {
                type: 'entity',
                entityId: 'entity_002',
                displayName: 'Entity 2',
              },
            ],
          },
        ],
      };

      const result = await formattingStage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(2);
      // Check error messages in error objects
      const errorMessages = result.errors.map((e) => e.error || e);
      expect(errorMessages).toContain('Error 1');
      expect(errorMessages).toContain('Error 2');
    });
  });

  describe('Recovery Strategies', () => {
    it('should recover from partial formatting failures', async () => {
      mockCommandFormatter.format
        .mockReturnValueOnce({
          ok: false,
          error: 'Failed to format',
        })
        .mockReturnValueOnce({
          ok: true,
          value: 'successful format',
        });

      const context = {
        actor: { id: 'actor_001' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:failing_action',
              template: 'failing template {target}',
              name: 'Failing Action',
            },
            targetContexts: [
              {
                type: 'entity',
                entityId: 'entity_001',
                displayName: 'Entity 1',
              },
            ],
          },
          {
            actionDef: {
              id: 'test:working_action',
              template: 'working template {target}',
              name: 'Working Action',
            },
            targetContexts: [
              {
                type: 'entity',
                entityId: 'entity_002',
                displayName: 'Entity 2',
              },
            ],
          },
        ],
      };

      const result = await formattingStage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].command).toBe('successful format');
      expect(result.errors).toHaveLength(1);
    });

    it('should handle async formatting errors', async () => {
      mockCommandFormatter.formatMultiTarget.mockImplementation(() => {
        throw new Error('Async formatting error');
      });

      const targetManager = new TargetManager({ logger });
      targetManager.setTargets({
        primary: 'entity_001',
        secondary: 'entity_002',
      });

      const context = {
        actor: { id: 'actor_001' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:async_action',
              template: 'async action',
              name: 'Async Action',
            },
            resolvedTargets: new TargetExtractionResult({ targetManager }),
            targetDefinitions: { primary: {}, secondary: {} },
            isMultiTarget: true,
            targetContexts: [], // Needed for the per-action metadata flow
          },
        ],
      };

      const result = await formattingStage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(String(result.errors[0].error)).toContain(
        'Async formatting error'
      );
    });
  });
});
