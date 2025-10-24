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

describe('LegacyStrategy', () => {
  describe('single target formatting', () => {
    it('formats actions without fallback and emits summary logging', async () => {
      const {
        strategy,
        commandFormatter,
        validateVisualProperties,
        logger,
      } = createStrategy();

      commandFormatter.format.mockReturnValue({ ok: true, value: 'attack target' });

      const outcome = await strategy.format({
        actor: { id: 'actor-1' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'action-1',
              name: 'Attack',
              description: 'desc',
            },
            targetContexts: [{ entityId: 'target-1', displayName: 'Enemy' }],
          },
        ],
        trace: undefined,
        traceSource: 'ActionFormattingStage.execute',
      });

      expect(validateVisualProperties).toHaveBeenCalledWith(undefined, 'action-1');
      expect(commandFormatter.format).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'action-1' }),
        { entityId: 'target-1', displayName: 'Enemy' },
        expect.any(Object),
        expect.objectContaining({ debug: true }),
        { displayNameFn: expect.any(Function) }
      );
      expect(outcome.formattedCommands).toEqual([
        expect.objectContaining({
          id: 'action-1',
          name: 'Attack',
          command: 'attack target',
          params: { targetId: 'target-1' },
        }),
      ]);
      expect(outcome.fallbackUsed).toBe(false);
      expect(logger.debug).toHaveBeenCalledWith(
        'Action formatting complete: 1 actions formatted successfully'
      );
    });

    it('records failures, increments stats, and reports trace information', async () => {
      const {
        strategy,
        commandFormatter,
        logger,
        createError,
      } = createStrategy();

      commandFormatter.format
        .mockReturnValueOnce({ ok: true, value: 'cmd-1' })
        .mockReturnValueOnce({ ok: false, error: 'bad-target' });

      const trace = {
        captureActionData: jest.fn(),
        info: jest.fn(),
      };

      const processingStats = {
        successful: 'not-a-number',
        failed: 'not-a-number',
        legacy: 'not-a-number',
        multiTarget: 0,
      };

      const outcome = await strategy.format({
        actor: { id: 'actor-2' },
        actionsWithTargets: [
          {
            actionDef: { id: 'action-single', name: 'Poke' },
            targetContexts: [
              { entityId: 'target-a', displayName: 'Friend' },
              { entityId: 'target-b', displayName: 'Enemy' },
            ],
          },
        ],
        trace,
        processingStats,
        traceSource: 'ActionFormattingStage.execute',
      });

      expect(logger.warn).toHaveBeenCalledWith(
        "Failed to format command for action 'action-single' with target 'target-b'",
        expect.objectContaining({
          formatResult: { ok: false, error: 'bad-target' },
        })
      );
      expect(createError).toHaveBeenCalledWith(
        { ok: false, error: 'bad-target' },
        expect.objectContaining({ id: 'action-single' }),
        'actor-2',
        trace,
        'target-b'
      );
      expect(processingStats).toEqual({
        successful: 1,
        failed: 1,
        legacy: 1,
        multiTarget: 0,
      });
      expect(trace.captureActionData).toHaveBeenLastCalledWith(
        'formatting',
        'action-single',
        expect.objectContaining({
          status: 'partial',
          successCount: 1,
          failureCount: 1,
          formatterMethod: 'format',
        })
      );
      expect(outcome.errors).toHaveLength(1);
      expect(outcome.pipelineResult.success).toBe(true);
    });

    it('captures thrown formatter errors with fallback target resolution', async () => {
      const { strategy, commandFormatter, createError } = createStrategy();

      commandFormatter.format.mockImplementation(() => {
        throw { target: { entityId: 'embedded' } };
      });

      await strategy.format({
        actor: { id: 'actor-throw' },
        actionsWithTargets: [
          {
            actionDef: { id: 'action-throw', name: 'Yell' },
            targetContexts: [{ entityId: 'target-throw' }],
          },
        ],
        trace: undefined,
        traceSource: 'ActionFormattingStage.execute',
      });

      expect(createError).toHaveBeenCalledWith(
        { target: { entityId: 'embedded' } },
        expect.objectContaining({ id: 'action-throw' }),
        'actor-throw',
        undefined,
        null,
        'target-throw'
      );
    });
  });

  describe('multi-target formatting', () => {
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
        trace: { captureActionData: jest.fn(), info: jest.fn() },
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
    });

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
        trace: undefined,
        processingStats,
        traceSource: 'ActionFormattingStage.execute',
      });

      expect(createError).toHaveBeenCalledWith(
        { ok: false, error: 'fallback failure' },
        expect.objectContaining({ id: 'multi-failure' }),
        'actor-fallback-fail',
        undefined,
        'target-error'
      );
      expect(outcome.errors).toHaveLength(1);
      expect(outcome.fallbackUsed).toBe(false);
    });

    it('logs when no resolved targets are available', async () => {
      const { strategy, logger, commandFormatter, fallbackFormatter } =
        createStrategy();

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
        trace: undefined,
        traceSource: 'ActionFormattingStage.execute',
      });

      expect(logger.warn).toHaveBeenCalledWith(
        "Skipping multi-target action 'multi-empty' in legacy formatting path - no resolved targets available for proper formatting"
      );
      expect(commandFormatter.formatMultiTarget).not.toHaveBeenCalled();
      expect(fallbackFormatter.formatWithFallback).not.toHaveBeenCalled();
    });

    it('indicates missing required targets via debug logging', async () => {
      const { strategy, logger, commandFormatter } = createStrategy();

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
        trace: undefined,
        traceSource: 'ActionFormattingStage.execute',
      });

      expect(logger.debug).toHaveBeenCalledWith(
        "Missing required target 'primary' for action 'multi-missing'"
      );
      expect(logger.warn).toHaveBeenCalledWith(
        "Skipping multi-target action 'multi-missing' in legacy formatting path - no resolved targets available for proper formatting"
      );
      expect(commandFormatter.formatMultiTarget).not.toHaveBeenCalled();
    });
  });
});
