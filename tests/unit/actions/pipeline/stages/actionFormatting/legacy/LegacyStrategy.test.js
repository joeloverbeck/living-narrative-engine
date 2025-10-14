import { LegacyStrategy } from '../../../../../../../src/actions/pipeline/stages/actionFormatting/legacy/LegacyStrategy.js';

describe('LegacyStrategy', () => {
  let commandFormatter;
  let fallbackFormatter;
  let logger;
  let extractTargetIds;
  let createError;
  let validateVisualProperties;
  let safeEventDispatcher;
  let strategy;

  beforeEach(() => {
    commandFormatter = {
      format: jest.fn(),
      formatMultiTarget: jest.fn(),
    };

    fallbackFormatter = {
      formatWithFallback: jest.fn(),
    };

    logger = {
      debug: jest.fn(),
      warn: jest.fn(),
    };

    extractTargetIds = jest.fn(() => ({ primary: ['target-1'] }));
    createError = jest.fn((payload) => ({ error: payload }));
    validateVisualProperties = jest.fn();
    safeEventDispatcher = {};

    strategy = new LegacyStrategy({
      commandFormatter,
      entityManager: { getEntityInstance: jest.fn(() => ({ id: 'entity-1' })) },
      safeEventDispatcher,
      getEntityDisplayNameFn: jest.fn(),
      logger,
      fallbackFormatter,
      createError,
      extractTargetIds,
      validateVisualProperties,
    });
  });

  it('formats single-target actions without invoking fallback', async () => {
    commandFormatter.format.mockReturnValue({
      ok: true,
      value: 'attack target',
    });

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

    expect(validateVisualProperties).toHaveBeenCalledWith(
      undefined,
      'action-1'
    );
    expect(commandFormatter.format).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'action-1' }),
      { entityId: 'target-1', displayName: 'Enemy' },
      expect.anything(),
      expect.objectContaining({
        logger,
        debug: true,
        safeEventDispatcher,
      }),
      { displayNameFn: expect.any(Function) }
    );
    expect(outcome.formattedCommands).toEqual([
      expect.objectContaining({
        id: 'action-1',
        command: 'attack target',
        params: { targetId: 'target-1' },
      }),
    ]);
    expect(outcome.fallbackUsed).toBe(false);
    expect(outcome.pipelineResult.success).toBe(true);
    expect(fallbackFormatter.formatWithFallback).not.toHaveBeenCalled();
  });

  it('falls back to legacy formatting when multi-target formatting fails and records trace events', async () => {
    commandFormatter.formatMultiTarget.mockReturnValue({
      ok: false,
      error: 'format failed',
    });
    fallbackFormatter.formatWithFallback.mockReturnValue({
      ok: true,
      value: 'fallback command',
    });

    const trace = {
      captureActionData: jest.fn(),
      info: jest.fn(),
    };

    const processingStats = {
      successful: 0,
      failed: 0,
      legacy: 0,
      multiTarget: 0,
    };

    const outcome = await strategy.format({
      actor: { id: 'actor-2' },
      actionsWithTargets: [
        {
          actionDef: {
            id: 'action-2',
            name: 'Charm',
            targets: {
              primary: { placeholder: 'primary' },
            },
            description: '',
          },
          targetContexts: [
            {
              entityId: 'target-2',
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
        actionDefinition: expect.objectContaining({ id: 'action-2' }),
        targetContext: expect.objectContaining({ entityId: 'target-2' }),
        targetDefinitions: expect.any(Object),
      })
    );
    expect(processingStats.successful).toBe(1);
    expect(processingStats.legacy).toBe(1);
    expect(processingStats.failed).toBe(0);
    expect(outcome.fallbackUsed).toBe(true);
    expect(trace.captureActionData).toHaveBeenCalledWith(
      'formatting',
      'action-2',
      expect.objectContaining({ status: 'formatting' })
    );
    expect(trace.info).toHaveBeenCalledWith(
      expect.stringContaining('formatted actions'),
      'ActionFormattingStage.execute'
    );
    expect(outcome.formattedCommands[0]).toEqual(
      expect.objectContaining({ command: 'fallback command' })
    );
  });

  it('propagates formatter errors through the provided factory', async () => {
    commandFormatter.format.mockReturnValue({ ok: false, error: 'bad target' });

    const outcome = await strategy.format({
      actor: { id: 'actor-3' },
      actionsWithTargets: [
        {
          actionDef: { id: 'action-3', name: 'Greet' },
          targetContexts: [{ entityId: 'target-3', displayName: 'Friend' }],
        },
      ],
      trace: undefined,
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(createError).toHaveBeenCalledWith(
      { ok: false, error: 'bad target' },
      expect.objectContaining({ id: 'action-3' }),
      'actor-3',
      undefined,
      'target-3'
    );
    expect(outcome.errors).toEqual([
      { error: { ok: false, error: 'bad target' } },
    ]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to format command'),
      expect.objectContaining({ actionDef: expect.any(Object) })
    );
  });
});
