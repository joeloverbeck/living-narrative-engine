import { describe, it, expect, jest } from '@jest/globals';
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';
import { InvalidActorEntityError } from '../../../src/errors/invalidActorEntityError.js';

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
function createService(overrides = {}) {
  const logger = overrides.logger ?? createLogger();
  const entityManager = overrides.entityManager ?? {
    getEntityInstance: jest.fn(),
  };
  const actionPipelineOrchestrator = overrides.actionPipelineOrchestrator ?? {
    discoverActions: jest.fn().mockResolvedValue({
      actions: [],
      errors: [],
    }),
  };
  const traceContextFactory =
    overrides.traceContextFactory ??
    jest.fn(() => ({
      info: jest.fn(),
      getTracedActions: jest.fn(() => new Set()),
      getTracingSummary: jest.fn(() => ({})),
    }));
  const getActorLocationFn =
    overrides.getActorLocationFn ?? jest.fn(() => 'default-location');
  const serviceSetup = overrides.serviceSetup ?? {
    setupService: jest.fn(() => logger),
  };

  const service = new ActionDiscoveryService({
    entityManager,
    logger,
    actionPipelineOrchestrator,
    traceContextFactory,
    getActorLocationFn,
    serviceSetup,
    ...overrides,
  });

  return {
    service,
    logger,
    entityManager,
    actionPipelineOrchestrator,
    traceContextFactory,
    getActorLocationFn,
    serviceSetup,
  };
}

describe('ActionDiscoveryService optional dependency handling', () => {
  it('warns when optional dependencies are invalid', () => {
    const logger = createLogger();

    createService({
      logger,
      actionAwareTraceFactory: {},
      actionTraceFilter: { isEnabled: jest.fn() },
      actionTraceOutputService: { writeTrace: null },
    });

    expect(logger.warn).toHaveBeenCalledWith(
      'ActionDiscoveryService: actionAwareTraceFactory must be a function, ignoring'
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'ActionDiscoveryService: actionTraceFilter missing required methods, ignoring'
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'ActionDiscoveryService: actionTraceOutputService missing writeTrace method, ignoring'
    );
  });

  it('configures optional tracing dependencies when valid', () => {
    const logger = createLogger();
    const actionAwareTraceFactory = jest.fn(() => ({
      captureActionData: jest.fn(),
    }));
    const actionTraceFilter = {
      isEnabled: jest.fn(() => true),
      shouldTrace: jest.fn(() => true),
    };
    const actionTraceOutputService = {
      writeTrace: jest.fn(() => Promise.resolve()),
    };

    const { service } = createService({
      logger,
      actionAwareTraceFactory,
      actionTraceFilter,
      actionTraceOutputService,
    });

    expect(service.isActionTracingAvailable()).toBe(true);
    expect(service.getActionTracingStatus()).toEqual({
      available: true,
      enabled: true,
      hasFilter: true,
      hasFactory: true,
    });
    expect(logger.debug).toHaveBeenCalledWith(
      'ActionDiscoveryService: Initialized with ActionTraceOutputService'
    );
  });

  it('falls back to default service setup and location helper when omitted', () => {
    const logger = createLogger();
    const entityManager = { getEntityInstance: jest.fn() };
    const actionPipelineOrchestrator = {
      discoverActions: jest.fn().mockResolvedValue({ actions: [], errors: [] }),
    };
    const traceContextFactory = jest.fn(() => ({ info: jest.fn() }));

    const service = new ActionDiscoveryService({
      entityManager,
      logger,
      actionPipelineOrchestrator,
      traceContextFactory,
    });

    expect(service).toBeInstanceOf(ActionDiscoveryService);
    expect(traceContextFactory).not.toHaveBeenCalled();
  });
});

describe('ActionDiscoveryService.getValidActions tracing behaviour', () => {
  it('throws InvalidActorEntityError when actor is invalid', async () => {
    const logger = createLogger();
    const { service } = createService({ logger });

    await expect(service.getValidActions(null)).rejects.toBeInstanceOf(
      InvalidActorEntityError
    );
    expect(logger.error).toHaveBeenCalledWith(
      'ActionDiscoveryService.getValidActions: actorEntity parameter must be an object with a non-empty id',
      { actorEntity: null }
    );
  });

  it('wraps discovery in trace span when withSpanAsync is available', async () => {
    const logger = createLogger();
    const actor = { id: 'hero-1' };
    const captured = {};
    const trace = {
      captureActionData: jest.fn(),
      withSpanAsync: jest.fn(async (name, fn, metadata) => {
        captured.span = { name, metadata };
        return fn();
      }),
      info: jest.fn(),
      getTracedActions: jest.fn(() => new Set()),
      getTracingSummary: jest.fn(() => ({
        totalStagesTracked: 0,
        sessionDuration: 0,
      })),
    };

    const actionAwareTraceFactory = jest.fn(() => trace);
    const actionTraceFilter = {
      isEnabled: jest.fn(() => true),
      shouldTrace: jest.fn(() => true),
    };

    const actionPipelineOrchestrator = {
      discoverActions: jest.fn().mockResolvedValue({ actions: [], errors: [] }),
    };

    const { service } = createService({
      logger,
      actionAwareTraceFactory,
      actionTraceFilter,
      actionPipelineOrchestrator,
    });

    await service.getValidActions(actor, {}, { trace: true });

    expect(trace.withSpanAsync).toHaveBeenCalledTimes(1);
    expect(captured.span.name).toBe('action.discover');
    expect(captured.span.metadata).toEqual({
      actorId: actor.id,
      withTrace: true,
    });
    expect(trace.info).toHaveBeenCalledWith(
      "Starting action discovery for actor 'hero-1'.",
      'getValidActions',
      { withTrace: true }
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'Created ActionAwareStructuredTrace for actor hero-1',
      { actorId: actor.id, traceType: 'ActionAwareStructuredTrace' }
    );
    expect(actionPipelineOrchestrator.discoverActions).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ currentLocation: 'default-location' }),
      { trace }
    );
  });

  it('falls back to internal discovery when trace lacks withSpanAsync', async () => {
    const logger = createLogger();
    const actor = { id: 'explorer' };
    const trace = {
      step: jest.fn(),
      info: jest.fn(),
      getTracedActions: jest.fn(() => new Set()),
      getTracingSummary: jest.fn(() => ({})),
    };
    const traceContextFactory = jest.fn(() => trace);
    const actionPipelineOrchestrator = {
      discoverActions: jest.fn().mockResolvedValue({ actions: [], errors: [] }),
    };

    const { service } = createService({
      logger,
      traceContextFactory,
      actionPipelineOrchestrator,
    });

    await service.getValidActions(actor, {}, { trace: true });

    expect(trace.info).toHaveBeenCalledWith(
      "Starting action discovery for actor 'explorer'.",
      'getValidActions',
      { withTrace: true }
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'Created StructuredTrace for actor explorer',
      { actorId: actor.id, traceType: 'StructuredTrace' }
    );
    expect(actionPipelineOrchestrator.discoverActions).toHaveBeenCalledWith(
      actor,
      expect.any(Object),
      { trace }
    );
  });

  it('validates baseContext and throws when it is not an object', async () => {
    const logger = createLogger();
    const actor = { id: 'validator' };
    const { service } = createService({ logger });

    await expect(service.getValidActions(actor, 'invalid')).rejects.toThrow(
      'ActionDiscoveryService.getValidActions: baseContext must be an object when provided'
    );
    expect(logger.error).toHaveBeenCalledWith(
      'ActionDiscoveryService.getValidActions: baseContext must be an object when provided',
      { baseContext: 'invalid' }
    );
  });

  it('populates discovery context with actor helpers and location', async () => {
    const logger = createLogger();
    const actor = { id: 'scout' };
    const capturedContexts = [];
    const getActorLocationFn = jest.fn(() => 'generated-location');
    const actionPipelineOrchestrator = {
      discoverActions: jest.fn(async (_actor, context) => {
        capturedContexts.push(context);
        return { actions: [], errors: [] };
      }),
    };

    const { service, entityManager } = createService({
      logger,
      getActorLocationFn,
      actionPipelineOrchestrator,
    });

    await service.getValidActions(actor, {});

    expect(getActorLocationFn).toHaveBeenCalledWith(actor.id, entityManager);
    expect(capturedContexts[0].getActor()).toBe(actor);
    expect(capturedContexts[0].currentLocation).toBe('generated-location');

    const existingContext = {
      getActor: () => 'custom-actor',
      currentLocation: 'preset-location',
    };

    getActorLocationFn.mockClear();
    await service.getValidActions(actor, existingContext);

    expect(getActorLocationFn).not.toHaveBeenCalled();
    expect(capturedContexts[1].getActor).toBe(existingContext.getActor);
    expect(capturedContexts[1].currentLocation).toBe('preset-location');
  });
});

describe('ActionDiscoveryService tracing results', () => {
  it('logs tracing summary and writes discovery trace when available', async () => {
    const logger = createLogger();
    const actor = { id: 'bard' };
    const tracedActions = new Set(['a']);
    const writeTrace = jest.fn(() => Promise.reject(new Error('disk full')));
    const trace = {
      captureActionData: jest.fn(),
      withSpanAsync: jest.fn(async (_name, fn) => fn()),
      info: jest.fn(),
      getTracedActions: jest.fn(() => tracedActions),
      getTracingSummary: undefined,
    };

    const actionAwareTraceFactory = jest.fn(() => trace);
    const actionTraceFilter = {
      isEnabled: jest.fn(() => true),
      shouldTrace: jest.fn(() => true),
    };

    const { service } = createService({
      logger,
      actionAwareTraceFactory,
      actionTraceFilter,
      actionTraceOutputService: { writeTrace },
    });

    await service.getValidActions(actor, {}, { trace: true });
    await Promise.resolve();
    await Promise.resolve();

    expect(logger.debug).toHaveBeenCalledWith(
      `Action discovery completed for actor ${actor.id} with action tracing`,
      expect.objectContaining({
        actorId: actor.id,
        tracedActionCount: tracedActions.size,
        totalStagesTracked: 0,
        sessionDuration: 0,
      })
    );
    expect(writeTrace).toHaveBeenCalledWith(trace);
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to write discovery trace',
      {
        error: 'disk full',
        actorId: actor.id,
      }
    );
  });

  it('logs simple completion message when trace data is unavailable', async () => {
    const logger = createLogger();
    const actor = { id: 'ranger' };
    const actionPipelineOrchestrator = {
      discoverActions: jest.fn(async () => ({ actions: [], errors: [] })),
    };

    const { service } = createService({ logger, actionPipelineOrchestrator });

    await service.getValidActions(actor);

    expect(logger.debug).toHaveBeenCalledWith(
      `Finished action discovery for actor ${actor.id}. Found 0 actions.`
    );
  });
});

describe('ActionDiscoveryService trace context creation failures', () => {
  it('falls back to standard trace when action-aware factory throws', async () => {
    const logger = createLogger();
    const actor = { id: 'mage' };
    const trace = {
      info: jest.fn(),
      getTracedActions: jest.fn(() => new Set()),
      getTracingSummary: jest.fn(() => ({})),
    };
    const traceContextFactory = jest.fn(() => trace);
    const actionAwareTraceFactory = jest.fn(() => {
      throw new Error('factory failure');
    });
    const actionTraceFilter = {
      isEnabled: jest.fn(() => true),
      shouldTrace: jest.fn(() => true),
    };

    const { service } = createService({
      logger,
      traceContextFactory,
      actionAwareTraceFactory,
      actionTraceFilter,
    });

    await service.getValidActions(actor, {}, { trace: true });

    expect(logger.error).toHaveBeenCalledWith(
      `Failed to create trace context for actor ${actor.id}, falling back to standard trace`,
      expect.any(Error)
    );
    expect(traceContextFactory).toHaveBeenCalledTimes(1);
  });

  it('returns null trace when both action-aware and fallback creation fail', async () => {
    const logger = createLogger();
    const actor = { id: 'alchemist' };
    const actionAwareTraceFactory = jest.fn(() => {
      throw new Error('primary failure');
    });
    const traceContextFactory = jest.fn(() => {
      throw new Error('fallback failure');
    });
    const actionTraceFilter = {
      isEnabled: jest.fn(() => true),
      shouldTrace: jest.fn(() => true),
    };
    const actionPipelineOrchestrator = {
      discoverActions: jest.fn(async (_actor, _context, options) => {
        expect(options.trace).toBeNull();
        return { actions: [], errors: [] };
      }),
    };

    const { service } = createService({
      logger,
      traceContextFactory,
      actionAwareTraceFactory,
      actionTraceFilter,
      actionPipelineOrchestrator,
    });

    await service.getValidActions(actor, {}, { trace: true });

    expect(logger.error).toHaveBeenCalledWith(
      `Failed to create trace context for actor ${actor.id}, falling back to standard trace`,
      expect.any(Error)
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Failed to create fallback trace context for actor ${actor.id}`,
      expect.any(Error)
    );
  });
});

describe('ActionDiscoveryService action tracing status helpers', () => {
  it('handles filter errors when checking action tracing status', () => {
    const logger = createLogger();
    const actionTraceFilter = {
      isEnabled: jest.fn(() => {
        throw new Error('status failure');
      }),
      shouldTrace: jest.fn(() => true),
    };

    const { service } = createService({ logger, actionTraceFilter });

    const status = service.getActionTracingStatus();

    expect(status).toEqual({
      available: false,
      enabled: false,
      hasFilter: true,
      hasFactory: false,
    });
    expect(logger.warn).toHaveBeenCalledWith(
      'Error checking action tracing status, assuming disabled',
      expect.any(Error)
    );
  });
});
