import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';

import { EntityManagerTestBed } from '../../../common/entities/entityManagerTestBed.js';
import EventBus from '../../../../src/events/eventBus.js';
import { SafeEventDispatcher } from '../../../../src/events/safeEventDispatcher.js';
import ConsoleLogger, {
  LogLevel,
} from '../../../../src/logging/consoleLogger.js';
import { ActionTargetContext } from '../../../../src/models/actionTargetContext.js';
import { createActionFormattingTask } from '../../../../src/actions/pipeline/stages/actionFormatting/ActionFormattingTaskFactory.js';
import { FormattingAccumulator } from '../../../../src/actions/pipeline/stages/actionFormatting/FormattingAccumulator.js';
import { TargetNormalizationService } from '../../../../src/actions/pipeline/stages/actionFormatting/TargetNormalizationService.js';
import { LegacyFallbackFormatter } from '../../../../src/actions/pipeline/stages/actionFormatting/legacy/LegacyFallbackFormatter.js';
import { PerActionMetadataStrategy } from '../../../../src/actions/pipeline/stages/actionFormatting/strategies/PerActionMetadataStrategy.js';
import { TraceAwareInstrumentation } from '../../../../src/actions/pipeline/stages/actionFormatting/TraceAwareInstrumentation.js';
import ActionFormatter from '../../../../src/actions/actionFormatter.js';
import { MultiTargetActionFormatter } from '../../../../src/actions/formatters/MultiTargetActionFormatter.js';
import { ActionErrorContextBuilder } from '../../../../src/actions/errors/actionErrorContextBuilder.js';
import { ERROR_PHASES } from '../../../../src/actions/errors/actionErrorTypes.js';
import EntityDefinition from '../../../../src/entities/entityDefinition.js';

function createTraceRecorder() {
  const recorder = {
    events: [],
    captureActionData: jest.fn((stage, actionId, payload) => {
      recorder.events.push({ stage, actionId, payload });
    }),
  };

  return recorder;
}

function createErrorFactory(builder) {
  return ({ errorOrResult, actionDef, actorId, trace, targetId }) => {
    const error =
      errorOrResult instanceof Error
        ? errorOrResult
        : new Error(errorOrResult?.message || 'Formatting failure');

    return builder.buildErrorContext({
      error,
      actionDef,
      actorId,
      phase: ERROR_PHASES.EXECUTION,
      trace,
      targetId,
    });
  };
}

describe('TraceAwareInstrumentation integration', () => {
  let testBed;
  let entityManager;
  let logger;
  let eventBus;
  let safeEventDispatcher;
  let targetNormalizationService;
  let fallbackFormatter;
  let strategy;
  let traceRecorder;
  let instrumentation;
  let errorContextBuilder;

  const getEntityDisplayName = (entity) =>
    entity?.getComponentData('core:name')?.value || entity?.id || 'Unknown';

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T00:00:00Z'));

    testBed = new EntityManagerTestBed();
    entityManager = testBed.entityManager;

    logger = new ConsoleLogger(LogLevel.NONE);
    logger.debug = jest.fn();
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();

    eventBus = new EventBus({ logger });
    safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: eventBus,
      logger,
    });

    targetNormalizationService = new TargetNormalizationService({ logger });

    const baseFormatter = new ActionFormatter();
    fallbackFormatter = new LegacyFallbackFormatter({
      commandFormatter: baseFormatter,
      entityManager,
      getEntityDisplayNameFn: getEntityDisplayName,
    });

    const multiFormatter = new MultiTargetActionFormatter(baseFormatter, logger);

    strategy = new PerActionMetadataStrategy({
      commandFormatter: multiFormatter,
      entityManager,
      safeEventDispatcher,
      getEntityDisplayNameFn: getEntityDisplayName,
      logger,
      fallbackFormatter,
      targetNormalizationService,
    });

    const fixSuggestionEngine = { suggestFixes: () => [] };
    errorContextBuilder = new ActionErrorContextBuilder({
      entityManager,
      logger,
      fixSuggestionEngine,
    });

    traceRecorder = createTraceRecorder();
    instrumentation = new TraceAwareInstrumentation(traceRecorder);
  });

  afterEach(async () => {
    jest.useRealTimers();
    await testBed.cleanup();
  });

  async function createActorAndTargets() {
    const actorDefinition = new EntityDefinition('test:actor', {
      description: 'Test actor entity',
      components: {
        'core:name': { value: 'Lead Hero' },
      },
    });

    const targetDefinition = new EntityDefinition('test:target', {
      description: 'Target entity',
      components: {
        'core:name': { value: 'Target Entity' },
      },
    });

    testBed.setupDefinitions(actorDefinition, targetDefinition);

    const actor = await entityManager.createEntityInstance('test:actor', {
      instanceId: 'actor-1',
    });

    const firstTarget = await entityManager.createEntityInstance('test:target', {
      instanceId: 'target-1',
      componentOverrides: {
        'core:name': { value: 'Alpha' },
      },
    });

    const secondTarget = await entityManager.createEntityInstance('test:target', {
      instanceId: 'target-2',
      componentOverrides: {
        'core:name': { value: 'Beta' },
      },
    });

    return { actor, firstTarget, secondTarget };
  }

  it('captures instrumentation events for successful per-action formatting', async () => {
    const { actor, firstTarget, secondTarget } = await createActorAndTargets();

    const actionDef = {
      id: 'core:coordinate',
      name: 'Coordinate Strike',
      description: 'Coordinate efforts with allies',
      template: 'Coordinate with {primary} and {secondary}',
      visual: null,
    };

    const task = createActionFormattingTask({
      actor,
      actionWithTargets: {
        actionDef,
        targetContexts: [
          ActionTargetContext.forEntity(firstTarget.id),
          ActionTargetContext.forEntity(secondTarget.id),
        ],
        resolvedTargets: {
          primary: [
            {
              id: firstTarget.id,
              displayName: getEntityDisplayName(firstTarget),
            },
          ],
          secondary: [
            {
              id: secondTarget.id,
              displayName: getEntityDisplayName(secondTarget),
            },
          ],
        },
        targetDefinitions: {
          primary: { placeholder: 'primary', optional: false },
          secondary: { placeholder: 'secondary', optional: true },
        },
        isMultiTarget: true,
      },
      formatterOptions: { logger, safeEventDispatcher },
    });

    const accumulator = new FormattingAccumulator();
    const createError = createErrorFactory(errorContextBuilder);

    instrumentation.stageStarted({
      formattingPath: 'per-action',
      actor,
      actions: [{ actionDef, metadata: { source: 'per-action' } }],
    });

    await strategy.format({
      task,
      instrumentation,
      accumulator,
      createError,
      trace: null,
    });

    instrumentation.stageCompleted({
      formattingPath: 'per-action',
      statistics: accumulator.getStatistics(),
      errorCount: accumulator.getErrors().length,
    });

    const events = traceRecorder.events;

    expect(events.find((event) => event.payload.status === 'started')).toBeDefined();
    expect(events.find((event) => event.payload.status === 'formatting')).toBeDefined();
    const completionEvent = events.find(
      (event) => event.payload.status === 'completed' && event.actionId === actionDef.id
    );
    expect(completionEvent).toBeDefined();
    expect(completionEvent.payload.commandCount).toBeGreaterThan(0);

    const summaryEvent = events.find((event) => event.actionId === '__stage_summary');
    expect(summaryEvent).toBeDefined();
    expect(summaryEvent.payload.statistics.total).toBe(1);
    expect(summaryEvent.payload.errors).toBe(0);

    const formattedActions = accumulator.getFormattedActions();
    expect(formattedActions).toHaveLength(1);
    expect(formattedActions[0].command).toEqual(
      expect.stringContaining(getEntityDisplayName(firstTarget))
    );
    expect(formattedActions[0].command).toEqual(
      expect.stringContaining(getEntityDisplayName(secondTarget))
    );
  });

  it('records failures when normalization cannot resolve targets', async () => {
    const { actor, firstTarget } = await createActorAndTargets();

    const actionDef = {
      id: 'core:coordinate',
      name: 'Coordinate Strike',
      description: 'Coordinate efforts with allies',
      template: 'Coordinate with {primary}',
    };

    const task = createActionFormattingTask({
      actor,
      actionWithTargets: {
        actionDef,
        targetContexts: [ActionTargetContext.forEntity(firstTarget.id)],
        resolvedTargets: {
          primary: [], // Force normalization failure
        },
        targetDefinitions: {
          primary: { placeholder: 'primary', optional: false },
        },
        isMultiTarget: true,
      },
      formatterOptions: { logger, safeEventDispatcher },
    });

    const accumulator = new FormattingAccumulator();
    const createError = createErrorFactory(errorContextBuilder);

    instrumentation.stageStarted({
      formattingPath: 'per-action',
      actor,
      actions: [{ actionDef, metadata: { source: 'per-action' } }],
    });

    await strategy.format({
      task,
      instrumentation,
      accumulator,
      createError,
      trace: null,
    });

    instrumentation.stageCompleted({
      formattingPath: 'per-action',
      statistics: accumulator.getStatistics(),
      errorCount: accumulator.getErrors().length,
    });

    expect(accumulator.getErrors()).toHaveLength(1);
    expect(traceRecorder.events.find((event) => event.payload.status === 'failed')).toBeDefined();

    const summaryEvent = traceRecorder.events.find(
      (event) => event.actionId === '__stage_summary'
    );
    expect(summaryEvent).toBeDefined();
    expect(summaryEvent.payload.errors).toBe(1);
  });
});

