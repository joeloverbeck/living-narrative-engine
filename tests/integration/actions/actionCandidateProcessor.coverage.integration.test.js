/**
 * @file Additional integration tests for ActionCandidateProcessor to close coverage gaps.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { ActionCandidateProcessor } from '../../../src/actions/actionCandidateProcessor.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import { ActionResult } from '../../../src/actions/core/actionResult.js';
import { ERROR_PHASES } from '../../../src/actions/errors/actionErrorTypes.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createEntityManager = () => ({
  getEntityInstance: jest.fn(),
  getAllComponentTypesForEntity: jest.fn().mockReturnValue([]),
  getComponentData: jest.fn(),
});

const createErrorContextBuilder = () => {
  let counter = 0;
  return {
    buildErrorContext: jest.fn(
      ({
        actionDef,
        actorId,
        error,
        phase,
        targetId = null,
        additionalContext = {},
      }) => ({
        actionId: actionDef?.id ?? 'unknown',
        actorId,
        error,
        phase,
        targetId,
        additionalContext,
        timestamp: 1700000000000 + counter++,
      })
    ),
  };
};

const createTraceWithSpan = () => ({
  withSpan: jest.fn((name, fn) => fn()),
  step: jest.fn(),
  info: jest.fn(),
  success: jest.fn(),
  failure: jest.fn(),
});

const createProcessor = (overrides = {}) => {
  const logger = overrides.logger ?? createLogger();
  const actionErrorContextBuilder =
    overrides.actionErrorContextBuilder ?? createErrorContextBuilder();
  const prerequisiteEvaluationService =
    overrides.prerequisiteEvaluationService ?? {
      evaluate: jest.fn().mockReturnValue(true),
    };
  const targetResolutionService = overrides.targetResolutionService ?? {
    resolveTargets: jest
      .fn()
      .mockReturnValue(ActionResult.success([ActionTargetContext.noTarget()])),
  };
  const commandFormatter = overrides.commandFormatter ?? {
    format: jest.fn().mockReturnValue({ ok: true, value: 'default-command' }),
  };
  const entityManager = overrides.entityManager ?? createEntityManager();
  const safeEventDispatcher = overrides.safeEventDispatcher ?? {
    dispatchSafe: jest.fn(),
  };
  const getEntityDisplayNameFn =
    overrides.getEntityDisplayNameFn ?? ((entity) => entity?.name ?? 'Unknown');

  const processor = new ActionCandidateProcessor({
    prerequisiteEvaluationService,
    targetResolutionService,
    entityManager,
    actionCommandFormatter: commandFormatter,
    safeEventDispatcher,
    getEntityDisplayNameFn,
    logger,
    actionErrorContextBuilder,
  });

  return {
    processor,
    logger,
    actionErrorContextBuilder,
    prerequisiteEvaluationService,
    targetResolutionService,
    commandFormatter,
    entityManager,
    safeEventDispatcher,
  };
};

const createActor = (id = 'actor-1') => ({ id, name: `Actor ${id}` });

const createActionDefinition = (overrides = {}) => ({
  id: 'test:action',
  name: 'Test Action',
  description: 'Testing action candidate processor.',
  scope: 'test:scope',
  prerequisites: [],
  ...overrides,
});

describe('ActionCandidateProcessor coverage scenarios', () => {
  let actor;
  let actionDef;

  beforeEach(() => {
    actor = createActor();
    actionDef = createActionDefinition();
  });

  it('processes candidates within a trace span and aggregates mixed formatter results', () => {
    const commandFormatter = {
      format: jest.fn(),
    };

    const formatFailure = new Error('format failure');
    const thrownFormatterError = new Error('formatter crashed');
    thrownFormatterError.code = 'CRASHED';

    commandFormatter.format
      .mockReturnValueOnce({ ok: true, value: 'command target-1' })
      .mockReturnValueOnce({
        ok: false,
        error: formatFailure,
        details: { reason: 'invalid-target' },
      })
      .mockImplementationOnce(() => {
        throw thrownFormatterError;
      });

    const targetContexts = [
      ActionTargetContext.forEntity('target-1'),
      ActionTargetContext.forEntity('target-2'),
      ActionTargetContext.forEntity('target-3'),
    ];

    const {
      processor,
      actionErrorContextBuilder,
      logger,
      targetResolutionService,
    } = createProcessor({
      commandFormatter,
      targetResolutionService: {
        resolveTargets: jest
          .fn()
          .mockReturnValue(ActionResult.success(targetContexts)),
      },
    });

    const trace = createTraceWithSpan();

    const result = processor.process(
      actionDef,
      actor,
      { actorId: actor.id },
      trace
    );

    expect(trace.withSpan).toHaveBeenCalledWith(
      'candidate.process',
      expect.any(Function),
      expect.objectContaining({
        actionId: actionDef.id,
        actorId: actor.id,
        scope: actionDef.scope,
      })
    );
    expect(commandFormatter.format).toHaveBeenCalledTimes(3);
    expect(commandFormatter.format).toHaveBeenNthCalledWith(
      1,
      actionDef,
      targetContexts[0],
      expect.objectContaining({
        getEntityInstance: expect.any(Function),
      }),
      expect.objectContaining({
        debug: true,
        safeEventDispatcher: expect.any(Object),
      }),
      expect.objectContaining({
        displayNameFn: expect.any(Function),
      })
    );
    expect(result.success).toBe(true);
    expect(result.value.actions).toHaveLength(1);
    expect(result.value.actions[0]).toMatchObject({
      id: actionDef.id,
      command: 'command target-1',
      params: { targetId: 'target-1' },
    });
    expect(result.value.errors).toHaveLength(2);
    expect(actionErrorContextBuilder.buildErrorContext).toHaveBeenCalledTimes(
      2
    );
    expect(logger.warn).toHaveBeenCalledWith(
      `Failed to format command for action '${actionDef.id}' with target 'target-2'.`,
      expect.objectContaining({ targetId: 'target-2' })
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Error formatting action '${actionDef.id}' for target 'target-3'.`,
      expect.objectContaining({ targetId: 'target-3' })
    );
  });

  it('returns prerequisites-failed cause when evaluation returns false without using trace spans', () => {
    actionDef = createActionDefinition({ prerequisites: ['can:act'] });

    const { processor, actionErrorContextBuilder } = createProcessor({
      prerequisiteEvaluationService: {
        evaluate: jest.fn().mockReturnValue(false),
      },
      targetResolutionService: {
        resolveTargets: jest
          .fn()
          .mockReturnValue(
            ActionResult.success([ActionTargetContext.noTarget()])
          ),
      },
    });

    const trace = {
      step: jest.fn(),
      failure: jest.fn(),
    };

    const result = processor.process(
      actionDef,
      actor,
      { actorId: actor.id },
      trace
    );

    expect(result.success).toBe(true);
    expect(result.value.actions).toHaveLength(0);
    expect(result.value.errors).toHaveLength(0);
    expect(result.value.cause).toBe('prerequisites-failed');
    expect(trace.failure).toHaveBeenCalledWith(
      `Action '${actionDef.id}' discarded due to failed actor prerequisites.`,
      'ActionCandidateProcessor.process'
    );
    expect(actionErrorContextBuilder.buildErrorContext).not.toHaveBeenCalled();
  });

  it('wraps prerequisite exceptions with enhanced context', () => {
    actionDef = createActionDefinition({ prerequisites: ['needs:context'] });

    const thrownError = new Error('prerequisite exploded');
    const actionErrorContextBuilder = {
      buildErrorContext: jest
        .fn()
        .mockImplementationOnce(
          ({ actionDef: def, actorId, error, phase }) => ({
            actionId: def.id,
            actorId,
            error,
            phase,
          })
        )
        .mockImplementation(({ actionDef: def, actorId, error, phase }) => ({
          actionId: def.id,
          actorId,
          error,
          phase,
          timestamp: 1800000000000,
        })),
    };

    const { processor, logger } = createProcessor({
      prerequisiteEvaluationService: {
        evaluate: jest.fn(() => {
          throw thrownError;
        }),
      },
      actionErrorContextBuilder,
    });

    const trace = createTraceWithSpan();

    const result = processor.process(
      actionDef,
      actor,
      { actorId: actor.id },
      trace
    );

    expect(result.success).toBe(true);
    expect(result.value.actions).toHaveLength(0);
    expect(result.value.cause).toBe('prerequisite-error');
    expect(result.value.errors).toHaveLength(1);
    expect(result.value.errors[0].error.error).toBe(thrownError);
    expect(actionErrorContextBuilder.buildErrorContext).toHaveBeenCalledTimes(
      2
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Error checking prerequisites for action '${actionDef.id}'.`,
      expect.objectContaining({ actionId: actionDef.id })
    );
  });

  it('converts target resolution failures into contextual errors', () => {
    const existingContextError = new Error('existing context error');
    const existingContext = {
      actionId: actionDef.id,
      error: existingContextError,
      phase: ERROR_PHASES.VALIDATION,
      timestamp: 1900000000000,
    };

    const plainError = new Error('target resolution failed');

    const { processor, actionErrorContextBuilder } = createProcessor({
      targetResolutionService: {
        resolveTargets: jest
          .fn()
          .mockReturnValue(ActionResult.failure([existingContext, plainError])),
      },
    });

    const trace = createTraceWithSpan();

    const result = processor.process(
      actionDef,
      actor,
      { actorId: actor.id },
      trace
    );

    expect(result.success).toBe(true);
    expect(result.value.actions).toHaveLength(0);
    expect(result.value.cause).toBe('resolution-error');
    expect(result.value.errors).toHaveLength(2);
    expect(result.value.errors[0].error).toBe(existingContextError);
    expect(result.value.errors[1].error).toBe(plainError);
    expect(actionErrorContextBuilder.buildErrorContext).toHaveBeenCalledTimes(
      1
    );
  });

  it('captures thrown errors from target resolution with additional scope context', () => {
    const resolutionError = new Error('target service crashed');

    const { processor, actionErrorContextBuilder, logger } = createProcessor({
      targetResolutionService: {
        resolveTargets: jest.fn(() => {
          throw resolutionError;
        }),
      },
    });

    const trace = createTraceWithSpan();

    const result = processor.process(
      actionDef,
      actor,
      { actorId: actor.id },
      trace
    );

    expect(result.success).toBe(true);
    expect(result.value.actions).toHaveLength(0);
    expect(result.value.cause).toBe('resolution-error');
    expect(result.value.errors).toHaveLength(1);
    expect(result.value.errors[0].additionalContext.scope).toBe(
      actionDef.scope
    );
    expect(actionErrorContextBuilder.buildErrorContext).toHaveBeenCalledTimes(
      1
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Error resolving scope for action '${actionDef.id}': ${resolutionError.message}`,
      expect.objectContaining({ actionId: actionDef.id })
    );
  });

  it('logs and exits early when no targets are resolved', () => {
    const { processor, logger } = createProcessor({
      targetResolutionService: {
        resolveTargets: jest.fn().mockReturnValue(ActionResult.success([])),
      },
    });

    const trace = createTraceWithSpan();

    const result = processor.process(
      actionDef,
      actor,
      { actorId: actor.id },
      trace
    );

    expect(result.success).toBe(true);
    expect(result.value.actions).toHaveLength(0);
    expect(result.value.cause).toBe('no-targets');
    expect(logger.debug).toHaveBeenCalledWith(
      `Action '${actionDef.id}' resolved to 0 targets. Skipping.`
    );
  });
});
