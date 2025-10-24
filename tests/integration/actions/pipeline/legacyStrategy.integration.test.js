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
      error.target = { entityId: 'target.from.throw' };
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
      expect.objectContaining({
        error: expect.objectContaining({ target: { entityId: 'target.from.throw' } }),
      }),
    );
  });

  it('captures thrown errors using entity id fallback in traced path when target is missing', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = buildSingleTargetAction();
    const trace = { captureActionData: jest.fn(), info: jest.fn() };

    jest.spyOn(baseFormatter, 'format').mockImplementation(() => {
      const error = new Error('formatter entity only');
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
      expect.objectContaining({
        error: expect.objectContaining({ entityId: primaryTargetId }),
      }),
    );
  });

  it('falls back to context identifier when traced errors lack entity metadata', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = buildSingleTargetAction();
    const trace = { captureActionData: jest.fn(), info: jest.fn() };

    jest.spyOn(baseFormatter, 'format').mockImplementation(() => {
      throw new Error('formatter missing metadata');
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
      expect.objectContaining({
        error: expect.any(Error),
      }),
    );
    expect(createError).toHaveBeenCalledWith(
      expect.any(Error),
      actionDef,
      actor.id,
      trace,
      null,
      primaryTargetId,
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

  it('skips standard fallback when multi-target formatter fails without contexts', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = buildMultiTargetAction();

    jest
      .spyOn(commandFormatter, 'formatMultiTarget')
      .mockReturnValue({ ok: false, error: 'no-targets' });

    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [],
        },
      ],
      trace: null,
      processingStats: { formatted: 0, successful: 0, failed: 0, multiTarget: 0, legacy: 0 },
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.formattedCommands).toEqual([]);
    expect(result.fallbackUsed).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Skipping multi-target action '" + actionDef.id),
    );
  });

  it('skips standard fallback when formatter is unavailable and contexts are empty', async () => {
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
          targetContexts: [],
        },
      ],
      trace: null,
      processingStats: { formatted: 0, successful: 0, failed: 0, multiTarget: 0, legacy: 0 },
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.formattedCommands).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Skipping multi-target action '" + actionDef.id),
    );
  });

  it('uses defaults when standard fallback handles unavailable formatter with minimal metadata', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = {
      id: 'unavailable-standard-minimal',
      name: 'Unavailable Standard Minimal',
      template: 'Assist {primary}',
      targets: {
        primary: { placeholder: 'primary' },
      },
    };

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

    jest
      .spyOn(singleFallbackFormatter, 'formatWithFallback')
      .mockReturnValue({ ok: true, value: 'Assist Primary Friend' });

    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [
            {
              entityId: primaryTargetId,
              displayName: 'Primary Friend',
              type: TARGET_TYPE_ENTITY,
            },
          ],
        },
      ],
      trace: null,
      processingStats: { formatted: 0, successful: 0, failed: 0, multiTarget: 0, legacy: 0 },
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.fallbackUsed).toBe(true);
    expect(result.formattedCommands[0]).toEqual(
      expect.objectContaining({
        description: '',
        visual: null,
        params: { targetId: primaryTargetId },
      }),
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
      error.target = { entityId: 'target.from.throw' };
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
      expect.objectContaining({
        error: expect.objectContaining({ target: { entityId: 'target.from.throw' } }),
      }),
    );
  });

  it('captures thrown errors using entity id fallback without trace when target missing', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = buildSingleTargetAction();

    jest.spyOn(baseFormatter, 'format').mockImplementation(() => {
      const error = new Error('explode entity only');
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
      processingStats: { formatted: 0, successful: 0, failed: 0, multiTarget: 0, legacy: 0 },
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.errors).toHaveLength(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Failed to format command for action '" + actionDef.id),
      expect.objectContaining({
        error: expect.objectContaining({ entityId: primaryTargetId }),
      }),
    );
  });

  it('falls back to context identifier without trace when error lacks metadata', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = buildSingleTargetAction();

    jest.spyOn(baseFormatter, 'format').mockImplementation(() => {
      throw new Error('no metadata');
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
      processingStats: { formatted: 0, successful: 0, failed: 0, multiTarget: 0, legacy: 0 },
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.errors).toHaveLength(1);
    expect(createError).toHaveBeenCalledWith(
      expect.any(Error),
      actionDef,
      actor.id,
      null,
      null,
      primaryTargetId,
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

  it('supports multi-target formatter returning explicit command objects in traced flow', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = buildMultiTargetAction();
    const trace = { captureActionData: jest.fn(), info: jest.fn() };
    const processingStats = { formatted: 0, successful: 0, failed: 0, multiTarget: 0, legacy: 0 };

    const explicitTargets = {
      primary: [
        {
          id: primaryTargetId,
          displayName: 'Primary Friend',
        },
      ],
      secondary: [
        {
          id: secondaryTargetId,
          displayName: 'Secondary Ally',
        },
      ],
    };

    jest.spyOn(commandFormatter, 'formatMultiTarget').mockReturnValue({
      ok: true,
      value: [
        {
          command: 'Salute the alliance',
          targets: explicitTargets,
        },
      ],
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
      trace,
      processingStats,
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.errors).toEqual([]);
    expect(result.formattedCommands[0]).toEqual(
      expect.objectContaining({
        command: 'Salute the alliance',
        params: expect.objectContaining({
          isMultiTarget: true,
          targetIds: expect.objectContaining({ primary: [primaryTargetId] }),
        }),
      }),
    );
    expect(processingStats.multiTarget).toBeGreaterThan(0);
  });

  it('omits target identifier when traced fallback receives a context without entity id', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = buildMultiTargetAction();
    const trace = { captureActionData: jest.fn(), info: jest.fn() };

    jest
      .spyOn(commandFormatter, 'formatMultiTarget')
      .mockReturnValue({ ok: false, error: 'no-multi-target' });
    jest
      .spyOn(fallbackFormatter, 'formatWithFallback')
      .mockReturnValue({ ok: true, value: 'Fallback salute' });

    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [
            {
              entityId: undefined,
              displayName: 'Unknown Primary',
              type: TARGET_TYPE_ENTITY,
            },
            buildTargetContext({
              entityId: secondaryTargetId,
              displayName: 'Secondary Ally',
              placeholder: 'secondary',
            }),
          ],
        },
      ],
      trace,
      processingStats: { formatted: 0, successful: 0, failed: 0, multiTarget: 0, legacy: 0 },
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.fallbackUsed).toBe(true);
    expect(result.formattedCommands[0]).toEqual(
      expect.objectContaining({
        params: {},
      }),
    );
    expect(createError).not.toHaveBeenCalled();
  });

  it('propagates null target identifiers when traced fallback fails without entity id', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = buildMultiTargetAction();
    const trace = { captureActionData: jest.fn(), info: jest.fn() };

    jest
      .spyOn(commandFormatter, 'formatMultiTarget')
      .mockReturnValue({ ok: false, error: 'still-invalid' });
    jest
      .spyOn(fallbackFormatter, 'formatWithFallback')
      .mockReturnValue({ ok: false, error: 'no-fallback-target' });

    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [
            {
              entityId: undefined,
              displayName: 'Unknown Primary',
              type: TARGET_TYPE_ENTITY,
            },
            buildTargetContext({
              entityId: secondaryTargetId,
              displayName: 'Secondary Ally',
              placeholder: 'secondary',
            }),
          ],
        },
      ],
      trace,
      processingStats: { formatted: 0, successful: 0, failed: 0, multiTarget: 0, legacy: 0 },
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.formattedCommands).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(createError).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'no-fallback-target' }),
      actionDef,
      actor.id,
      trace,
      null,
    );
  });

  it('skips traced fallback when multi-target formatter fails without contexts', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = buildMultiTargetAction();
    const trace = { captureActionData: jest.fn(), info: jest.fn() };

    jest
      .spyOn(commandFormatter, 'formatMultiTarget')
      .mockReturnValue({ ok: false, error: 'no-targets' });

    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [],
        },
      ],
      trace,
      processingStats: { formatted: 0, successful: 0, failed: 0, multiTarget: 0, legacy: 0 },
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.formattedCommands).toEqual([]);
    expect(result.fallbackUsed).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Skipping multi-target action '" + actionDef.id),
    );
  });

  it('skips traced fallback when formatter is unavailable and contexts are empty', async () => {
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

    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [],
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

  it('uses defaults when traced fallback handles unavailable formatter with minimal metadata', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = {
      id: 'unavailable-traced-minimal',
      name: 'Unavailable Traced Minimal',
      template: 'Assist {primary}',
      targets: {
        primary: { placeholder: 'primary' },
      },
    };
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

    jest
      .spyOn(singleFallbackFormatter, 'formatWithFallback')
      .mockReturnValue({ ok: true, value: 'Assist Primary Friend' });

    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [
            {
              entityId: primaryTargetId,
              displayName: 'Primary Friend',
              type: TARGET_TYPE_ENTITY,
            },
          ],
        },
      ],
      trace,
      processingStats: { formatted: 0, successful: 0, failed: 0, multiTarget: 0, legacy: 0 },
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.fallbackUsed).toBe(true);
    expect(result.formattedCommands[0]).toEqual(
      expect.objectContaining({
        description: '',
        visual: null,
        params: { targetId: primaryTargetId },
      }),
    );
  });
  it('omits target identifier when standard fallback receives a context without entity id', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = buildMultiTargetAction();

    jest
      .spyOn(commandFormatter, 'formatMultiTarget')
      .mockReturnValue({ ok: false, error: 'no-multi-target' });
    jest
      .spyOn(fallbackFormatter, 'formatWithFallback')
      .mockReturnValue({ ok: true, value: 'Fallback salute' });

    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [
            {
              entityId: undefined,
              displayName: 'Unknown Primary',
              type: TARGET_TYPE_ENTITY,
            },
            buildTargetContext({
              entityId: secondaryTargetId,
              displayName: 'Secondary Ally',
              placeholder: 'secondary',
            }),
          ],
        },
      ],
      trace: null,
      processingStats: { formatted: 0, successful: 0, failed: 0, multiTarget: 0, legacy: 0 },
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.fallbackUsed).toBe(true);
    expect(result.formattedCommands[0]).toEqual(
      expect.objectContaining({
        params: {},
      }),
    );
    expect(createError).not.toHaveBeenCalled();
  });

  it('formats traced multi-target success without optional metadata fields', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = {
      id: 'minimal-multi-success-traced',
      name: 'Minimal Multi Success Traced',
      template: 'Coordinate {primary}',
      targets: {
        primary: { placeholder: 'primary' },
      },
    };
    const trace = { captureActionData: jest.fn(), info: jest.fn() };
    const processingStats = { formatted: 0, successful: 0, failed: 0, multiTarget: 0, legacy: 0 };

    const commandTargets = {
      primary: [
        { id: primaryTargetId, displayName: 'Primary Friend' },
        { id: secondaryTargetId, displayName: 'Secondary Ally' },
      ],
    };

    jest.spyOn(commandFormatter, 'formatMultiTarget').mockReturnValue({
      ok: true,
      value: [
        {
          command: 'Coordinate team',
          targets: commandTargets,
        },
      ],
    });

    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [
            {
              entityId: primaryTargetId,
              placeholder: 'primary',
              type: TARGET_TYPE_ENTITY,
            },
            {
              entityId: secondaryTargetId,
              placeholder: 'primary',
              type: TARGET_TYPE_ENTITY,
            },
          ],
        },
      ],
      trace,
      processingStats,
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.errors).toEqual([]);
    expect(result.formattedCommands[0]).toEqual(
      expect.objectContaining({
        command: 'Coordinate team',
        description: '',
        visual: null,
      }),
    );
    expect(result.formattedCommands[0].params).toEqual(
      expect.objectContaining({
        targetIds: expect.objectContaining({ primary: [primaryTargetId, secondaryTargetId] }),
      }),
    );
  });

  it('supports multi-target formatter returning explicit command objects without trace', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = buildMultiTargetAction();

    const explicitTargets = {
      primary: [
        {
          id: primaryTargetId,
          displayName: 'Primary Friend',
        },
      ],
      secondary: [
        {
          id: secondaryTargetId,
          displayName: 'Secondary Ally',
        },
      ],
    };

    jest.spyOn(commandFormatter, 'formatMultiTarget').mockReturnValue({
      ok: true,
      value: [
        {
          command: 'Coordinate allies',
          targets: explicitTargets,
        },
      ],
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

    expect(result.errors).toEqual([]);
    expect(result.formattedCommands[0]).toEqual(
      expect.objectContaining({
        command: 'Coordinate allies',
        params: expect.objectContaining({
          isMultiTarget: true,
          targetIds: expect.objectContaining({ primary: [primaryTargetId] }),
        }),
      }),
    );
  });

  it('formats standard multi-target success without optional metadata fields', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = {
      id: 'minimal-multi-success-standard',
      name: 'Minimal Multi Success Standard',
      template: 'Coordinate {primary}',
      targets: {
        primary: { placeholder: 'primary' },
      },
    };

    const commandTargets = {
      primary: [
        { id: primaryTargetId, displayName: 'Primary Friend' },
        { id: secondaryTargetId, displayName: 'Secondary Ally' },
      ],
    };

    jest.spyOn(commandFormatter, 'formatMultiTarget').mockReturnValue({
      ok: true,
      value: [
        {
          command: 'Coordinate standard team',
          targets: commandTargets,
        },
      ],
    });

    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [
            {
              entityId: primaryTargetId,
              placeholder: 'primary',
              type: TARGET_TYPE_ENTITY,
            },
            {
              entityId: secondaryTargetId,
              placeholder: 'primary',
              type: TARGET_TYPE_ENTITY,
            },
          ],
        },
      ],
      trace: null,
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.errors).toEqual([]);
    expect(result.formattedCommands[0]).toEqual(
      expect.objectContaining({
        command: 'Coordinate standard team',
        description: '',
        visual: null,
      }),
    );
    expect(result.formattedCommands[0].params).toEqual(
      expect.objectContaining({
        targetIds: expect.objectContaining({ primary: [primaryTargetId, secondaryTargetId] }),
      }),
    );
  });

  it('formats successfully when actions are omitted and defaults are used', async () => {
    const actor = entityManager.getEntityInstance(actorId);

    const result = await strategy.format({
      actor,
      trace: null,
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.formattedCommands).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.pipelineResult.success).toBe(true);
  });

  it('resolves targets when placeholders and definitions rely on defaults', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = {
      id: 'assist-action',
      name: 'Assist',
      description: 'Help an ally',
      template: 'Assist {primary}',
      targets: {
        primary: {},
      },
      visual: null,
    };

    jest
      .spyOn(commandFormatter, 'formatMultiTarget')
      .mockReturnValue({ ok: false, error: 'missing' });
    jest
      .spyOn(fallbackFormatter, 'formatWithFallback')
      .mockReturnValue({ ok: true, value: 'Assist Primary Friend' });

    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [
            {
              entityId: primaryTargetId,
              displayName: 'Primary Friend',
              type: TARGET_TYPE_ENTITY,
            },
          ],
        },
      ],
      trace: null,
      processingStats: { formatted: 0, successful: 0, failed: 0, multiTarget: 0, legacy: 0 },
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.fallbackUsed).toBe(true);
    expect(result.formattedCommands[0]).toEqual(
      expect.objectContaining({
        command: 'Assist Primary Friend',
        params: { targetId: primaryTargetId },
      }),
    );
  });

  it('uses traced fallback with minimal metadata to populate default fields', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = {
      id: 'minimal-traced-fallback',
      name: 'Minimal Traced',
      template: 'Assist {primary}',
      targets: {
        primary: { placeholder: 'primary' },
      },
    };
    const trace = { captureActionData: jest.fn(), info: jest.fn() };

    jest
      .spyOn(commandFormatter, 'formatMultiTarget')
      .mockReturnValue({ ok: false, error: 'nope' });
    jest
      .spyOn(fallbackFormatter, 'formatWithFallback')
      .mockReturnValue({ ok: true, value: 'Fallback minimal traced' });

    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [
            {
              entityId: primaryTargetId,
              type: TARGET_TYPE_ENTITY,
            },
          ],
        },
      ],
      trace,
      processingStats: { formatted: 0, successful: 0, failed: 0, multiTarget: 0, legacy: 0 },
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.fallbackUsed).toBe(true);
    expect(result.formattedCommands[0]).toEqual(
      expect.objectContaining({
        description: '',
        visual: null,
        params: { targetId: primaryTargetId },
      }),
    );
  });

  it('uses standard fallback with minimal metadata to populate default fields', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = {
      id: 'minimal-standard-fallback',
      name: 'Minimal Standard',
      template: 'Assist {primary}',
      targets: {
        primary: { placeholder: 'primary' },
      },
    };

    jest
      .spyOn(commandFormatter, 'formatMultiTarget')
      .mockReturnValue({ ok: false, error: 'nope' });
    jest
      .spyOn(fallbackFormatter, 'formatWithFallback')
      .mockReturnValue({ ok: true, value: 'Fallback minimal standard' });

    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [
            {
              entityId: primaryTargetId,
              type: TARGET_TYPE_ENTITY,
            },
          ],
        },
      ],
      trace: null,
      processingStats: { formatted: 0, successful: 0, failed: 0, multiTarget: 0, legacy: 0 },
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.fallbackUsed).toBe(true);
    expect(result.formattedCommands[0]).toEqual(
      expect.objectContaining({
        description: '',
        visual: null,
        params: { targetId: primaryTargetId },
      }),
    );
  });

  it('formats traced single-target actions without optional metadata fields', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = {
      id: 'minimal-traced-single',
      name: 'Minimal Traced Single',
      template: 'Greet {target}',
    };
    const trace = { captureActionData: jest.fn(), info: jest.fn() };

    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [
            {
              entityId: primaryTargetId,
              placeholder: 'target',
              type: TARGET_TYPE_ENTITY,
            },
          ],
        },
      ],
      trace,
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.formattedCommands[0]).toEqual(
      expect.objectContaining({
        description: '',
        visual: null,
      }),
    );
  });

  it('formats standard single-target actions without optional metadata fields', async () => {
    const actor = entityManager.getEntityInstance(actorId);
    const actionDef = {
      id: 'minimal-standard-single',
      name: 'Minimal Standard Single',
      template: 'Greet {target}',
    };

    const result = await strategy.format({
      actor,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts: [
            {
              entityId: primaryTargetId,
              placeholder: 'target',
              type: TARGET_TYPE_ENTITY,
            },
          ],
        },
      ],
      trace: null,
      traceSource: 'ActionFormattingStage.execute',
    });

    expect(result.formattedCommands[0]).toEqual(
      expect.objectContaining({
        description: '',
        visual: null,
      }),
    );
  });
});
