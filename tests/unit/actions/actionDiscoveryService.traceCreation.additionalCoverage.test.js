import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';

/**
 *
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
 *
 * @param overrides
 */
function createDependencies(overrides = {}) {
  const logger = overrides.logger ?? createLogger();
  const entityManager = overrides.entityManager ?? {
    getEntityInstance: jest.fn(() => ({ id: 'actor-1', type: 'npc' })),
    getComponentData: jest.fn(() => ({ id: 'actor-1' })),
  };

  const actionPipelineOrchestrator = overrides.actionPipelineOrchestrator ?? {
    discoverActions: jest.fn(async () => ({ actions: [], errors: [] })),
  };

  const traceContextFactory =
    overrides.traceContextFactory ??
    jest.fn(() => ({
      info: jest.fn(),
      getTracedActions: jest.fn(() => new Set()),
    }));

  const getActorLocationFn =
    overrides.getActorLocationFn ?? jest.fn(() => 'fallback-location');

  return {
    entityManager,
    logger,
    actionPipelineOrchestrator,
    traceContextFactory,
    getActorLocationFn,
    ...overrides,
  };
}

describe('ActionDiscoveryService additional coverage', () => {
  beforeEach(() => {
    jest.useRealTimers();
  });

  it('configures optional tracing dependencies and warns on invalid ones', () => {
    const logger = createLogger();
    const dependencies = createDependencies({
      logger,
      actionAwareTraceFactory: jest.fn(() => ({
        captureActionData: jest.fn(),
      })),
      actionTraceFilter: {
        isEnabled: jest.fn(() => true),
        shouldTrace: jest.fn(() => true),
      },
      actionTraceOutputService: { writeTrace: jest.fn(async () => undefined) },
    });

    const service = new ActionDiscoveryService(dependencies);

    expect(service.isActionTracingAvailable()).toBe(true);
    expect(
      logger.debug.mock.calls.some(([message]) =>
        message.includes('Initialized with ActionTraceOutputService')
      )
    ).toBe(true);
    const initializationCall = logger.debug.mock.calls.find(([message]) =>
      message.includes('ActionDiscoveryService initialised')
    );
    expect(initializationCall?.[1]).toMatchObject({
      actionTracingAvailable: true,
      hasActionAwareTraceFactory: true,
      hasActionTraceFilter: true,
    });

    const warnLogger = createLogger();
    new ActionDiscoveryService(
      createDependencies({
        logger: warnLogger,
        actionAwareTraceFactory: {},
        actionTraceFilter: { isEnabled: jest.fn(() => true) },
        actionTraceOutputService: { writeTrace: 'invalid' },
      })
    );

    expect(
      warnLogger.warn.mock.calls.some(([message]) =>
        message.includes('actionAwareTraceFactory must be a function')
      )
    ).toBe(true);
    expect(
      warnLogger.warn.mock.calls.some(([message]) =>
        message.includes('actionTraceFilter missing required methods')
      )
    ).toBe(true);
    expect(
      warnLogger.warn.mock.calls.some(([message]) =>
        message.includes('actionTraceOutputService missing writeTrace method')
      )
    ).toBe(true);
  });

  it('injects discovery context helpers when base context is sparse', async () => {
    const dependencies = createDependencies();
    const { actionPipelineOrchestrator, getActorLocationFn, entityManager } =
      dependencies;
    const service = new ActionDiscoveryService(dependencies);
    const actor = { id: 'hero-7' };

    actionPipelineOrchestrator.discoverActions.mockImplementation(
      async (incomingActor, ctx) => {
        expect(incomingActor).toBe(actor);
        expect(typeof ctx.getActor).toBe('function');
        expect(ctx.getActor()).toBe(actor);
        expect(ctx.currentLocation).toBe('fallback-location');
        return { actions: [{ id: 'action-x' }], errors: [] };
      }
    );

    const result = await service.getValidActions(actor, {});

    expect(result).toEqual({ actions: [{ id: 'action-x' }], errors: [] });
    expect(getActorLocationFn).toHaveBeenCalledWith(actor.id, entityManager);
  });

  it('throws when actor id is missing', async () => {
    const service = new ActionDiscoveryService(createDependencies());
    await expect(service.getValidActions({})).rejects.toThrow(
      'ActionDiscoveryService.getValidActions: actorEntity parameter must be an object with a non-empty id'
    );
  });

  it('delegates discovery through trace.withSpanAsync when provided', async () => {
    const trace = {
      withSpanAsync: jest.fn(async (_span, handler) => handler()),
      info: jest.fn(),
      getTracedActions: jest.fn(() => new Set()),
    };
    const dependencies = createDependencies({
      traceContextFactory: jest.fn(() => trace),
      actionTraceFilter: {
        isEnabled: jest.fn(() => false),
        shouldTrace: jest.fn(() => false),
      },
    });
    const service = new ActionDiscoveryService(dependencies);
    const actor = { id: 'actor-24' };

    await service.getValidActions(actor, { preset: true }, { trace: true });

    expect(trace.withSpanAsync).toHaveBeenCalledWith(
      'action.discover',
      expect.any(Function),
      expect.objectContaining({ actorId: actor.id, withTrace: true })
    );
    expect(trace.info).toHaveBeenCalledWith(
      `Starting action discovery for actor '${actor.id}'.`,
      'getValidActions',
      { withTrace: true }
    );
  });

  it('uses action-aware trace factories when tracing is enabled', async () => {
    const tracedActions = new Set([{ id: 'movement:go' }]);
    const actionAwareTrace = {
      captureActionData: jest.fn(),
      getTracedActions: jest.fn(() => tracedActions),
      getTracingSummary: jest.fn(() => ({ totalStagesTracked: 5 })),
      info: jest.fn(),
    };
    const writeTrace = jest.fn(() => Promise.resolve());
    const dependencies = createDependencies({
      actionAwareTraceFactory: jest.fn(() => actionAwareTrace),
      actionTraceFilter: {
        isEnabled: jest.fn(() => true),
        shouldTrace: jest.fn(() => true),
      },
      actionTraceOutputService: { writeTrace },
    });
    const { logger } = dependencies;
    const service = new ActionDiscoveryService(dependencies);
    const actor = { id: 'actor-trace' };

    await service.getValidActions(actor, {}, { trace: true });

    expect(writeTrace).toHaveBeenCalledWith(actionAwareTrace);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Created ActionAwareStructuredTrace for actor ${actor.id}`
      ),
      expect.objectContaining({ traceType: 'ActionAwareStructuredTrace' })
    );
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Writing discovery trace for actor'),
      expect.objectContaining({ tracedActionCount: tracedActions.size })
    );
  });

  it('logs a warning when discovery trace output fails', async () => {
    const tracedActions = new Set([{ id: 'movement:go' }]);
    const actionAwareTrace = {
      captureActionData: jest.fn(),
      getTracedActions: jest.fn(() => tracedActions),
      getTracingSummary: jest.fn(() => undefined),
      info: jest.fn(),
    };
    const writeError = new Error('storage offline');
    const writeTrace = jest.fn(() => Promise.reject(writeError));
    const dependencies = createDependencies({
      actionAwareTraceFactory: jest.fn(() => actionAwareTrace),
      actionTraceFilter: {
        isEnabled: jest.fn(() => true),
        shouldTrace: jest.fn(() => true),
      },
      actionTraceOutputService: { writeTrace },
    });
    const { logger } = dependencies;
    const service = new ActionDiscoveryService(dependencies);
    const actor = { id: 'actor-trace-error' };

    await service.getValidActions(actor, {}, { trace: true });
    await new Promise((resolve) => setImmediate(resolve));

    expect(writeTrace).toHaveBeenCalledWith(actionAwareTrace);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to write discovery trace'),
      expect.objectContaining({
        error: writeError.message,
        actorId: actor.id,
      })
    );
  });

  it('reports StructuredTrace when action tracing is disabled', async () => {
    const trace = {
      step: jest.fn(),
      info: jest.fn(),
      getTracedActions: jest.fn(() => new Set()),
    };
    const dependencies = createDependencies({
      traceContextFactory: jest.fn(() => trace),
      actionTraceFilter: {
        isEnabled: jest.fn(() => false),
        shouldTrace: jest.fn(() => false),
      },
    });
    const service = new ActionDiscoveryService(dependencies);
    const actor = { id: 'structured' };

    await service.getValidActions(actor, {}, { trace: true });

    expect(dependencies.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(`Created StructuredTrace for actor ${actor.id}`),
      expect.objectContaining({ traceType: 'StructuredTrace' })
    );
  });

  it('falls back to standard trace when creation initially fails', async () => {
    const fallbackTrace = {
      info: jest.fn(),
      getTracedActions: jest.fn(() => new Set()),
    };
    const traceFactoryError = new Error('primary failure');
    const traceContextFactory = jest
      .fn()
      .mockImplementationOnce(() => {
        throw traceFactoryError;
      })
      .mockReturnValue(fallbackTrace);

    const dependencies = createDependencies({
      traceContextFactory,
      actionTraceFilter: {
        isEnabled: jest.fn(() => false),
        shouldTrace: jest.fn(() => false),
      },
    });
    const { actionPipelineOrchestrator, logger } = dependencies;
    const service = new ActionDiscoveryService(dependencies);
    const actor = { id: 'actor-fallback' };

    await service.getValidActions(actor, {}, { trace: true });

    expect(traceContextFactory).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to create trace context'),
      traceFactoryError
    );
    const [, , options] =
      actionPipelineOrchestrator.discoverActions.mock.calls[0];
    expect(options.trace).toBe(fallbackTrace);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(`Created UnknownTrace for actor ${actor.id}`),
      expect.objectContaining({ traceType: 'UnknownTrace' })
    );
  });

  it('returns null trace when both primary and fallback creation fail', async () => {
    const traceFactoryError = new Error('unavailable');
    const traceContextFactory = jest.fn(() => {
      throw traceFactoryError;
    });

    const dependencies = createDependencies({
      traceContextFactory,
      actionTraceFilter: {
        isEnabled: jest.fn(() => false),
        shouldTrace: jest.fn(() => false),
      },
    });
    const { actionPipelineOrchestrator, logger } = dependencies;
    const service = new ActionDiscoveryService(dependencies);
    const actor = { id: 'actor-null-trace' };

    await service.getValidActions(actor, {}, { trace: true });

    expect(traceContextFactory).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to create fallback trace context'),
      traceFactoryError
    );
    const [, , options] =
      actionPipelineOrchestrator.discoverActions.mock.calls[0];
    expect(options.trace).toBeNull();
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(`Finished action discovery for actor ${actor.id}`)
    );
  });

  it('treats trace filter errors as tracing disabled and reports status', async () => {
    const filterError = new Error('filter failure');
    const dependencies = createDependencies({
      actionTraceFilter: {
        isEnabled: jest.fn(() => {
          throw filterError;
        }),
        shouldTrace: jest.fn(),
      },
    });
    const { logger } = dependencies;
    const service = new ActionDiscoveryService(dependencies);
    const actor = { id: 'actor-status' };

    await service.getValidActions(actor);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Error checking action tracing status, assuming disabled'
      ),
      filterError
    );
    expect(service.getActionTracingStatus()).toEqual({
      available: false,
      enabled: false,
      hasFilter: true,
      hasFactory: false,
    });
  });
});
