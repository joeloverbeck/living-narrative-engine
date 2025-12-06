/**
 * @file Integration tests for optional tracing configuration in ActionDiscoveryService.
 * @description Exercises tracing-related branches including factory validation, trace creation fallbacks,
 * and output service interactions to improve coverage for action discovery orchestration.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';
import { InvalidActorEntityError } from '../../../src/errors/invalidActorEntityError.js';

/**
 * Utility helper to await pending promise microtasks.
 *
 * @returns {Promise<void>}
 */
async function flushAsyncTasks() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * Creates a baseline set of dependencies for ActionDiscoveryService with overridable members.
 *
 * @param {object} [overrides]
 * @returns {{
 *   service: ActionDiscoveryService,
 *   logger: ReturnType<typeof createLogger>,
 *   actionPipelineOrchestrator: { discoverActions: jest.Mock },
 *   entityManager: { getEntityInstance: jest.Mock },
 *   traceContextFactory: jest.Mock,
 *   actor: { id: string, components: object }
 * }}
 */
function createService(overrides = {}) {
  const logger = createLogger();
  const actor = {
    id: 'actor-1',
    components: {
      'core:location': { value: 'atrium' },
    },
  };

  const entityManager = {
    getEntityInstance: jest.fn((entityId) => {
      if (entityId === actor.id) {
        return actor;
      }
      return null;
    }),
  };

  const defaultTraceContextFactory = jest
    .fn()
    .mockReturnValue(createStandardTrace({ withSpanAsync: false }));

  const dependencies = {
    entityManager,
    logger,
    actionPipelineOrchestrator: {
      discoverActions: jest.fn(async (_actor, _context, options = {}) => ({
        actions: [],
        errors: [],
        trace: options.trace ?? null,
      })),
    },
    traceContextFactory: defaultTraceContextFactory,
    getActorLocationFn: jest.fn(() => 'atrium'),
    ...overrides,
  };

  const service = new ActionDiscoveryService(dependencies);

  return {
    service,
    logger,
    actionPipelineOrchestrator: dependencies.actionPipelineOrchestrator,
    entityManager,
    traceContextFactory: dependencies.traceContextFactory,
    actor,
  };
}

/**
 * Creates a stub logger used across tests.
 */
function createLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 * Builds a trace stub with optional capabilities.
 *
 * @param {object} [options]
 * @param {boolean} [options.withSpanAsync]
 * @param {Map<string, object>} [options.tracedActions]
 * @returns {object}
 */
function createStandardTrace({
  withSpanAsync = true,
  tracedActions = null,
} = {}) {
  const traced = tracedActions ?? new Map();
  const baseTrace = {
    info: jest.fn(),
    step: jest.fn(),
    getTracingSummary: jest.fn(() => ({
      totalStagesTracked: 0,
      sessionDuration: 0,
    })),
    getTracedActions: jest.fn(() => traced),
    captureActionData: jest.fn(),
  };

  if (withSpanAsync) {
    baseTrace.withSpanAsync = jest.fn(async (_span, fn) => {
      return fn();
    });
  }

  return baseTrace;
}

describe('ActionDiscoveryService optional tracing integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('logs warnings when optional tracing dependencies are invalid', () => {
    const { logger } = createService({
      actionAwareTraceFactory: { not: 'a-function' },
      actionTraceFilter: { isEnabled: null },
      actionTraceOutputService: { writeTrace: 'oops' },
    });

    expect(logger.warn).toHaveBeenCalledWith(
      'ActionDiscoveryService: ActionDiscoveryService: actionAwareTraceFactory must be a function, ignoring'
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'ActionDiscoveryService: ActionDiscoveryService: actionTraceFilter missing required methods, ignoring'
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'ActionDiscoveryService: ActionDiscoveryService: actionTraceOutputService missing writeTrace method, ignoring'
    );
  });

  it('utilises action-aware trace factory when enabled and handles trace output failures', async () => {
    const tracedActions = new Map([
      [
        'movement:go',
        {
          actionId: 'movement:go',
          actorId: 'actor-1',
          stages: { pipeline: { steps: [] } },
        },
      ],
    ]);

    const actionAwareTrace = createStandardTrace({ tracedActions });

    const actionTraceOutputService = {
      writeTrace: jest.fn().mockRejectedValue(new Error('disk full')),
    };

    const actionAwareTraceFactory = jest.fn(() => actionAwareTrace);
    const actionTraceFilter = {
      isEnabled: jest.fn(() => true),
      shouldTrace: jest.fn(() => true),
    };

    const overrides = {
      actionAwareTraceFactory,
      actionTraceFilter,
      actionTraceOutputService,
      traceContextFactory: jest
        .fn()
        .mockReturnValue(createStandardTrace({ withSpanAsync: true })),
      actionPipelineOrchestrator: {
        discoverActions: jest.fn(async (_actor, _context, { trace }) => ({
          actions: [{ id: 'movement:go' }],
          errors: [],
          trace,
        })),
      },
    };

    const { service, logger, actionPipelineOrchestrator, actor } =
      createService(overrides);

    const result = await service.getValidActions(
      actor,
      { mood: 'focused' },
      { trace: true }
    );

    expect(actionTraceFilter.isEnabled).toHaveBeenCalled();
    expect(actionAwareTraceFactory).toHaveBeenCalledWith({
      actorId: actor.id,
      enableActionTracing: true,
      context: expect.objectContaining({ discoveryOptions: { trace: true } }),
    });

    expect(actionAwareTrace.withSpanAsync).toHaveBeenCalled();
    expect(actionPipelineOrchestrator.discoverActions).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        getActor: expect.any(Function),
        currentLocation: 'atrium',
      }),
      { trace: actionAwareTrace }
    );

    expect(result).toEqual({
      actions: [{ id: 'movement:go' }],
      errors: [],
      trace: actionAwareTrace,
    });

    await flushAsyncTasks();

    expect(logger.debug).toHaveBeenCalledWith(
      'ActionDiscoveryService: Action discovery completed for actor actor-1 with action tracing',
      expect.objectContaining({ tracedActionCount: tracedActions.size })
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'ActionDiscoveryService: Failed to write discovery trace',
      expect.objectContaining({ actorId: actor.id })
    );
  });

  it('falls back to standard trace when action tracing is unavailable and logs completion succinctly', async () => {
    const traceWithoutSpan = createStandardTrace({ withSpanAsync: false });
    traceWithoutSpan.getTracedActions = undefined;

    const overrides = {
      traceContextFactory: jest.fn(() => traceWithoutSpan),
    };

    const { service, logger, actionPipelineOrchestrator, actor } =
      createService(overrides);

    const result = await service.getValidActions(actor, undefined, {
      trace: true,
    });

    expect(actionPipelineOrchestrator.discoverActions).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ currentLocation: 'atrium' }),
      { trace: traceWithoutSpan }
    );

    expect(logger.debug).toHaveBeenCalledWith(
      `ActionDiscoveryService: Finished action discovery for actor ${actor.id}. Found 0 actions.`
    );

    expect(result).toEqual({
      actions: [],
      errors: [],
      trace: traceWithoutSpan,
    });
  });

  it('reports tracing availability even when filter errors during enablement checks', () => {
    const actionTraceFilter = {
      isEnabled: jest.fn(() => {
        throw new Error('filter failed');
      }),
      shouldTrace: jest.fn(() => true),
    };

    const { service, logger } = createService({
      actionAwareTraceFactory: jest.fn(() => createStandardTrace()),
      actionTraceFilter,
    });

    const status = service.getActionTracingStatus();

    expect(status).toEqual({
      available: true,
      enabled: false,
      hasFilter: true,
      hasFactory: true,
    });

    expect(logger.warn).toHaveBeenCalledWith(
      'ActionDiscoveryService: Error checking action tracing status, assuming disabled',
      expect.any(Error)
    );
  });

  it('falls back to standard trace when the action-aware factory throws', async () => {
    const fallbackTrace = createStandardTrace({ withSpanAsync: false });
    const traceContextFactory = jest.fn(() => fallbackTrace);

    const { service, logger, actor } = createService({
      actionAwareTraceFactory: jest.fn(() => {
        throw new Error('factory failure');
      }),
      actionTraceFilter: {
        isEnabled: jest.fn(() => true),
        shouldTrace: jest.fn(() => true),
      },
      traceContextFactory,
    });

    const result = await service.getValidActions(
      actor,
      { reason: 'fallback' },
      { trace: true }
    );

    expect(traceContextFactory).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'ActionDiscoveryService: Failed to create trace context for actor actor-1'
      ),
      expect.any(Error)
    );
    expect(result.trace).toBe(fallbackTrace);
  });

  it('returns null trace when fallback creation also fails', async () => {
    const traceContextFactory = jest.fn(() => {
      throw new Error('fallback failed');
    });

    const { service, logger, actor } = createService({
      actionAwareTraceFactory: jest.fn(() => {
        throw new Error('primary failure');
      }),
      actionTraceFilter: {
        isEnabled: jest.fn(() => true),
        shouldTrace: jest.fn(() => true),
      },
      traceContextFactory,
    });

    const result = await service.getValidActions(
      actor,
      { reason: 'no-trace' },
      { trace: true }
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'ActionDiscoveryService: Failed to create fallback trace context for actor actor-1'
      ),
      expect.any(Error)
    );
    expect(result.trace).toBeNull();
  });

  it('throws when provided actor entity is invalid', async () => {
    const { service } = createService();

    await expect(
      service.getValidActions({ id: '' }, { mood: 'lost' })
    ).rejects.toBeInstanceOf(InvalidActorEntityError);
  });

  it('rejects when base context is not an object', async () => {
    const { service, actor } = createService();

    await expect(
      service.getValidActions(actor, 'not-an-object')
    ).rejects.toThrow(
      'ActionDiscoveryService.getValidActions: baseContext must be an object when provided'
    );
  });
});
