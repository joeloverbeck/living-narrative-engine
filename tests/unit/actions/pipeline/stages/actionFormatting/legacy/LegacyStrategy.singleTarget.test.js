/**
 * @file Unit tests for LegacyStrategy single-target formatting methods
 * Tests single-target formatting logic through the public format() API
 */

import { describe, it, expect } from '@jest/globals';
import { LegacyStrategy } from '../../../../../../../src/actions/pipeline/stages/actionFormatting/legacy/LegacyStrategy.js';

const createStrategy = (overrides = {}) => {
  const commandFormatter = {
    format: jest.fn(),
    formatMultiTarget: jest.fn(),
  };

  const fallbackFormatter = {
    formatWithFallback: jest.fn(),
  };

  const logger = {
    debug: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
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

  const finalDeps = { ...dependencies, ...overrides };

  const strategy = new LegacyStrategy(finalDeps);

  return {
    strategy,
    commandFormatter: finalDeps.commandFormatter,
    fallbackFormatter: finalDeps.fallbackFormatter,
    logger: finalDeps.logger,
    targetNormalizationService: finalDeps.targetNormalizationService,
    createError: finalDeps.createError,
    validateVisualProperties: finalDeps.validateVisualProperties,
    entityManager: finalDeps.entityManager,
  };
};

describe('LegacyStrategy - Single Target Formatting', () => {
  describe('Successful formatting', () => {
    it('should successfully format a single target', async () => {
      // Arrange
      const { strategy, commandFormatter, validateVisualProperties } =
        createStrategy();
      commandFormatter.format.mockReturnValue({
        ok: true,
        value: 'attack target',
      });

      // Act
      const outcome = await strategy.format({
        actor: { id: 'actor-1' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:action',
              name: 'Test Action',
              description: 'A test action',
            },
            targetContexts: [{ entityId: 'target1', displayName: 'Target 1' }],
          },
        ],
        traceSource: 'test',
      });

      // Assert
      expect(validateVisualProperties).toHaveBeenCalled();
      expect(commandFormatter.format).toHaveBeenCalled();
      expect(outcome.formattedCommands.length).toBe(1);
      expect(outcome.formattedCommands[0]).toEqual({
        id: 'test:action',
        name: 'Test Action',
        command: 'attack target',
        description: 'A test action',
        params: { targetId: 'target1' },
        visual: null,
      });
      expect(outcome.errors.length).toBe(0);
    });

    it('should successfully format multiple targets', async () => {
      // Arrange
      const { strategy, commandFormatter } = createStrategy();
      commandFormatter.format.mockReturnValue({
        ok: true,
        value: 'attack target',
      });

      // Act
      const outcome = await strategy.format({
        actor: { id: 'actor-1' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:action',
              name: 'Test Action',
              description: 'A test action',
            },
            targetContexts: [
              { entityId: 'target1', displayName: 'Target 1' },
              { entityId: 'target2', displayName: 'Target 2' },
              { entityId: 'target3', displayName: 'Target 3' },
            ],
          },
        ],
        traceSource: 'test',
      });

      // Assert
      expect(commandFormatter.format).toHaveBeenCalledTimes(3);
      expect(outcome.formattedCommands.length).toBe(3);
      expect(outcome.errors.length).toBe(0);
    });
  });

  describe('Error handling', () => {
    it('should handle format failure (formatResult.ok = false)', async () => {
      // Arrange
      const { strategy, commandFormatter, createError } = createStrategy();
      commandFormatter.format.mockReturnValue({
        ok: false,
        error: 'Format failed',
      });

      // Act
      const outcome = await strategy.format({
        actor: { id: 'actor-1' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:action',
              name: 'Test Action',
            },
            targetContexts: [{ entityId: 'target1', displayName: 'Target 1' }],
          },
        ],
        traceSource: 'test',
      });

      // Assert
      expect(outcome.formattedCommands.length).toBe(0);
      expect(outcome.errors.length).toBe(1);
      expect(createError).toHaveBeenCalledWith(
        { ok: false, error: 'Format failed' },
        expect.objectContaining({ id: 'test:action' }),
        'actor-1',
        null, // Standard mode passes null for trace
        'target1'
      );
    });

    it('should handle exception during formatting', async () => {
      // Arrange
      const { strategy, commandFormatter, logger, createError } =
        createStrategy();
      commandFormatter.format.mockImplementation(() => {
        throw new Error('Formatting exception');
      });

      // Act
      const outcome = await strategy.format({
        actor: { id: 'actor-1' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:action',
              name: 'Test Action',
            },
            targetContexts: [{ entityId: 'target1', displayName: 'Target 1' }],
          },
        ],
        trace: undefined,
        traceSource: 'test',
      });

      // Assert
      expect(outcome.formattedCommands.length).toBe(0);
      expect(outcome.errors.length).toBe(1);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to format command for action \'test:action\''),
        expect.objectContaining({ error: expect.any(Error) })
      );
      expect(createError).toHaveBeenCalled();
    });

    it('prefers entityId on thrown errors when no nested target is available', async () => {
      const { strategy, commandFormatter, logger, createError } =
        createStrategy();
      commandFormatter.format.mockImplementation(() => {
        const error = new Error('format exploded');
        error.entityId = 'entity-from-error';
        throw error;
      });

      await strategy.format({
        actor: { id: 'actor-1' },
        actionsWithTargets: [
          {
            actionDef: { id: 'test:action', name: 'Test Action' },
            targetContexts: [{ entityId: 'target1', displayName: 'Target 1' }],
          },
        ],
        traceSource: 'test',
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("target 'entity-from-error'"),
        expect.objectContaining({ error: expect.any(Error) })
      );
      expect(createError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ id: 'test:action' }),
        'actor-1',
        null,
        null,
        'target1'
      );
    });

    it('falls back to the target context id when thrown errors lack identifiers', async () => {
      const { strategy, commandFormatter, logger, createError } =
        createStrategy();
      commandFormatter.format.mockImplementation(() => {
        throw new Error('format exploded');
      });

      await strategy.format({
        actor: { id: 'actor-1' },
        actionsWithTargets: [
          {
            actionDef: { id: 'test:action', name: 'Test Action' },
            targetContexts: [{ entityId: 'target1', displayName: 'Target 1' }],
          },
        ],
        traceSource: 'test',
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("target 'target1'"),
        expect.objectContaining({ error: expect.any(Error) })
      );
      expect(createError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ id: 'test:action' }),
        'actor-1',
        null,
        null,
        'target1'
      );
    });

    it('should handle mixed success/failure scenarios', async () => {
      // Arrange
      const { strategy, commandFormatter } = createStrategy();
      commandFormatter.format
        .mockReturnValueOnce({ ok: true, value: 'command 1' })
        .mockReturnValueOnce({ ok: false, error: 'failed' })
        .mockReturnValueOnce({ ok: true, value: 'command 3' });

      // Act
      const outcome = await strategy.format({
        actor: { id: 'actor-1' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:action',
              name: 'Test Action',
            },
            targetContexts: [
              { entityId: 'target1', displayName: 'Target 1' },
              { entityId: 'target2', displayName: 'Target 2' },
              { entityId: 'target3', displayName: 'Target 3' },
            ],
          },
        ],
        traceSource: 'test',
      });

      // Assert
      expect(outcome.formattedCommands.length).toBe(2);
      expect(outcome.errors.length).toBe(1);
    });
  });

  describe('Trace handling', () => {
    it('should pass trace to createError when provided', async () => {
      // Arrange
      const { strategy, commandFormatter, createError } = createStrategy();
      commandFormatter.format.mockReturnValue({
        ok: false,
        error: 'Format failed',
      });
      const mockTrace = { captureActionData: jest.fn(), info: jest.fn() };

      // Act
      await strategy.format({
        actor: { id: 'actor-1' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:action',
              name: 'Test Action',
            },
            targetContexts: [{ entityId: 'target1', displayName: 'Target 1' }],
          },
        ],
        trace: mockTrace,
        processingStats: {},
        traceSource: 'test',
      });

      // Assert
      expect(createError).toHaveBeenCalledWith(
        { ok: false, error: 'Format failed' },
        expect.objectContaining({ id: 'test:action' }),
        'actor-1',
        mockTrace,
        'target1'
      );
    });
  });

  describe('Statistics tracking', () => {
    it('should track statistics when processingStats provided in traced mode', async () => {
      // Arrange
      const { strategy, commandFormatter } = createStrategy();
      commandFormatter.format.mockReturnValue({
        ok: true,
        value: 'command',
      });
      const processingStats = {};
      const mockTrace = { captureActionData: jest.fn(), info: jest.fn() };

      // Act
      await strategy.format({
        actor: { id: 'actor-1' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:action',
              name: 'Test Action',
            },
            targetContexts: [{ entityId: 'target1', displayName: 'Target 1' }],
          },
        ],
        trace: mockTrace,
        processingStats,
        traceSource: 'test',
      });

      // Assert
      expect(processingStats.successful).toBe(1);
      expect(processingStats.legacy).toBe(1);
    });

    it('should not track statistics when processingStats is undefined in standard mode', async () => {
      // Arrange
      const { strategy, commandFormatter } = createStrategy();
      commandFormatter.format.mockReturnValue({
        ok: true,
        value: 'command',
      });

      // Act
      const outcome = await strategy.format({
        actor: { id: 'actor-1' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:action',
              name: 'Test Action',
            },
            targetContexts: [{ entityId: 'target1', displayName: 'Target 1' }],
          },
        ],
        trace: undefined,
        traceSource: 'test',
      });

      // Assert - should not throw error when processingStats is undefined
      expect(outcome.formattedCommands.length).toBe(1);
      expect(outcome.errors.length).toBe(0);
    });

    it('should track failure statistics when provided', async () => {
      // Arrange
      const { strategy, commandFormatter } = createStrategy();
      commandFormatter.format.mockReturnValue({
        ok: false,
        error: 'failed',
      });
      const processingStats = {};
      const mockTrace = { captureActionData: jest.fn(), info: jest.fn() };

      // Act
      await strategy.format({
        actor: { id: 'actor-1' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:action',
              name: 'Test Action',
            },
            targetContexts: [{ entityId: 'target1', displayName: 'Target 1' }],
          },
        ],
        trace: mockTrace,
        processingStats,
        traceSource: 'test',
      });

      // Assert
      expect(processingStats.failed).toBe(1);
      expect(processingStats.successful).toBeUndefined();
    });

    it('does not increment statistics when no targets are available to format', async () => {
      const { strategy, commandFormatter } = createStrategy();
      commandFormatter.format.mockReturnValue({ ok: true, value: 'command' });

      const processingStats = { successful: 0, legacy: 0, failed: 0 };
      const mockTrace = { captureActionData: jest.fn(), info: jest.fn() };

      const outcome = await strategy.format({
        actor: { id: 'actor-1' },
        actionsWithTargets: [
          {
            actionDef: { id: 'test:action', name: 'Test Action' },
            targetContexts: [],
          },
        ],
        trace: mockTrace,
        processingStats,
        traceSource: 'test',
      });

      expect(outcome.formattedCommands).toEqual([]);
      expect(outcome.errors).toEqual([]);
      expect(processingStats).toEqual({ successful: 0, legacy: 0, failed: 0 });
    });
  });
});
