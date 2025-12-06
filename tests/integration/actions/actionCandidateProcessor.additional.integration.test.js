import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ActionCandidateProcessor } from '../../../src/actions/actionCandidateProcessor.js';
import { ActionResult } from '../../../src/actions/core/actionResult.js';
import { ERROR_PHASES } from '../../../src/actions/errors/actionErrorTypes.js';

const createProcessor = (overrides = {}) => {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const defaultDeps = {
    prerequisiteEvaluationService: {
      evaluate: jest.fn().mockReturnValue(true),
    },
    targetResolutionService: {
      resolveTargets: jest
        .fn()
        .mockReturnValue(
          ActionResult.success([{ entityId: 'default-target' }])
        ),
    },
    entityManager: {
      getEntityInstance: jest.fn((id) => ({ id, name: id })),
      getAllComponentTypesForEntity: jest.fn(() => []),
      getComponentData: jest.fn(() => ({})),
      hasComponent: jest.fn(() => true),
      getEntitiesWithComponent: jest.fn(() => []),
    },
    actionCommandFormatter: {
      format: jest.fn().mockReturnValue({ ok: true, value: 'do-something' }),
    },
    safeEventDispatcher: { dispatch: jest.fn() },
    getEntityDisplayNameFn: jest.fn(
      (entity) => entity?.name ?? entity?.id ?? 'Unknown'
    ),
    logger,
    actionErrorContextBuilder: {
      buildErrorContext: jest.fn(
        ({
          error,
          actionDef,
          actorId,
          phase,
          targetId = null,
          additionalContext,
        }) => ({
          timestamp: 111,
          actionId: actionDef.id,
          actorId,
          phase,
          error,
          targetId,
          additionalContext,
        })
      ),
    },
  };

  const deps = {
    ...defaultDeps,
    ...overrides,
  };

  const processor = new ActionCandidateProcessor({
    prerequisiteEvaluationService: deps.prerequisiteEvaluationService,
    targetResolutionService: deps.targetResolutionService,
    entityManager: deps.entityManager,
    actionCommandFormatter: deps.actionCommandFormatter,
    safeEventDispatcher: deps.safeEventDispatcher,
    getEntityDisplayNameFn: deps.getEntityDisplayNameFn,
    logger: deps.logger,
    actionErrorContextBuilder: deps.actionErrorContextBuilder,
  });

  return { processor, deps };
};

const baseActor = { id: 'actor-1', name: 'Test Actor' };
const baseContext = { actorId: baseActor.id, locationId: 'loc-1' };

describe('ActionCandidateProcessor integration coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('processes actions and wraps execution in trace spans when available', () => {
    const { processor, deps } = createProcessor();
    const actionDef = {
      id: 'test:action',
      name: 'Test Action',
      description: 'Demo action',
      scope: 'test:scope',
      prerequisites: [],
    };

    const trace = {
      withSpan: jest.fn((name, fn, metadata) => {
        expect(name).toBe('candidate.process');
        expect(metadata).toEqual({
          actionId: actionDef.id,
          actorId: baseActor.id,
          scope: actionDef.scope,
        });
        return fn();
      }),
      step: jest.fn(),
      success: jest.fn(),
      failure: jest.fn(),
      info: jest.fn(),
    };

    const result = processor.process(actionDef, baseActor, baseContext, trace);

    expect(result.success).toBe(true);
    expect(result.value.actions).toHaveLength(1);
    expect(result.value.errors).toHaveLength(0);
    expect(deps.actionCommandFormatter.format).toHaveBeenCalledWith(
      actionDef,
      { entityId: 'default-target' },
      deps.entityManager,
      expect.objectContaining({
        logger: deps.logger,
        safeEventDispatcher: deps.safeEventDispatcher,
        debug: true,
      }),
      { displayNameFn: deps.getEntityDisplayNameFn }
    );
    expect(trace.withSpan).toHaveBeenCalledTimes(1);
    expect(trace.step).toHaveBeenCalledWith(
      "Processing candidate action: 'test:action'",
      'ActionCandidateProcessor.process'
    );
    expect(trace.success).toHaveBeenCalledWith(
      "Action 'test:action' passed actor prerequisite check.",
      'ActionCandidateProcessor.process'
    );
    expect(trace.info).toHaveBeenCalledWith(
      "Scope for action 'test:action' resolved to 1 targets.",
      'ActionCandidateProcessor.process',
      { targets: ['default-target'] }
    );
  });

  it('returns prerequisites-failed when evaluation reports unmet prerequisites', () => {
    const { processor } = createProcessor({
      prerequisiteEvaluationService: {
        evaluate: jest.fn().mockReturnValue(false),
      },
    });

    const actionDef = {
      id: 'test:blocked',
      name: 'Blocked Action',
      description: 'Requires unmet state',
      scope: 'test:scope',
      prerequisites: [{ id: 'needs-something' }],
    };

    const trace = {
      step: jest.fn(),
      success: jest.fn(),
      failure: jest.fn(),
      info: jest.fn(),
    };

    const result = processor.process(actionDef, baseActor, baseContext, trace);

    expect(result.success).toBe(true);
    expect(result.value.actions).toHaveLength(0);
    expect(result.value.cause).toBe('prerequisites-failed');
    expect(trace.failure).toHaveBeenCalledWith(
      "Action 'test:blocked' discarded due to failed actor prerequisites.",
      'ActionCandidateProcessor.process'
    );
  });

  it('converts prerequisite evaluation exceptions into structured error contexts', () => {
    const thrownError = new Error('prerequisite crash');
    const { processor, deps } = createProcessor({
      prerequisiteEvaluationService: {
        evaluate: jest.fn(() => {
          throw thrownError;
        }),
      },
    });

    const actionDef = {
      id: 'test:exceptional-prereq',
      name: 'Exceptional',
      description: 'Throws on check',
      scope: 'test:scope',
      prerequisites: [{ id: 'dangerous' }],
    };

    const result = processor.process(actionDef, baseActor, baseContext);

    expect(result.success).toBe(true);
    expect(result.value.actions).toHaveLength(0);
    expect(result.value.cause).toBe('prerequisite-error');
    expect(result.value.errors[0]).toEqual(
      expect.objectContaining({
        actionId: actionDef.id,
        phase: ERROR_PHASES.VALIDATION,
      })
    );
    expect(deps.logger.error).toHaveBeenCalledWith(
      "Error checking prerequisites for action 'test:exceptional-prereq'.",
      expect.objectContaining({ actionId: actionDef.id })
    );
  });

  it('converts existing ActionErrorContext entries from target resolution failures', () => {
    const errorContext = {
      timestamp: 222,
      phase: ERROR_PHASES.VALIDATION,
      error: new Error('Target exploded'),
      actionId: 'test:action',
      actorId: baseActor.id,
    };

    const { processor } = createProcessor({
      targetResolutionService: {
        resolveTargets: jest
          .fn()
          .mockReturnValue(ActionResult.failure([errorContext])),
      },
    });

    const actionDef = {
      id: 'test:action',
      name: 'Test Action',
      description: 'Demo action',
      scope: 'test:scope',
      prerequisites: [],
    };

    const result = processor.process(actionDef, baseActor, baseContext);

    expect(result.success).toBe(true);
    expect(result.value.actions).toHaveLength(0);
    expect(result.value.cause).toBe('resolution-error');
    expect(result.value.errors[0]).toEqual(
      expect.objectContaining({
        timestamp: 222,
        error: errorContext.error,
      })
    );
  });

  it('builds error context when target resolution returns raw errors', () => {
    const rawError = new Error('scope lookup failed');
    const { processor, deps } = createProcessor({
      targetResolutionService: {
        resolveTargets: jest
          .fn()
          .mockReturnValue(ActionResult.failure(rawError)),
      },
    });

    const actionDef = {
      id: 'test:action',
      name: 'Test Action',
      description: 'Demo action',
      scope: 'test:scope',
      prerequisites: [],
    };

    const result = processor.process(actionDef, baseActor, baseContext);

    expect(result.success).toBe(true);
    expect(result.value.actions).toHaveLength(0);
    expect(result.value.cause).toBe('resolution-error');
    expect(result.value.errors[0]).toEqual(
      expect.objectContaining({ actionId: actionDef.id })
    );
    expect(
      deps.actionErrorContextBuilder.buildErrorContext
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        error: rawError,
        additionalContext: { scope: actionDef.scope },
      })
    );
  });

  it('captures exceptions thrown by the target resolution service', () => {
    const thrown = new Error('resolution exception');
    const { processor, deps } = createProcessor({
      targetResolutionService: {
        resolveTargets: jest.fn(() => {
          throw thrown;
        }),
      },
    });

    const actionDef = {
      id: 'test:action',
      name: 'Test Action',
      description: 'Demo action',
      scope: 'test:scope',
      prerequisites: [],
    };

    const result = processor.process(actionDef, baseActor, baseContext);

    expect(result.success).toBe(true);
    expect(result.value.cause).toBe('resolution-error');
    expect(result.value.errors[0]).toEqual(
      expect.objectContaining({ actionId: actionDef.id })
    );
    expect(deps.logger.error).toHaveBeenCalledWith(
      "Error resolving scope for action 'test:action': resolution exception",
      expect.objectContaining({ actionId: actionDef.id })
    );
  });

  it('returns a no-targets cause when the scope resolves to zero entities', () => {
    const { processor, deps } = createProcessor({
      targetResolutionService: {
        resolveTargets: jest.fn().mockReturnValue(ActionResult.success([])),
      },
    });

    const actionDef = {
      id: 'test:action',
      name: 'Test Action',
      description: 'Demo action',
      scope: 'test:scope',
      prerequisites: [],
    };

    const result = processor.process(actionDef, baseActor, baseContext);

    expect(result.success).toBe(true);
    expect(result.value.actions).toHaveLength(0);
    expect(result.value.cause).toBe('no-targets');
    expect(deps.logger.debug).toHaveBeenCalledWith(
      "Action 'test:action' resolved to 0 targets. Skipping."
    );
  });

  it('collects formatting errors when the formatter returns failure results', () => {
    const formatError = new Error('bad formatting');
    const { processor, deps } = createProcessor({
      targetResolutionService: {
        resolveTargets: jest
          .fn()
          .mockReturnValue(
            ActionResult.success([{ entityId: 't-1' }, { entityId: 't-2' }])
          ),
      },
      actionCommandFormatter: {
        format: jest
          .fn()
          .mockReturnValueOnce({
            ok: false,
            error: formatError,
            details: { reason: 'invalid' },
          })
          .mockReturnValueOnce({ ok: true, value: 'follow t-2' }),
      },
    });

    const actionDef = {
      id: 'test:action',
      name: 'Test Action',
      description: 'Demo action',
      scope: 'test:scope',
      prerequisites: [],
    };

    const result = processor.process(actionDef, baseActor, baseContext);

    expect(result.success).toBe(true);
    expect(result.value.actions).toHaveLength(1);
    expect(result.value.errors).toHaveLength(1);
    expect(result.value.errors[0]).toEqual(
      expect.objectContaining({
        error: formatError,
        targetId: 't-1',
      })
    );
    expect(
      deps.actionErrorContextBuilder.buildErrorContext
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        additionalContext: { formatDetails: { reason: 'invalid' } },
      })
    );
  });

  it('captures formatter exceptions and logs them with context', () => {
    const thrown = new Error('formatter exploded');
    const { processor, deps } = createProcessor({
      targetResolutionService: {
        resolveTargets: jest
          .fn()
          .mockReturnValue(ActionResult.success([{ entityId: 't-1' }])),
      },
      actionCommandFormatter: {
        format: jest.fn(() => {
          throw thrown;
        }),
      },
    });

    const actionDef = {
      id: 'test:action',
      name: 'Test Action',
      description: 'Demo action',
      scope: 'test:scope',
      prerequisites: [],
    };

    const result = processor.process(actionDef, baseActor, baseContext);

    expect(result.success).toBe(true);
    expect(result.value.actions).toHaveLength(0);
    expect(result.value.errors).toHaveLength(1);
    expect(result.value.errors[0]).toEqual(
      expect.objectContaining({ targetId: 't-1' })
    );
    expect(deps.logger.error).toHaveBeenCalledWith(
      "Error formatting action 'test:action' for target 't-1'.",
      expect.objectContaining({ actionId: actionDef.id })
    );
  });
});
