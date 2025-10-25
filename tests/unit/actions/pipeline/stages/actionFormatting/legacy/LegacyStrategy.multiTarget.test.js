/**
 * @file Unit tests for LegacyStrategy multi-target formatting methods
 * Tests multi-target formatting logic through the public format() API
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

describe('LegacyStrategy - Multi-Target Formatting', () => {
  describe('Traced Mode - Successful formatting', () => {
    it('formats multiple commands when normalization succeeds', async () => {
      const {
        strategy,
        commandFormatter,
        targetNormalizationService,
        entityManager,
      } = createStrategy();

      commandFormatter.formatMultiTarget.mockReturnValue({
        ok: true,
        value: [
          {
            command: 'multi-command-1',
            targets: {
              primary: [
                { id: 'target-a', displayName: 'Target A', contextFromId: 'ctx-1' },
              ],
            },
          },
          'string-command',
        ],
      });

      targetNormalizationService.normalize
        .mockReturnValueOnce({ error: null, params: { index: 0 } })
        .mockReturnValueOnce({ error: null, params: { index: 1 } });

      const trace = {
        captureActionData: jest.fn(),
        info: jest.fn(),
      };

      const processingStats = {
        successful: 'NaN',
        multiTarget: 'NaN',
      };

      const outcome = await strategy.format({
        actor: { id: 'actor-multi' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'multi-action',
              name: 'Coordinate',
              description: 'desc',
              visual: { icon: 'multi' },
              targets: {
                primary: { placeholder: 'primary' },
              },
            },
            targetContexts: [
              {
                entityId: 'target-a',
                displayName: 'Target A',
                placeholder: 'primary',
                contextFromId: 'ctx-1',
              },
            ],
          },
        ],
        trace,
        processingStats,
        traceSource: 'ActionFormattingStage.execute',
      });

      expect(commandFormatter.formatMultiTarget).toHaveBeenCalledTimes(1);
      expect(commandFormatter.formatMultiTarget.mock.calls[0][1]).toEqual({
        primary: [
          {
            id: 'target-a',
            displayName: 'Target A',
            entity: { id: 'target-a', managed: true },
            contextFromId: 'ctx-1',
          },
        ],
      });
      expect(entityManager.getEntityInstance).toHaveBeenCalledWith('target-a');
      expect(outcome.formattedCommands).toEqual([
        expect.objectContaining({
          id: 'multi-action',
          command: 'multi-command-1',
          params: { index: 0, isMultiTarget: true },
          visual: { icon: 'multi' },
        }),
        expect.objectContaining({
          id: 'multi-action',
          command: 'string-command',
          params: { index: 1, isMultiTarget: true },
        }),
      ]);
      expect(processingStats).toEqual({ successful: 1, multiTarget: 1 });
      expect(trace.captureActionData).toHaveBeenCalledWith(
        'formatting',
        'multi-action',
        expect.objectContaining({ formattingPath: 'legacy' })
      );
      expect(outcome.fallbackUsed).toBe(false);
    });

    it('normalizes contexts without placeholders and groups repeated placeholders', async () => {
      const { strategy, commandFormatter, fallbackFormatter } = createStrategy();

      commandFormatter.formatMultiTarget.mockReturnValue({
        ok: false,
        error: 'format failed',
      });
      fallbackFormatter.formatWithFallback.mockReturnValue({
        ok: true,
        value: 'fallback command',
      });

      await strategy.format({
        actor: { id: 'actor-multi' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'multi-action',
              name: 'Coordinate',
              targets: {
                primary: { placeholder: 'primary' },
                secondary: { placeholder: 'secondary' },
              },
            },
            targetContexts: [
              {
                entityId: 'target-a',
                displayName: undefined,
                contextFromId: 'ctx-1',
              },
              {
                entityId: 'target-b',
                displayName: 'Target B',
                placeholder: 'primary',
                contextFromId: 'ctx-2',
              },
              {
                entityId: 'target-c',
                displayName: 'Target C',
                placeholder: 'secondary',
                contextFromId: 'ctx-3',
              },
            ],
          },
        ],
        trace: undefined,
        traceSource: 'ActionFormattingStage.execute',
      });

      const [, extractedTargets] = commandFormatter.formatMultiTarget.mock.calls[0];
      expect(extractedTargets.primary).toHaveLength(2);
      expect(extractedTargets.primary.map((entry) => entry.id)).toEqual([
        'target-a',
        'target-b',
      ]);
      expect(extractedTargets.primary[0].displayName).toBe('target-a');
      expect(extractedTargets.secondary).toHaveLength(1);
    });

    it('uses fallback when formatter fails and marks statistics', async () => {
      const {
        strategy,
        commandFormatter,
        fallbackFormatter,
      } = createStrategy();

      commandFormatter.formatMultiTarget.mockReturnValue({
        ok: false,
        error: 'format failed',
      });
      fallbackFormatter.formatWithFallback.mockReturnValue({
        ok: true,
        value: 'fallback command',
      });

      const processingStats = {
        successful: 0,
        legacy: 0,
        failed: 0,
        multiTarget: 0,
      };

      const trace = { captureActionData: jest.fn(), info: jest.fn() };

      const outcome = await strategy.format({
        actor: { id: 'actor-fallback' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'multi-fallback',
              name: 'Fallback',
              targets: { primary: {} },
              description: 'desc',
            },
            targetContexts: [
              {
                entityId: 'target-fallback',
                displayName: 'Target',
                placeholder: 'primary',
              },
            ],
          },
        ],
        trace,
        processingStats,
        traceSource: 'ActionFormattingStage.execute',
      });

      expect(fallbackFormatter.formatWithFallback).toHaveBeenCalledWith(
        expect.objectContaining({
          actionDefinition: expect.objectContaining({ id: 'multi-fallback' }),
          targetContext: expect.objectContaining({ entityId: 'target-fallback' }),
          resolvedTargets: expect.any(Object),
        })
      );
      expect(outcome.fallbackUsed).toBe(true);
      expect(outcome.formattedCommands[0]).toEqual(
        expect.objectContaining({ command: 'fallback command' })
      );
      expect(processingStats).toEqual({
        successful: 1,
        legacy: 1,
        failed: 0,
        multiTarget: 0,
      });
      expect(trace.captureActionData).toHaveBeenCalledWith(
        'formatting',
        'multi-fallback',
        expect.objectContaining({ formattingPath: 'legacy' })
      );
      expect(outcome.statistics.fallbackInvocations).toBe(1);
    });

    it('falls back with empty params when the resolved target lacks an entity id', async () => {
      const {
        strategy,
        commandFormatter,
        fallbackFormatter,
      } = createStrategy();

      commandFormatter.formatMultiTarget.mockReturnValue({
        ok: false,
        error: 'format missing target id',
      });

      fallbackFormatter.formatWithFallback.mockReturnValue({
        ok: true,
        value: 'fallback-without-target',
      });

      const processingStats = { successful: 0, legacy: 0, multiTarget: 0 };

      const trace = { captureActionData: jest.fn(), info: jest.fn() };

      const outcome = await strategy.format({
        actor: { id: 'actor-fallback-no-target' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'multi-fallback-no-target',
              name: 'Fallback Missing Target',
              targets: { primary: {} },
            },
            targetContexts: [
              {
                placeholder: 'primary',
                displayName: 'Anonymous Target',
              },
            ],
          },
        ],
        trace,
        processingStats,
        traceSource: 'ActionFormattingStage.execute',
      });

      expect(outcome.formattedCommands).toEqual([
        expect.objectContaining({
          id: 'multi-fallback-no-target',
          command: 'fallback-without-target',
          params: {},
        }),
      ]);
      expect(processingStats).toEqual({
        successful: 1,
        legacy: 1,
        multiTarget: 0,
      });
      expect(outcome.fallbackUsed).toBe(true);
      expect(trace.captureActionData).toHaveBeenCalledWith(
        'formatting',
        'multi-fallback-no-target',
        expect.objectContaining({ formattingPath: 'legacy' })
      );
    });

    it('executes the traced fallback path end-to-end with realistic dependencies', async () => {
      const formatterCalls = [];
      const fallbackInvocations = [];

      const strategy = new LegacyStrategy({
        commandFormatter: {
          format: () => {
            throw new Error('single-target format should not run');
          },
          formatMultiTarget: (actionDef, resolvedTargets) => {
            formatterCalls.push({ actionDef, resolvedTargets });
            return { ok: false, error: 'traced-failure' };
          },
        },
        entityManager: {
          getEntityInstance: (entityId) => ({ id: entityId, managed: true }),
        },
        safeEventDispatcher: {},
        getEntityDisplayNameFn: () => 'display-name',
        logger: {
          debug: jest.fn(),
          warn: jest.fn(),
          info: jest.fn(),
        },
        fallbackFormatter: {
          formatWithFallback: ({ actionDefinition, targetContext }) => {
            fallbackInvocations.push({ actionDefinition, targetContext });
            return { ok: true, value: 'realistic-fallback' };
          },
        },
        createError: (...args) => ({ args }),
        targetNormalizationService: {
          normalize: () => ({ error: null, params: { normalized: true } }),
        },
        validateVisualProperties: () => {},
      });

      const trace = { captureActionData: jest.fn(), info: jest.fn() };

      const outcome = await strategy.format({
        actor: { id: 'actor-end-to-end' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'multi-end-to-end',
              name: 'End To End',
              description: 'desc',
              targets: { primary: {} },
            },
            targetContexts: [
              {
                entityId: 'target-end-to-end',
                displayName: 'Target End',
                placeholder: 'primary',
              },
            ],
          },
        ],
        trace,
        processingStats: { successful: 0, legacy: 0, multiTarget: 0 },
        traceSource: 'ActionFormattingStage.execute',
      });

      expect(outcome.formattedCommands).toEqual([
        expect.objectContaining({
          id: 'multi-end-to-end',
          command: 'realistic-fallback',
          params: { targetId: 'target-end-to-end' },
        }),
      ]);
      expect(outcome.fallbackUsed).toBe(true);
      expect(formatterCalls).toHaveLength(1);
      expect(fallbackInvocations).toHaveLength(1);
      expect(trace.captureActionData).toHaveBeenCalledWith(
        'formatting',
        'multi-end-to-end',
        expect.objectContaining({ formattingPath: 'legacy' })
      );
    });
  });

  describe('Traced Mode - Error handling', () => {
    it('records normalization errors and skips invalid commands', async () => {
      const {
        strategy,
        commandFormatter,
        targetNormalizationService,
        createError,
      } = createStrategy();

      commandFormatter.formatMultiTarget.mockReturnValue({ ok: true, value: 'cmd' });
      targetNormalizationService.normalize.mockReturnValue({
        error: 'normalize failure',
      });

      const outcome = await strategy.format({
        actor: { id: 'actor-normalize' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'multi-normalize',
              name: 'Normalize',
              targets: { primary: {} },
            },
            targetContexts: [
              { entityId: 'target-x', placeholder: 'primary' },
            ],
          },
        ],
        trace: undefined,
        traceSource: 'ActionFormattingStage.execute',
      });

      expect(createError).toHaveBeenCalledWith(
        'normalize failure',
        expect.objectContaining({ id: 'multi-normalize' }),
        'actor-normalize',
        undefined
      );
      expect(outcome.formattedCommands).toEqual([]);
      expect(outcome.errors).toHaveLength(1);
    });

    it('propagates normalization errors while tracing multi-target actions', async () => {
      const {
        strategy,
        commandFormatter,
        targetNormalizationService,
        createError,
      } = createStrategy();

      commandFormatter.formatMultiTarget.mockReturnValue({
        ok: true,
        value: [
          {
            command: 'cmd-traced',
            targets: {
              primary: [
                {
                  id: 'target-trace',
                  displayName: 'Trace Target',
                  contextFromId: 'ctx-trace',
                },
              ],
            },
          },
        ],
      });

      targetNormalizationService.normalize.mockReturnValue({
        error: 'trace-normalization-failure',
      });

      const trace = {
        captureActionData: jest.fn(),
        info: jest.fn(),
      };

      const outcome = await strategy.format({
        actor: { id: 'actor-trace-normalize' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'multi-trace-normalize',
              name: 'Trace Normalize',
              targets: { primary: {} },
            },
            targetContexts: [
              {
                entityId: 'target-trace',
                placeholder: 'primary',
                contextFromId: 'ctx-trace',
              },
            ],
          },
        ],
        trace,
        traceSource: 'ActionFormattingStage.execute',
      });

      expect(createError).toHaveBeenCalledWith(
        'trace-normalization-failure',
        expect.objectContaining({ id: 'multi-trace-normalize' }),
        'actor-trace-normalize',
        trace
      );
      expect(outcome.errors).toHaveLength(1);
      expect(outcome.formattedCommands).toEqual([]);
    });

    it('surfaces fallback failures through createError', async () => {
      const {
        strategy,
        commandFormatter,
        fallbackFormatter,
        createError,
      } = createStrategy();

      commandFormatter.formatMultiTarget.mockReturnValue({
        ok: false,
        error: 'multi-format-failure',
      });
      fallbackFormatter.formatWithFallback.mockReturnValue({
        ok: false,
        error: 'fallback failure',
      });

      const processingStats = {
        failed: 0,
        successful: 0,
        legacy: 0,
      };

      const trace = { captureActionData: jest.fn(), info: jest.fn() };

      const outcome = await strategy.format({
        actor: { id: 'actor-fallback-fail' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'multi-failure',
              name: 'Failure',
              targets: { primary: {} },
            },
            targetContexts: [
              {
                entityId: 'target-error',
                placeholder: 'primary',
              },
            ],
          },
        ],
        trace,
        processingStats,
        traceSource: 'ActionFormattingStage.execute',
      });

      expect(createError).toHaveBeenCalledWith(
        { ok: false, error: 'fallback failure' },
        expect.objectContaining({ id: 'multi-failure' }),
        'actor-fallback-fail',
        trace,
        'target-error'
      );
      expect(outcome.errors).toHaveLength(1);
      expect(outcome.fallbackUsed).toBe(false);
      expect(trace.captureActionData).toHaveBeenCalledWith(
        'formatting',
        'multi-failure',
        expect.objectContaining({ formattingPath: 'legacy' })
      );
    });

    it('propagates fallback failures without an entity id when tracing multi-target actions', async () => {
      const {
        strategy,
        commandFormatter,
        fallbackFormatter,
        createError,
      } = createStrategy();

      commandFormatter.formatMultiTarget.mockReturnValue({
        ok: false,
        error: 'trace-format-missing-target',
      });

      fallbackFormatter.formatWithFallback.mockReturnValue({
        ok: false,
        error: 'trace-fallback-missing-target',
      });

      const trace = { captureActionData: jest.fn(), info: jest.fn() };

      await strategy.format({
        actor: { id: 'actor-trace-fallback-missing-target' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'multi-trace-fallback-missing-target',
              name: 'Trace Fallback Missing Target',
              targets: { primary: {} },
            },
            targetContexts: [
              {
                placeholder: 'primary',
                displayName: 'Nameless Target',
              },
            ],
          },
        ],
        trace,
        traceSource: 'ActionFormattingStage.execute',
      });

      expect(createError).toHaveBeenCalledWith(
        { ok: false, error: 'trace-fallback-missing-target' },
        expect.objectContaining({
          id: 'multi-trace-fallback-missing-target',
        }),
        'actor-trace-fallback-missing-target',
        trace,
        null
      );
      expect(trace.captureActionData).toHaveBeenCalledWith(
        'formatting',
        'multi-trace-fallback-missing-target',
        expect.objectContaining({ formattingPath: 'legacy' })
      );
    });

    it('propagates fallback failures with tracing enabled', async () => {
      const {
        strategy,
        commandFormatter,
        fallbackFormatter,
        createError,
      } = createStrategy();

      commandFormatter.formatMultiTarget.mockReturnValue({
        ok: false,
        error: 'trace-format-failure',
      });
      fallbackFormatter.formatWithFallback.mockReturnValue({
        ok: false,
        error: 'trace-fallback-failure',
      });

      const trace = {
        captureActionData: jest.fn(),
        info: jest.fn(),
      };

      const outcome = await strategy.format({
        actor: { id: 'actor-trace-fallback' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'multi-trace-fallback',
              name: 'Trace Fallback',
              targets: { primary: {} },
            },
            targetContexts: [
              { entityId: 'target-trace-fallback', placeholder: 'primary' },
            ],
          },
        ],
        trace,
        traceSource: 'ActionFormattingStage.execute',
      });

      expect(createError).toHaveBeenCalledWith(
        { ok: false, error: 'trace-fallback-failure' },
        expect.objectContaining({ id: 'multi-trace-fallback' }),
        'actor-trace-fallback',
        trace,
        'target-trace-fallback'
      );
      expect(outcome.errors).toHaveLength(1);
      expect(outcome.fallbackUsed).toBe(false);
    });
  });

  describe('Traced Mode - Edge cases', () => {
    it('handles formatter absence by delegating entirely to the fallback', async () => {
      const {
        strategy,
        commandFormatter,
        fallbackFormatter,
      } = createStrategy({
        commandFormatter: {
          format: jest.fn(),
          formatMultiTarget: undefined,
        },
      });

      fallbackFormatter.formatWithFallback.mockReturnValue({
        ok: true,
        value: 'legacy-only',
      });

      const outcome = await strategy.format({
        actor: { id: 'actor-only-fallback' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'multi-no-formatter',
              name: 'Legacy',
              targets: { primary: {} },
            },
            targetContexts: [
              {
                entityId: 'target-legacy',
                placeholder: 'primary',
              },
            ],
          },
        ],
        trace: undefined,
        traceSource: 'ActionFormattingStage.execute',
      });

      expect(commandFormatter.formatMultiTarget).toBeUndefined();
      expect(fallbackFormatter.formatWithFallback).toHaveBeenCalled();
      expect(outcome.fallbackUsed).toBe(true);
      expect(outcome.formattedCommands[0]).toEqual(
        expect.objectContaining({ command: 'legacy-only' })
      );
    });

    it('logs when no resolved targets are available', async () => {
      const { strategy, logger, commandFormatter, fallbackFormatter } =
        createStrategy();

      const trace = { captureActionData: jest.fn(), info: jest.fn() };

      await strategy.format({
        actor: { id: 'actor-empty' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'multi-empty',
              name: 'Empty',
              targets: { primary: {} },
            },
            targetContexts: [],
          },
        ],
        trace,
        traceSource: 'ActionFormattingStage.execute',
      });

      expect(logger.warn).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        "Skipping multi-target action 'multi-empty' in legacy formatting path - no resolved targets available for proper formatting"
      );
      expect(commandFormatter.formatMultiTarget).not.toHaveBeenCalled();
      expect(fallbackFormatter.formatWithFallback).not.toHaveBeenCalled();
    });

    it('indicates missing required targets via debug logging', async () => {
      const { strategy, logger, commandFormatter } = createStrategy();

      const trace = { captureActionData: jest.fn(), info: jest.fn() };

      await strategy.format({
        actor: { id: 'actor-missing' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'multi-missing',
              name: 'Missing',
              targets: { primary: { placeholder: 'primary' } },
            },
            targetContexts: [
              {
                entityId: 'target-missing',
                placeholder: 'different',
              },
            ],
          },
        ],
        trace,
        traceSource: 'ActionFormattingStage.execute',
      });

      expect(logger.debug).toHaveBeenCalledWith(
        "Missing required target 'primary' for action 'multi-missing'"
      );
      expect(logger.warn).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        "Skipping multi-target action 'multi-missing' in legacy formatting path - no resolved targets available for proper formatting"
      );
      expect(commandFormatter.formatMultiTarget).not.toHaveBeenCalled();
    });
  });

  describe('Standard Mode - Formatting', () => {
    it('formats multi-target commands on the standard path', async () => {
      const {
        strategy,
        commandFormatter,
        targetNormalizationService,
      } = createStrategy();

      commandFormatter.formatMultiTarget.mockReturnValue({
        ok: true,
        value: [
          'standard-command',
          {
            command: 'standard-object-command',
            targets: {
              primary: [
                {
                  id: 'target-standard',
                  displayName: 'Standard Target',
                  contextFromId: 'ctx-standard',
                },
              ],
            },
          },
        ],
      });

      targetNormalizationService.normalize
        .mockReturnValueOnce({ error: null, params: { idx: 0 } })
        .mockReturnValueOnce({ error: null, params: { idx: 1 } });

      const trace = { info: jest.fn() };

      const outcome = await strategy.format({
        actor: { id: 'actor-standard-success' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'multi-standard-success',
              name: 'Standard Success',
              targets: { primary: {} },
            },
            targetContexts: [
              {
                entityId: 'target-standard',
                placeholder: 'primary',
                contextFromId: 'ctx-standard',
              },
            ],
          },
        ],
        trace,
        traceSource: 'ActionFormattingStage.execute',
      });

      expect(outcome.formattedCommands).toEqual([
        expect.objectContaining({
          id: 'multi-standard-success',
          command: 'standard-command',
          params: { idx: 0, isMultiTarget: true },
        }),
        expect.objectContaining({
          id: 'multi-standard-success',
          command: 'standard-object-command',
          params: { idx: 1, isMultiTarget: true },
        }),
      ]);
    });

    it('falls back successfully on the standard path when formatter fails', async () => {
      const {
        strategy,
        commandFormatter,
        fallbackFormatter,
      } = createStrategy();

      commandFormatter.formatMultiTarget.mockReturnValue({
        ok: false,
        error: 'standard-failure',
      });
      fallbackFormatter.formatWithFallback.mockReturnValue({
        ok: true,
        value: 'standard-fallback',
      });

      const trace = { info: jest.fn() };

      const outcome = await strategy.format({
        actor: { id: 'actor-standard-fallback' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'multi-standard-fallback',
              name: 'Standard Fallback',
              targets: { primary: {} },
            },
            targetContexts: [
              { entityId: 'target-standard-fallback', placeholder: 'primary' },
            ],
          },
        ],
        trace,
        traceSource: 'ActionFormattingStage.execute',
      });

      expect(outcome.formattedCommands[0]).toEqual(
        expect.objectContaining({ command: 'standard-fallback' })
      );
      expect(outcome.fallbackUsed).toBe(true);
    });

    it('surfaces fallback failures on the standard path without formatter support', async () => {
      const {
        strategy,
        fallbackFormatter,
        createError,
      } = createStrategy({
        commandFormatter: {
          format: jest.fn(),
          formatMultiTarget: undefined,
        },
      });

      fallbackFormatter.formatWithFallback.mockReturnValue({
        ok: false,
        error: 'standard-legacy-failure',
      });

      const trace = { info: jest.fn() };

      const outcome = await strategy.format({
        actor: { id: 'actor-standard-legacy' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'multi-standard-legacy',
              name: 'Standard Legacy',
              targets: { primary: {} },
            },
            targetContexts: [
              { entityId: 'target-standard-legacy', placeholder: 'primary' },
            ],
          },
        ],
        trace,
        traceSource: 'ActionFormattingStage.execute',
      });

      expect(createError).toHaveBeenCalledWith(
        { ok: false, error: 'standard-legacy-failure' },
        expect.objectContaining({ id: 'multi-standard-legacy' }),
        'actor-standard-legacy',
        trace,
        'target-standard-legacy'
      );
      expect(outcome.errors).toHaveLength(1);
    });
  });

  describe('#processCommandData - Command Processing Logic', () => {
    it('processes string command data correctly', async () => {
      const { strategy, commandFormatter } = createStrategy();

      commandFormatter.formatMultiTarget.mockReturnValue({
        ok: true,
        value: 'simple-string-command',
      });

      const outcome = await strategy.format({
        actor: { id: 'actor-string' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'multi-string',
              name: 'String Command',
              targets: { primary: {} },
            },
            targetContexts: [
              {
                entityId: 'target-1',
                displayName: 'Target 1',
                placeholder: 'primary',
              },
            ],
          },
        ],
        trace: undefined,
        traceSource: 'ActionFormattingStage.execute',
      });

      expect(outcome.formattedCommands).toHaveLength(1);
      expect(outcome.formattedCommands[0].command).toBe('simple-string-command');
    });

    it('processes object command data with targets property', async () => {
      const { strategy, commandFormatter, targetNormalizationService } =
        createStrategy();

      const specificTargets = {
        primary: [{ id: 'specific-1', displayName: 'Specific Target' }],
      };

      commandFormatter.formatMultiTarget.mockReturnValue({
        ok: true,
        value: {
          command: 'object-with-targets',
          targets: specificTargets,
        },
      });

      targetNormalizationService.normalize.mockReturnValue({
        error: null,
        params: { targetId: 'specific-1' },
      });

      const outcome = await strategy.format({
        actor: { id: 'actor-object-targets' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'multi-object-targets',
              name: 'Object With Targets',
              targets: { primary: {} },
            },
            targetContexts: [
              {
                entityId: 'default-1',
                displayName: 'Default Target',
                placeholder: 'primary',
              },
            ],
          },
        ],
        trace: undefined,
        traceSource: 'ActionFormattingStage.execute',
      });

      expect(outcome.formattedCommands).toHaveLength(1);
      expect(outcome.formattedCommands[0].command).toBe('object-with-targets');
      expect(targetNormalizationService.normalize).toHaveBeenCalledWith({
        resolvedTargets: specificTargets,
        isMultiTarget: true,
      });
    });

    it('processes object command data without targets property', async () => {
      const { strategy, commandFormatter, targetNormalizationService } =
        createStrategy();

      commandFormatter.formatMultiTarget.mockReturnValue({
        ok: true,
        value: {
          command: 'object-without-targets',
        },
      });

      targetNormalizationService.normalize.mockReturnValue({
        error: null,
        params: { targetId: 'default-1' },
      });

      const outcome = await strategy.format({
        actor: { id: 'actor-object-no-targets' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'multi-object-no-targets',
              name: 'Object Without Targets',
              targets: { primary: {} },
            },
            targetContexts: [
              {
                entityId: 'default-1',
                displayName: 'Default Target',
                placeholder: 'primary',
              },
            ],
          },
        ],
        trace: undefined,
        traceSource: 'ActionFormattingStage.execute',
      });

      expect(outcome.formattedCommands).toHaveLength(1);
      expect(outcome.formattedCommands[0].command).toBe('object-without-targets');
      // Should use default targets from actionSpecificTargets
      expect(targetNormalizationService.normalize).toHaveBeenCalledWith({
        resolvedTargets: expect.objectContaining({
          primary: expect.arrayContaining([
            expect.objectContaining({ id: 'default-1' }),
          ]),
        }),
        isMultiTarget: true,
      });
    });

    it('handles mixed array of string and object commands', async () => {
      const { strategy, commandFormatter, targetNormalizationService } =
        createStrategy();

      const specificTargets = {
        primary: [{ id: 'specific-2', displayName: 'Specific 2' }],
      };

      commandFormatter.formatMultiTarget.mockReturnValue({
        ok: true,
        value: [
          'string-command',
          { command: 'object-command', targets: specificTargets },
          { command: 'object-no-targets' },
        ],
      });

      targetNormalizationService.normalize
        .mockReturnValueOnce({ error: null, params: { idx: 0 } })
        .mockReturnValueOnce({ error: null, params: { idx: 1 } })
        .mockReturnValueOnce({ error: null, params: { idx: 2 } });

      const outcome = await strategy.format({
        actor: { id: 'actor-mixed' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'multi-mixed',
              name: 'Mixed Commands',
              targets: { primary: {} },
            },
            targetContexts: [
              {
                entityId: 'default-target',
                displayName: 'Default',
                placeholder: 'primary',
              },
            ],
          },
        ],
        trace: undefined,
        traceSource: 'ActionFormattingStage.execute',
      });

      expect(outcome.formattedCommands).toHaveLength(3);
      expect(outcome.formattedCommands[0].command).toBe('string-command');
      expect(outcome.formattedCommands[1].command).toBe('object-command');
      expect(outcome.formattedCommands[2].command).toBe('object-no-targets');
    });

    it('handles empty targets object in command data', async () => {
      const { strategy, commandFormatter, targetNormalizationService } =
        createStrategy();

      commandFormatter.formatMultiTarget.mockReturnValue({
        ok: true,
        value: {
          command: 'with-empty-targets',
          targets: {},
        },
      });

      targetNormalizationService.normalize.mockReturnValue({
        error: null,
        params: { normalized: true },
      });

      const outcome = await strategy.format({
        actor: { id: 'actor-empty-targets' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'multi-empty-targets',
              name: 'Empty Targets',
              targets: { primary: {} },
            },
            targetContexts: [
              {
                entityId: 'target-empty',
                placeholder: 'primary',
              },
            ],
          },
        ],
        trace: undefined,
        traceSource: 'ActionFormattingStage.execute',
      });

      expect(outcome.formattedCommands).toHaveLength(1);
      expect(outcome.formattedCommands[0].command).toBe('with-empty-targets');
      // Should use the empty targets object from command data
      expect(targetNormalizationService.normalize).toHaveBeenCalledWith({
        resolvedTargets: {},
        isMultiTarget: true,
      });
    });

    it('handles null targets in command data by falling back to defaults', async () => {
      const { strategy, commandFormatter, targetNormalizationService } =
        createStrategy();

      commandFormatter.formatMultiTarget.mockReturnValue({
        ok: true,
        value: {
          command: 'with-null-targets',
          targets: null,
        },
      });

      targetNormalizationService.normalize.mockReturnValue({
        error: null,
        params: { normalized: true },
      });

      const outcome = await strategy.format({
        actor: { id: 'actor-null-targets' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'multi-null-targets',
              name: 'Null Targets',
              targets: { primary: {} },
            },
            targetContexts: [
              {
                entityId: 'target-null',
                displayName: 'Null Target',
                placeholder: 'primary',
              },
            ],
          },
        ],
        trace: undefined,
        traceSource: 'ActionFormattingStage.execute',
      });

      expect(outcome.formattedCommands).toHaveLength(1);
      // Should fall back to actionSpecificTargets since targets is null (not an object)
      expect(targetNormalizationService.normalize).toHaveBeenCalledWith({
        resolvedTargets: expect.objectContaining({
          primary: expect.any(Array),
        }),
        isMultiTarget: true,
      });
    });

    it('processes command with multiple target placeholders', async () => {
      const { strategy, commandFormatter, targetNormalizationService } =
        createStrategy();

      const multiTargets = {
        primary: [{ id: 'primary-1', displayName: 'Primary' }],
        secondary: [{ id: 'secondary-1', displayName: 'Secondary' }],
      };

      commandFormatter.formatMultiTarget.mockReturnValue({
        ok: true,
        value: {
          command: 'multi-placeholder-command',
          targets: multiTargets,
        },
      });

      targetNormalizationService.normalize.mockReturnValue({
        error: null,
        params: { multi: true },
      });

      const outcome = await strategy.format({
        actor: { id: 'actor-multi-placeholder' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'multi-placeholder',
              name: 'Multi Placeholder',
              targets: {
                primary: { placeholder: 'primary' },
                secondary: { placeholder: 'secondary' },
              },
            },
            targetContexts: [
              { entityId: 'primary-1', placeholder: 'primary' },
              { entityId: 'secondary-1', placeholder: 'secondary' },
            ],
          },
        ],
        trace: undefined,
        traceSource: 'ActionFormattingStage.execute',
      });

      expect(outcome.formattedCommands).toHaveLength(1);
      expect(targetNormalizationService.normalize).toHaveBeenCalledWith({
        resolvedTargets: multiTargets,
        isMultiTarget: true,
      });
    });
  });
});
