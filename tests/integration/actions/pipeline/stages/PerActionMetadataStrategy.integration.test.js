/**
 * @file Integration tests for PerActionMetadataStrategy covering multi-target and legacy flows.
 */

import { describe, it, expect } from '@jest/globals';
import { PerActionMetadataStrategy } from '../../../../../src/actions/pipeline/stages/actionFormatting/strategies/PerActionMetadataStrategy.js';
import { FormattingAccumulator } from '../../../../../src/actions/pipeline/stages/actionFormatting/FormattingAccumulator.js';
import { TargetNormalizationService } from '../../../../../src/actions/pipeline/stages/actionFormatting/TargetNormalizationService.js';
import { ActionFormattingErrorFactory } from '../../../../../src/actions/pipeline/stages/actionFormatting/ActionFormattingErrorFactory.js';
import { ActionFormattingInstrumentation } from '../../../../../src/actions/pipeline/stages/actionFormatting/ActionFormattingInstrumentation.js';
import { LegacyFallbackFormatter } from '../../../../../src/actions/pipeline/stages/actionFormatting/legacy/LegacyFallbackFormatter.js';
import { createActionFormattingTask } from '../../../../../src/actions/pipeline/stages/actionFormatting/ActionFormattingTaskFactory.js';
import { MultiTargetActionFormatter } from '../../../../../src/actions/formatters/MultiTargetActionFormatter.js';
import ActionCommandFormatter from '../../../../../src/actions/actionFormatter.js';
import { ActionErrorContextBuilder } from '../../../../../src/actions/errors/actionErrorContextBuilder.js';
import { FixSuggestionEngine } from '../../../../../src/actions/errors/fixSuggestionEngine.js';
import { getEntityDisplayName } from '../../../../../src/utils/entityUtils.js';
import SimpleEntityManager from '../../../../common/entities/simpleEntityManager.js';
import {
  createMockLogger,
  createMockValidatedEventDispatcherForIntegration,
} from '../../../../common/mockFactories/index.js';

class RecordingInstrumentation extends ActionFormattingInstrumentation {
  constructor() {
    super();
    this.stageStartedEvents = [];
    this.actionStartedEvents = [];
    this.actionCompletedEvents = [];
    this.actionFailedEvents = [];
    this.stageCompletedEvents = [];
  }

  stageStarted(context) {
    this.stageStartedEvents.push(context);
  }

  actionStarted(context) {
    this.actionStartedEvents.push(context);
  }

  actionCompleted(context) {
    this.actionCompletedEvents.push(context);
  }

  actionFailed(context) {
    this.actionFailedEvents.push(context);
  }

  stageCompleted(context) {
    this.stageCompletedEvents.push(context);
  }
}

const buildGameDataRepository = () => ({
  getComponentDefinition: () => ({ id: 'component:test' }),
  getConditionDefinition: () => ({ id: 'condition:test' }),
});

const buildActionIndex = () => ({
  getCandidateActions: () => [],
});

const buildEntityManager = () =>
  new SimpleEntityManager([
    {
      id: 'actor-1',
      components: {
        'core:name': { value: 'Primary Actor' },
      },
    },
    {
      id: 'target-1',
      components: {
        'core:name': { value: 'Target One' },
      },
    },
    {
      id: 'target-2',
      components: {
        'core:name': { value: 'Target Two' },
      },
    },
  ]);

const createActionDefinition = (overrides = {}) => ({
  id: 'test:per-action',
  name: 'Wave Enthusiastically',
  description: 'A friendly wave.',
  template: 'Wave at {primary}',
  visual: { backgroundColor: '#fff' },
  ...overrides,
});

const createTargetContext = (overrides = {}) => ({
  entityId: 'target-1',
  type: 'entity',
  displayName: 'Target One',
  placeholder: 'primary',
  ...overrides,
});

const createTargetDefinitions = (overrides = {}) => ({
  primary: { placeholder: 'primary', optional: false },
  secondary: { placeholder: 'secondary', optional: true },
  ...overrides,
});

const getErrorMessage = (error) =>
  typeof error === 'string' ? error : error?.message ?? String(error);

const buildStrategyTestContext = (options = {}) => {
  const logger = createMockLogger();
  const dispatcher = createMockValidatedEventDispatcherForIntegration();
  const entityManager = buildEntityManager();
  const targetNormalizationService = new TargetNormalizationService({ logger });
  const baseFormatter = new ActionCommandFormatter();
  const commandFormatter = options.createCommandFormatter
    ? options.createCommandFormatter({ baseFormatter, logger })
    : new MultiTargetActionFormatter(baseFormatter, logger);

  const fallbackFormatter = new LegacyFallbackFormatter({
    commandFormatter: baseFormatter,
    entityManager,
    getEntityDisplayNameFn: (entity, fallback) =>
      getEntityDisplayName(entity, fallback, logger),
  });

  const instrumentation = new RecordingInstrumentation();
  const accumulator = new FormattingAccumulator();

  const fixSuggestionEngine = new FixSuggestionEngine({
    logger,
    gameDataRepository: buildGameDataRepository(),
    actionIndex: buildActionIndex(),
  });

  const errorContextBuilder = new ActionErrorContextBuilder({
    entityManager,
    logger,
    fixSuggestionEngine,
  });

  const errorFactory = new ActionFormattingErrorFactory({
    errorContextBuilder,
  });

  const capturedErrorContexts = [];
  const createError = (context) => {
    capturedErrorContexts.push(context);
    return errorFactory.create(context);
  };

  const strategy = new PerActionMetadataStrategy({
    commandFormatter,
    entityManager,
    safeEventDispatcher: dispatcher,
    getEntityDisplayNameFn: (entity, fallback) =>
      getEntityDisplayName(entity, fallback, logger),
    logger,
    fallbackFormatter,
    targetNormalizationService,
  });

  const actor = entityManager.getEntityInstance('actor-1');

  return {
    strategy,
    instrumentation,
    accumulator,
    createError,
    capturedErrorContexts,
    targetNormalizationService,
    entityManager,
    logger,
    commandFormatter,
    actor,
  };
};

describe('PerActionMetadataStrategy integration', () => {
  it('exits early when no task is provided', async () => {
    const context = buildStrategyTestContext();

    await context.strategy.format({
      task: null,
      instrumentation: context.instrumentation,
      accumulator: context.accumulator,
      createError: context.createError,
      trace: undefined,
    });

    expect(context.accumulator.getStatistics().total).toBe(0);
    expect(context.instrumentation.actionStartedEvents).toHaveLength(0);
    expect(context.capturedErrorContexts).toHaveLength(0);
  });

  it('records normalization failures produced by the target normalization service', async () => {
    const context = buildStrategyTestContext();
    const actionDef = createActionDefinition();

    const task = createActionFormattingTask({
      actor: context.actor,
      actionWithTargets: {
        actionDef,
        targetContexts: [createTargetContext()],
        resolvedTargets: {
          primary: [{ displayName: 'Invalid Primary' }],
        },
        targetDefinitions: createTargetDefinitions(),
        isMultiTarget: true,
      },
      formatterOptions: {},
    });

    expect(context.strategy.canFormat(task)).toBe(true);

    await context.strategy.format({
      task,
      instrumentation: context.instrumentation,
      accumulator: context.accumulator,
      createError: context.createError,
      trace: undefined,
    });

    const errors = context.accumulator.getErrors();
    expect(errors).toHaveLength(1);
    const [errorPayload] = errors;
    expect(getErrorMessage(errorPayload.error)).toContain(
      'Resolved targets were provided but no valid target identifiers could be extracted.'
    );
    expect(context.accumulator.getStatistics().failed).toBe(1);
    expect(context.accumulator.getActionSummary(actionDef.id)).toEqual(
      expect.objectContaining({ successes: 0, failures: 1 })
    );
  });

  it('combines formatter and fallback failures when the multi-target formatter throws', async () => {
    class ThrowingFormatter extends MultiTargetActionFormatter {
      constructor(baseFormatter, logger) {
        super(baseFormatter, logger);
      }

      formatMultiTarget(actionDef, resolvedTargets, entityManager, options, deps) {
        super.formatMultiTarget(actionDef, resolvedTargets, entityManager, options, deps);
        throw new Error('format explosion');
      }
    }

    const context = buildStrategyTestContext({
      createCommandFormatter: ({ baseFormatter, logger }) =>
        new ThrowingFormatter(baseFormatter, logger),
    });

    const actionDef = createActionDefinition();
    const task = createActionFormattingTask({
      actor: context.actor,
      actionWithTargets: {
        actionDef,
        targetContexts: [createTargetContext({ placeholder: 'secondary', entityId: 'target-1' })],
        resolvedTargets: {
          primary: [{ placeholder: 'primary', displayName: 'Broken Entry' }],
          secondary: [{ id: 'target-1', displayName: 'Target One' }],
        },
        targetDefinitions: createTargetDefinitions(),
        isMultiTarget: true,
      },
      formatterOptions: {},
    });

    expect(context.strategy.canFormat(task)).toBe(true);

    await context.strategy.format({
      task,
      instrumentation: context.instrumentation,
      accumulator: context.accumulator,
      createError: context.createError,
      trace: undefined,
    });

    expect(context.instrumentation.actionFailedEvents).toHaveLength(1);
    const failureEvent = context.instrumentation.actionFailedEvents[0];
    expect(failureEvent.payload.formatterMethod).toBe('format');
    expect(failureEvent.payload.fallbackUsed).toBe(true);
    expect(failureEvent.payload.error).toBe(
      'Legacy fallback target context not available'
    );

    const errors = context.accumulator.getErrors();
    expect(errors).toHaveLength(1);
    const combinedError = errors[0].error;
    expect(combinedError).toBeInstanceOf(Error);
    expect(combinedError.message).toContain('format explosion');
    expect(combinedError.message).toContain(
      'fallback: Legacy fallback target context not available'
    );
    expect(combinedError.cause).toBeInstanceOf(Error);
  });

  it('records command-level normalization errors produced by formatter outputs', async () => {
    class CommandPayloadFormatter extends MultiTargetActionFormatter {
      constructor(baseFormatter, logger) {
        super(baseFormatter, logger);
      }

      formatMultiTarget(actionDef, resolvedTargets, entityManager, options, deps) {
        const baseResult = super.formatMultiTarget(
          actionDef,
          resolvedTargets,
          entityManager,
          options,
          deps
        );

        if (!baseResult.ok) {
          return baseResult;
        }

        const value = Array.isArray(baseResult.value)
          ? baseResult.value[0]
          : baseResult.value;

        const command = typeof value === 'string' ? value : value.command;

        return {
          ok: true,
          value: [
            {
              command,
              targets: {
                primary: [{ displayName: 'Missing identifier' }],
              },
            },
          ],
        };
      }
    }

    const context = buildStrategyTestContext({
      createCommandFormatter: ({ baseFormatter, logger }) =>
        new CommandPayloadFormatter(baseFormatter, logger),
    });

    const actionDef = createActionDefinition();
    const task = createActionFormattingTask({
      actor: context.actor,
      actionWithTargets: {
        actionDef,
        targetContexts: [createTargetContext()],
        resolvedTargets: {
          primary: [{ id: 'target-1', displayName: 'Target One' }],
        },
        targetDefinitions: createTargetDefinitions({
          primary: { placeholder: 'primary', optional: false },
        }),
        isMultiTarget: true,
      },
      formatterOptions: {},
    });

    expect(context.strategy.canFormat(task)).toBe(true);

    await context.strategy.format({
      task,
      instrumentation: context.instrumentation,
      accumulator: context.accumulator,
      createError: context.createError,
      trace: undefined,
    });

    expect(context.instrumentation.actionFailedEvents).toHaveLength(1);
    const failureEvent = context.instrumentation.actionFailedEvents[0];
    expect(failureEvent.payload.commandCount).toBe(1);
    expect(failureEvent.payload.failureCount).toBe(1);
    expect(failureEvent.payload.successCount).toBe(0);

    const errors = context.accumulator.getErrors();
    expect(errors).toHaveLength(1);
    expect(getErrorMessage(errors[0].error)).toContain(
      'Resolved targets were provided but no valid target identifiers could be extracted.'
    );
    expect(context.accumulator.getActionSummary(actionDef.id)).toEqual(
      expect.objectContaining({ successes: 0, failures: 1 })
    );
  });

  it('handles legacy formatting failures when multi-target execution is disabled', async () => {
    const context = buildStrategyTestContext();
    const actionDef = createActionDefinition();
    const task = createActionFormattingTask({
      actor: context.actor,
      actionWithTargets: {
        actionDef,
        targetContexts: [
          createTargetContext({
            entityId: null,
            displayName: 'Unknown',
          }),
        ],
        resolvedTargets: {
          primary: [{ id: 'target-1', displayName: 'Target One' }],
        },
        targetDefinitions: createTargetDefinitions(),
        isMultiTarget: false,
      },
      formatterOptions: {},
    });

    expect(context.strategy.canFormat(task)).toBe(true);

    await context.strategy.format({
      task,
      instrumentation: context.instrumentation,
      accumulator: context.accumulator,
      createError: context.createError,
      trace: undefined,
    });

    expect(context.instrumentation.actionFailedEvents).toHaveLength(1);
    const failureEvent = context.instrumentation.actionFailedEvents[0];
    expect(failureEvent.payload.formatterMethod).toBe('format');
    expect(failureEvent.payload.failureCount).toBe(1);

    const errors = context.accumulator.getErrors();
    expect(errors).toHaveLength(1);
    expect(getErrorMessage(errors[0].error)).toContain(
      "entityId is missing for action test:per-action"
    );
    expect(context.accumulator.getActionSummary(actionDef.id)).toEqual(
      expect.objectContaining({ successes: 0, failures: 1 })
    );
  });
});
