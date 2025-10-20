import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { LegacyStrategy } from '../../../../src/actions/pipeline/stages/actionFormatting/legacy/LegacyStrategy.js';
import ActionCommandFormatter from '../../../../src/actions/actionFormatter.js';
import { MultiTargetActionFormatter } from '../../../../src/actions/formatters/MultiTargetActionFormatter.js';
import { LegacyFallbackFormatter } from '../../../../src/actions/pipeline/stages/actionFormatting/legacy/LegacyFallbackFormatter.js';
import { TargetNormalizationService } from '../../../../src/actions/pipeline/stages/actionFormatting/TargetNormalizationService.js';
import { getEntityDisplayName } from '../../../../src/utils/entityUtils.js';
import { ENTITY as TARGET_TYPE_ENTITY } from '../../../../src/constants/actionTargetTypes.js';
import { SimpleEntityManager } from '../../../common/entities/index.js';

class RecordingLogger {
  constructor() {
    this.debug = jest.fn();
    this.info = jest.fn();
    this.warn = jest.fn();
    this.error = jest.fn();
  }
}

class RecordingDispatcher {
  constructor() {
    this.calls = [];
  }

  async dispatch(eventId, payload) {
    this.calls.push({ eventId, payload });
    return true;
  }
}

describe('LegacyStrategy integration', () => {
  let entityManager;
  let logger;
  let dispatcher;
  let baseFormatter;
  let commandFormatter;
  let fallbackFormatter;
  let targetNormalizationService;
  let createError;
  let validateVisualProperties;
  let strategy;

  const actorId = 'actor.integration';
  const primaryTargetId = 'target.primary';
  const secondaryTargetId = 'target.secondary';

  beforeEach(() => {
    entityManager = new SimpleEntityManager([
      {
        id: actorId,
        components: {
          'core:name': { text: 'Integration Actor' },
        },
      },
      {
        id: primaryTargetId,
        components: {
          'core:name': { text: 'Primary Friend' },
        },
      },
      {
        id: secondaryTargetId,
        components: {
          'core:name': { text: 'Secondary Ally' },
        },
      },
    ]);

    logger = new RecordingLogger();
    dispatcher = new RecordingDispatcher();
    baseFormatter = new ActionCommandFormatter();
    commandFormatter = new MultiTargetActionFormatter(baseFormatter, logger);
    fallbackFormatter = new LegacyFallbackFormatter({
      commandFormatter,
      entityManager,
      getEntityDisplayNameFn: (entity, fallback) =>
        getEntityDisplayName(entity, fallback, logger),
    });
    targetNormalizationService = new TargetNormalizationService({ logger });

    createError = jest.fn((errorOrResult, actionDef, actor, trace, targetId) => ({
      actionId: actionDef.id,
      actorId: actor,
      targetId: targetId ?? null,
      error: errorOrResult,
    }));
    validateVisualProperties = jest.fn(() => true);

    strategy = new LegacyStrategy({
      commandFormatter,
      entityManager,
      safeEventDispatcher: dispatcher,
      getEntityDisplayNameFn: (entity, fallback) =>
        getEntityDisplayName(entity, fallback, logger),
      logger,
      fallbackFormatter,
      createError,
      targetNormalizationService,
      validateVisualProperties,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const buildSingleTargetAction = () => ({
    id: 'wave-action',
    name: 'Wave',
    description: 'Greet warmly',
    template: 'Wave at {target}',
    visual: { backgroundColor: '#ffeeaa' },
  });

  const buildMultiTargetAction = () => ({
    id: 'salute-action',
    name: 'Salute',
    description: 'Respectfully acknowledge allies',
    template: 'Salute {primary} and {secondary}',
    targets: {
      primary: { placeholder: 'primary' },
      secondary: { placeholder: 'secondary' },
    },
    visual: { hoverTextColor: '#112233' },
  });

  const buildTargetContext = ({
    entityId,
    displayName,
    placeholder = 'primary',
  }) => ({
    entityId,
    displayName,
    placeholder,
    type: TARGET_TYPE_ENTITY,
  });

  it('formats single-target actions without trace using real formatters', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = buildSingleTargetAction();
    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [
            buildTargetContext({
              entityId: primaryTargetId,
              displayName: 'Primary Friend',
              placeholder: 'target',
            }),
          ],
        },
      ],
      trace: { info: jest.fn(), step: jest.fn() },
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(validateVisualProperties).toHaveBeenCalledWith(
      actionDef.visual,
      actionDef.id,
    );
    expect(result.formattedCommands).toEqual([
      expect.objectContaining({
        id: actionDef.id,
        command: 'Wave at Primary Friend',
        params: { targetId: primaryTargetId },
      }),
    ]);
    expect(result.fallbackUsed).toBe(false);
    expect(result.errors).toEqual([]);
    expect(result.pipelineResult.success).toBe(true);
    expect(createError).not.toHaveBeenCalled();
  });

  it('falls back to legacy formatting when multi-target formatting fails', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = buildMultiTargetAction();

    const multiTargetSpy = jest
      .spyOn(commandFormatter, 'formatMultiTarget')
      .mockReturnValue({ ok: false, error: 'formatting failed' });

    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [
            buildTargetContext({
              entityId: primaryTargetId,
              displayName: 'Primary Friend',
              placeholder: 'primary',
            }),
            buildTargetContext({
              entityId: secondaryTargetId,
              displayName: 'Secondary Ally',
              placeholder: 'secondary',
            }),
          ],
        },
      ],
      trace: null,
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(multiTargetSpy).toHaveBeenCalled();
    expect(result.fallbackUsed).toBe(true);
    expect(result.formattedCommands).toEqual([
      expect.objectContaining({
        id: actionDef.id,
        command: 'Salute Primary Friend and Secondary Ally',
        params: { targetId: primaryTargetId },
      }),
    ]);
    expect(result.errors).toEqual([]);
    expect(dispatcher.calls.length).toBe(0);
  });

  it('records trace instrumentation and statistics for multi-target success', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = buildMultiTargetAction();
    const trace = {
      captureActionData: jest.fn(),
      info: jest.fn(),
    };
    const processingStats = { formatted: 0, successful: 0, failed: 0, multiTarget: 0, legacy: 0 };

    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [
            buildTargetContext({
              entityId: primaryTargetId,
              displayName: 'Primary Friend',
              placeholder: 'primary',
            }),
            buildTargetContext({
              entityId: secondaryTargetId,
              displayName: 'Secondary Ally',
              placeholder: 'secondary',
            }),
          ],
        },
      ],
      trace,
      processingStats,
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(trace.captureActionData).toHaveBeenCalledWith(
      'formatting',
      actionDef.id,
      expect.objectContaining({ status: 'formatting', formattingPath: 'legacy' }),
    );
    expect(result.fallbackUsed).toBe(false);
    expect(result.formattedCommands[0]).toEqual(
      expect.objectContaining({
        command: 'Salute Primary Friend and Secondary Ally',
        params: expect.objectContaining({ isMultiTarget: true }),
      }),
    );
    expect(result.fallbackUsed).toBe(false);
    expect(result.errors).toEqual([]);
  });

  it('increments statistics for traced single-target success', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = buildSingleTargetAction();
    const trace = { captureActionData: jest.fn(), info: jest.fn() };
    const processingStats = { formatted: 0, successful: 0, failed: 0, multiTarget: 0, legacy: 0 };

    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [
            buildTargetContext({
              entityId: primaryTargetId,
              displayName: 'Primary Friend',
              placeholder: 'target',
            }),
          ],
        },
      ],
      trace,
      processingStats,
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.errors).toEqual([]);
    expect(processingStats.successful).toBe(1);
    expect(processingStats.legacy).toBe(1);
    expect(trace.captureActionData).toHaveBeenCalledWith(
      'formatting',
      actionDef.id,
      expect.objectContaining({ formatterMethod: 'format', status: 'completed' }),
    );
  });

  it('collects normalization errors when resolved targets lack identifiers', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = buildMultiTargetAction();

    const trace = { captureActionData: jest.fn(), info: jest.fn() };
    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [
            buildTargetContext({
              entityId: null,
              displayName: 'Unknown Primary',
              placeholder: 'primary',
            }),
            buildTargetContext({
              entityId: null,
              displayName: 'Unknown Secondary',
              placeholder: 'secondary',
            }),
          ],
        },
      ],
      trace,
      processingStats: {},
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.formattedCommands).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(createError).toHaveBeenCalledTimes(1);
    expect(createError.mock.calls[0][0]).toEqual(
      expect.objectContaining({ code: 'TARGETS_INVALID' }),
    );
    expect(trace.captureActionData).toHaveBeenCalled();
  });

  it('uses fallback in traced multi-target path when formatter fails', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = buildMultiTargetAction();
    const trace = { captureActionData: jest.fn(), info: jest.fn() };
    const processingStats = { formatted: 0, successful: 0, failed: 0, multiTarget: 0, legacy: 0 };

    jest
      .spyOn(commandFormatter, 'formatMultiTarget')
      .mockReturnValue({ ok: false, error: 'unable' });

    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [
            buildTargetContext({
              entityId: primaryTargetId,
              displayName: 'Primary Friend',
              placeholder: 'primary',
            }),
            buildTargetContext({
              entityId: secondaryTargetId,
              displayName: 'Secondary Ally',
              placeholder: 'secondary',
            }),
          ],
        },
      ],
      trace,
      processingStats,
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.fallbackUsed).toBe(true);
    expect(result.formattedCommands[0]).toEqual(
      expect.objectContaining({ command: 'Salute Primary Friend and Secondary Ally' }),
    );
    expect(processingStats.legacy).toBeGreaterThan(0);
  });

  it('reports fallback failure in traced multi-target path', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = buildMultiTargetAction();
    const trace = { captureActionData: jest.fn(), info: jest.fn() };
    const processingStats = { formatted: 0, successful: 0, failed: 0, multiTarget: 0, legacy: 0 };

    jest
      .spyOn(commandFormatter, 'formatMultiTarget')
      .mockReturnValue({ ok: false, error: 'still bad' });
    jest
      .spyOn(fallbackFormatter, 'formatWithFallback')
      .mockReturnValue({ ok: false, error: 'fallback failed' });

    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [
            buildTargetContext({
              entityId: primaryTargetId,
              displayName: 'Primary Friend',
              placeholder: 'primary',
            }),
            buildTargetContext({
              entityId: secondaryTargetId,
              displayName: 'Secondary Ally',
              placeholder: 'secondary',
            }),
          ],
        },
      ],
      trace,
      processingStats,
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.formattedCommands).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(createError).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'fallback failed' }),
      actionDef,
      actor.id,
      trace,
      primaryTargetId ?? null,
    );
    expect(processingStats.failed).toBeGreaterThan(0);
  });

  it('warns when traced multi-target action lacks resolved targets', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = buildMultiTargetAction();
    const trace = { captureActionData: jest.fn(), info: jest.fn() };

    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [
            buildTargetContext({
              entityId: primaryTargetId,
              displayName: 'Primary Friend',
              placeholder: 'primary',
            }),
          ],
        },
      ],
      trace,
      processingStats: { formatted: 0, successful: 0, failed: 0, multiTarget: 0, legacy: 0 },
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.formattedCommands).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Skipping multi-target action '" + actionDef.id),
    );
  });

  it('falls back when multi-target formatter is unavailable in traced flow', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = buildMultiTargetAction();
    const trace = { captureActionData: jest.fn(), info: jest.fn() };

    const singleTargetFormatter = new ActionCommandFormatter();
    singleTargetFormatter.formatMultiTarget = undefined;
    const singleFallbackFormatter = new LegacyFallbackFormatter({
      commandFormatter: singleTargetFormatter,
      entityManager,
      getEntityDisplayNameFn: (entity, fallback) =>
        getEntityDisplayName(entity, fallback, logger),
    });
    strategy = new LegacyStrategy({
      commandFormatter: singleTargetFormatter,
      entityManager,
      safeEventDispatcher: dispatcher,
      getEntityDisplayNameFn: (entity, fallback) =>
        getEntityDisplayName(entity, fallback, logger),
      logger,
      fallbackFormatter: singleFallbackFormatter,
      createError,
      targetNormalizationService,
      validateVisualProperties,
    });

    const processingStats = { formatted: 0, successful: 0, failed: 0, multiTarget: 0, legacy: 0 };

    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [
            buildTargetContext({
              entityId: primaryTargetId,
              displayName: 'Primary Friend',
              placeholder: 'primary',
            }),
            buildTargetContext({
              entityId: secondaryTargetId,
              displayName: 'Secondary Ally',
              placeholder: 'secondary',
            }),
          ],
        },
      ],
      trace,
      processingStats,
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.fallbackUsed).toBe(true);
    expect(result.formattedCommands).toEqual([
      expect.objectContaining({
        command: 'Salute Primary Friend and Secondary Ally',
        params: { targetId: primaryTargetId },
      }),
    ]);
    expect(result.errors).toEqual([]);
    expect(processingStats.legacy).toBeGreaterThan(0);
    expect(processingStats.successful).toBeGreaterThan(0);
  });

  it('reports fallback failure when multi-target formatter is unavailable in traced flow', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = buildMultiTargetAction();
    const trace = { captureActionData: jest.fn(), info: jest.fn() };

    const singleTargetFormatter = new ActionCommandFormatter();
    singleTargetFormatter.formatMultiTarget = undefined;
    jest
      .spyOn(singleTargetFormatter, 'format')
      .mockReturnValue({ ok: false, error: 'fallback-unavailable' });

    const singleFallbackFormatter = new LegacyFallbackFormatter({
      commandFormatter: singleTargetFormatter,
      entityManager,
      getEntityDisplayNameFn: (entity, fallback) =>
        getEntityDisplayName(entity, fallback, logger),
    });
    strategy = new LegacyStrategy({
      commandFormatter: singleTargetFormatter,
      entityManager,
      safeEventDispatcher: dispatcher,
      getEntityDisplayNameFn: (entity, fallback) =>
        getEntityDisplayName(entity, fallback, logger),
      logger,
      fallbackFormatter: singleFallbackFormatter,
      createError,
      targetNormalizationService,
      validateVisualProperties,
    });

    const processingStats = { formatted: 0, successful: 0, failed: 0, multiTarget: 0, legacy: 0 };

    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [
            buildTargetContext({
              entityId: primaryTargetId,
              displayName: 'Primary Friend',
              placeholder: 'primary',
            }),
            buildTargetContext({
              entityId: secondaryTargetId,
              displayName: 'Secondary Ally',
              placeholder: 'secondary',
            }),
          ],
        },
      ],
      trace,
      processingStats,
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.formattedCommands).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(createError).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'fallback-unavailable' }),
      actionDef,
      actor.id,
      trace,
      primaryTargetId,
    );
    expect(processingStats.failed).toBeGreaterThan(0);
  });

  it('reports formatter errors in traced single-target path', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = buildSingleTargetAction();
    const trace = { captureActionData: jest.fn(), info: jest.fn() };
    const processingStats = { formatted: 0, successful: 0, failed: 0, multiTarget: 0, legacy: 0 };

    jest
      .spyOn(baseFormatter, 'format')
      .mockReturnValue({ ok: false, error: 'bad target' });

    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [
            buildTargetContext({
              entityId: primaryTargetId,
              displayName: 'Primary Friend',
              placeholder: 'target',
            }),
          ],
        },
      ],
      trace,
      processingStats,
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.errors).toHaveLength(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Failed to format command for action '" + actionDef.id),
      expect.any(Object),
    );
    expect(processingStats.failed).toBeGreaterThan(0);
  });

  it('captures thrown errors in traced single-target path', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = buildSingleTargetAction();
    const trace = { captureActionData: jest.fn(), info: jest.fn() };

    jest.spyOn(baseFormatter, 'format').mockImplementation(() => {
      const error = new Error('formatter explode');
      error.entityId = primaryTargetId;
      throw error;
    });

    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [
            buildTargetContext({
              entityId: primaryTargetId,
              displayName: 'Primary Friend',
              placeholder: 'target',
            }),
          ],
        },
      ],
      trace,
      processingStats: { formatted: 0, successful: 0, failed: 0, multiTarget: 0, legacy: 0 },
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.errors).toHaveLength(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Failed to format command for action '" + actionDef.id),
      expect.any(Object),
    );
  });

  it('formats multi-target actions without trace using normalization', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = buildMultiTargetAction();
    const processingStats = { formatted: 0, successful: 0, failed: 0, multiTarget: 0, legacy: 0 };

    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [
            buildTargetContext({
              entityId: primaryTargetId,
              displayName: 'Primary Friend',
              placeholder: 'primary',
            }),
            buildTargetContext({
              entityId: secondaryTargetId,
              displayName: 'Secondary Ally',
              placeholder: 'secondary',
            }),
          ],
        },
      ],
      trace: null,
      processingStats,
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.errors).toEqual([]);
    expect(result.formattedCommands[0]).toEqual(
      expect.objectContaining({
        command: 'Salute Primary Friend and Secondary Ally',
        params: expect.objectContaining({ isMultiTarget: true }),
      }),
    );
    expect(result.fallbackUsed).toBe(false);
  });

  it('collects normalization errors without trace when resolved targets lack identifiers', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = buildMultiTargetAction();

    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [
            buildTargetContext({
              entityId: null,
              displayName: 'Unknown Primary',
              placeholder: 'primary',
            }),
            buildTargetContext({
              entityId: null,
              displayName: 'Unknown Secondary',
              placeholder: 'secondary',
            }),
          ],
        },
      ],
      trace: null,
      processingStats: {},
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.formattedCommands).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(createError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'TARGETS_INVALID' }),
      actionDef,
      actor.id,
      null,
    );
  });

  it('reports fallback failure without trace when formatter fails', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = buildMultiTargetAction();

    jest
      .spyOn(commandFormatter, 'formatMultiTarget')
      .mockReturnValue({ ok: false, error: 'broken' });
    jest
      .spyOn(fallbackFormatter, 'formatWithFallback')
      .mockReturnValue({ ok: false, error: 'fallback still broken' });

    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [
            buildTargetContext({
              entityId: primaryTargetId,
              displayName: 'Primary Friend',
              placeholder: 'primary',
            }),
            buildTargetContext({
              entityId: secondaryTargetId,
              displayName: 'Secondary Ally',
              placeholder: 'secondary',
            }),
          ],
        },
      ],
      trace: null,
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.formattedCommands).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(createError).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'fallback still broken' }),
      actionDef,
      actor.id,
      null,
      primaryTargetId,
    );
  });

  it('falls back when multi-target formatter is unavailable without trace', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = buildMultiTargetAction();

    const singleTargetFormatter = new ActionCommandFormatter();
    singleTargetFormatter.formatMultiTarget = undefined;
    const singleFallbackFormatter = new LegacyFallbackFormatter({
      commandFormatter: singleTargetFormatter,
      entityManager,
      getEntityDisplayNameFn: (entity, fallback) =>
        getEntityDisplayName(entity, fallback, logger),
    });
    strategy = new LegacyStrategy({
      commandFormatter: singleTargetFormatter,
      entityManager,
      safeEventDispatcher: dispatcher,
      getEntityDisplayNameFn: (entity, fallback) =>
        getEntityDisplayName(entity, fallback, logger),
      logger,
      fallbackFormatter: singleFallbackFormatter,
      createError,
      targetNormalizationService,
      validateVisualProperties,
    });

    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [
            buildTargetContext({
              entityId: primaryTargetId,
              displayName: 'Primary Friend',
              placeholder: 'primary',
            }),
            buildTargetContext({
              entityId: secondaryTargetId,
              displayName: 'Secondary Ally',
              placeholder: 'secondary',
            }),
          ],
        },
      ],
      trace: null,
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.fallbackUsed).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.formattedCommands).toEqual([
      expect.objectContaining({
        command: 'Salute Primary Friend and Secondary Ally',
        params: { targetId: primaryTargetId },
      }),
    ]);
  });

  it('reports fallback failure when multi-target formatter is unavailable without trace', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = buildMultiTargetAction();

    const singleTargetFormatter = new ActionCommandFormatter();
    singleTargetFormatter.formatMultiTarget = undefined;
    jest
      .spyOn(singleTargetFormatter, 'format')
      .mockReturnValue({ ok: false, error: 'no-fallback-target' });

    const singleFallbackFormatter = new LegacyFallbackFormatter({
      commandFormatter: singleTargetFormatter,
      entityManager,
      getEntityDisplayNameFn: (entity, fallback) =>
        getEntityDisplayName(entity, fallback, logger),
    });
    strategy = new LegacyStrategy({
      commandFormatter: singleTargetFormatter,
      entityManager,
      safeEventDispatcher: dispatcher,
      getEntityDisplayNameFn: (entity, fallback) =>
        getEntityDisplayName(entity, fallback, logger),
      logger,
      fallbackFormatter: singleFallbackFormatter,
      createError,
      targetNormalizationService,
      validateVisualProperties,
    });

    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [
            buildTargetContext({
              entityId: primaryTargetId,
              displayName: 'Primary Friend',
              placeholder: 'primary',
            }),
            buildTargetContext({
              entityId: secondaryTargetId,
              displayName: 'Secondary Ally',
              placeholder: 'secondary',
            }),
          ],
        },
      ],
      trace: null,
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.formattedCommands).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(createError).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'no-fallback-target' }),
      actionDef,
      actor.id,
      null,
      primaryTargetId,
    );
  });

  it('warns when standard multi-target action lacks resolved targets', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = buildMultiTargetAction();

    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [
            buildTargetContext({
              entityId: primaryTargetId,
              displayName: 'Primary Friend',
              placeholder: 'primary',
            }),
          ],
        },
      ],
      trace: null,
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.formattedCommands).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Skipping multi-target action '" + actionDef.id),
    );
  });

  it('reports formatter errors without trace for single-target actions', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = buildSingleTargetAction();

    jest
      .spyOn(baseFormatter, 'format')
      .mockReturnValue({ ok: false, error: 'cannot format' });

    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [
            buildTargetContext({
              entityId: primaryTargetId,
              displayName: 'Primary Friend',
              placeholder: 'target',
            }),
          ],
        },
      ],
      trace: null,
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.errors).toHaveLength(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Failed to format command for action '" + actionDef.id),
      expect.any(Object),
    );
  });

  it('captures thrown errors without trace for single-target actions', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = buildSingleTargetAction();

    jest.spyOn(baseFormatter, 'format').mockImplementation(() => {
      const error = new Error('explode');
      error.entityId = primaryTargetId;
      throw error;
    });

    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [
            buildTargetContext({
              entityId: primaryTargetId,
              displayName: 'Primary Friend',
              placeholder: 'target',
            }),
          ],
        },
      ],
      trace: null,
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.errors).toHaveLength(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Failed to format command for action '" + actionDef.id),
      expect.any(Object),
    );
  });

  it('skips statistic updates when processing stats bag is missing', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = buildSingleTargetAction();
    const trace = { captureActionData: jest.fn(), info: jest.fn() };

    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [
            buildTargetContext({
              entityId: primaryTargetId,
              displayName: 'Primary Friend',
              placeholder: 'target',
            }),
          ],
        },
      ],
      trace,
      processingStats: null,
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.errors).toEqual([]);
    expect(trace.captureActionData).toHaveBeenCalledWith(
      'formatting',
      actionDef.id,
      expect.objectContaining({ status: 'completed' }),
    );
  });

  it('returns empty targets when contexts array is empty', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = buildMultiTargetAction();

    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [],
        },
      ],
      trace: null,
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.formattedCommands).toEqual([]);
  });
});
