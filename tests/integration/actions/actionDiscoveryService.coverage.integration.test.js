import { jest } from '@jest/globals';
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';
import { InvalidActorEntityError } from '../../../src/errors/invalidActorEntityError.js';
import { createEnhancedMockLogger } from '../../common/mockFactories/loggerMocks.js';

/**
 * @typedef {ReturnType<typeof createService>} ServiceCreationResult
 */

/**
 * Creates an ActionDiscoveryService with sensible default mocks for integration-style testing.
 *
 * @param {object} [overrides] - Optional dependency overrides for the service constructor.
 * @returns {{ service: ActionDiscoveryService, dependencies: Record<string, any> }} Configured service and its dependencies.
 */
function createService(overrides = {}) {
  const logger = createEnhancedMockLogger();
  const entityManager = {
    getEntityInstance: jest.fn((id) => ({ id })),
  };
  const actionPipelineOrchestrator = {
    discoverActions: jest.fn(async (actor, context, options = {}) => ({
      actions: [],
      errors: [],
      context,
      options,
    })),
  };
  const traceContextFactory = jest.fn(() => ({
    info: jest.fn(),
  }));
  const getActorLocationFn = jest.fn(() => 'default-location');

  const dependencies = {
    entityManager,
    logger,
    actionPipelineOrchestrator,
    traceContextFactory,
    getActorLocationFn,
    ...overrides,
  };

  const service = new ActionDiscoveryService(dependencies);
  return { service, dependencies };
}

/**
 * Ensures all pending microtasks are resolved, allowing promise chains to settle during assertions.
 *
 * @returns {Promise<void>} Promise that resolves on the next event loop tick.
 */
function flushPromises() {
  return new Promise((resolve) => {
    setImmediate(() => resolve());
  });
}

describe('ActionDiscoveryService integration coverage', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('discovers actions without tracing and populates context from actor location', async () => {
    const { service, dependencies } = createService();
    const actor = { id: 'actor-basic' };
    const baseContext = { some: 'context' };

    dependencies.actionPipelineOrchestrator.discoverActions.mockResolvedValue({
      actions: [{ id: 'test:go' }],
      errors: [],
    });

    const result = await service.getValidActions(actor, baseContext);

    expect(dependencies.getActorLocationFn).toHaveBeenCalledWith(
      'actor-basic',
      dependencies.entityManager
    );
    const [[, discoveryContext, options]] =
      dependencies.actionPipelineOrchestrator.discoverActions.mock.calls;
    expect(discoveryContext.currentLocation).toBe('default-location');
    expect(typeof discoveryContext.getActor).toBe('function');
    expect(discoveryContext.some).toBe('context');
    expect(discoveryContext.getActor()).toBe(actor);
    expect(options).toEqual({ trace: null });
    expect(result.actions).toEqual([{ id: 'test:go' }]);
    expect(dependencies.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Finished action discovery for actor actor-basic.'
      )
    );
  });

  it('logs warnings when optional tracing dependencies are misconfigured', () => {
    const logger = createEnhancedMockLogger();

    createService({
      logger,
      actionAwareTraceFactory: {},
      actionTraceFilter: {},
      actionTraceOutputService: {},
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('actionAwareTraceFactory must be a function')
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('actionTraceFilter missing required methods')
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'actionTraceOutputService missing writeTrace method'
      )
    );
  });

  it('uses the default actor location helper when no override is provided', () => {
    const logger = createEnhancedMockLogger();

    const { service, dependencies } = createService({
      logger,
      getActorLocationFn: undefined,
    });

    expect(dependencies.getActorLocationFn).toBeUndefined();
    expect(() => service.isActionTracingAvailable()).not.toThrow();
  });

  it('preserves existing getActor and location values from base context', async () => {
    const getActor = jest.fn(() => ({ id: 'pre-supplied' }));
    const getActorLocationFn = jest.fn();
    const { service, dependencies } = createService({ getActorLocationFn });
    const actor = { id: 'actor-location' };
    const baseContext = {
      getActor,
      currentLocation: 'known-location',
    };

    await service.getValidActions(actor, baseContext);

    expect(getActorLocationFn).not.toHaveBeenCalled();
    const [[, discoveryContext]] =
      dependencies.actionPipelineOrchestrator.discoverActions.mock.calls;
    expect(discoveryContext.getActor).toBe(getActor);
    expect(discoveryContext.currentLocation).toBe('known-location');
  });

  it('throws InvalidActorEntityError when actor is missing an identifier', async () => {
    const { service } = createService();
    await expect(service.getValidActions(null)).rejects.toBeInstanceOf(
      InvalidActorEntityError
    );
    await expect(service.getValidActions({})).rejects.toThrow(
      'actorEntity parameter must be an object with a non-empty id'
    );
  });

  it('validates baseContext is an object', async () => {
    const { service } = createService();
    await expect(
      service.getValidActions({ id: 'actor-context' }, 'invalid-context')
    ).rejects.toThrow(
      'ActionDiscoveryService.getValidActions: baseContext must be an object when provided'
    );
  });

  it('uses action-aware tracing when enabled and writes discovery trace output', async () => {
    const trace = {
      captureActionData: jest.fn(),
      withSpanAsync: jest.fn(async (name, execute) => execute()),
      info: jest.fn(),
      getTracedActions: jest.fn(
        () => new Map([['action', { id: 'action-1' }]])
      ),
      getTracingSummary: jest.fn(() => ({
        totalStagesTracked: 3,
        sessionDuration: 42,
      })),
    };

    const actionAwareTraceFactory = jest.fn(() => trace);
    const actionTraceFilter = {
      isEnabled: jest.fn(() => true),
      shouldTrace: jest.fn(() => true),
    };
    const actionTraceOutputService = {
      writeTrace: jest.fn(() => Promise.resolve()),
    };

    const { service, dependencies } = createService({
      actionAwareTraceFactory,
      actionTraceFilter,
      actionTraceOutputService,
    });

    dependencies.actionPipelineOrchestrator.discoverActions.mockResolvedValue({
      actions: [{ id: 'trace:success' }],
      errors: [{ message: 'warning' }],
    });

    const actor = { id: 'actor-trace' };
    const result = await service.getValidActions(actor, {}, { trace: true });

    expect(actionAwareTraceFactory).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'actor-trace',
        enableActionTracing: true,
      })
    );
    expect(trace.withSpanAsync).toHaveBeenCalledWith(
      'action.discover',
      expect.any(Function),
      expect.objectContaining({ actorId: 'actor-trace', withTrace: true })
    );
    expect(actionTraceOutputService.writeTrace).toHaveBeenCalledWith(trace);
    expect(result.actions).toEqual([{ id: 'trace:success' }]);
    expect(dependencies.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Action discovery completed for actor actor-trace with action tracing'
      ),
      expect.objectContaining({
        tracedActionCount: 1,
        totalStagesTracked: 3,
        sessionDuration: 42,
      })
    );
    expect(service.isActionTracingAvailable()).toBe(true);
    expect(service.getActionTracingStatus()).toEqual(
      expect.objectContaining({
        available: true,
        enabled: true,
        hasFilter: true,
        hasFactory: true,
      })
    );
  });

  it('defaults tracing summary values when trace summary is absent', async () => {
    const trace = {
      captureActionData: jest.fn(),
      withSpanAsync: jest.fn(async (name, execute) => execute()),
      info: jest.fn(),
      getTracedActions: jest.fn(
        () => new Map([['action', { id: 'fallback' }]])
      ),
    };

    const actionTraceOutputService = {
      writeTrace: jest.fn(() => Promise.resolve()),
    };

    const { service, dependencies } = createService({
      actionAwareTraceFactory: () => trace,
      actionTraceFilter: {
        isEnabled: jest.fn(() => true),
        shouldTrace: jest.fn(() => true),
      },
      actionTraceOutputService,
    });

    dependencies.actionPipelineOrchestrator.discoverActions.mockResolvedValue({
      actions: [{ id: 'trace:fallback' }],
      errors: [],
    });

    await service.getValidActions(
      { id: 'actor-summary-fallback' },
      {},
      { trace: true }
    );

    expect(dependencies.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Action discovery completed for actor actor-summary-fallback with action tracing'
      ),
      expect.objectContaining({
        totalStagesTracked: 0,
        sessionDuration: 0,
      })
    );
  });

  it('logs a warning when trace output writing fails', async () => {
    const trace = {
      captureActionData: jest.fn(),
      withSpanAsync: jest.fn(async (name, execute) => execute()),
      info: jest.fn(),
      getTracedActions: jest.fn(
        () => new Map([['action', { id: 'action-2' }]])
      ),
      getTracingSummary: jest.fn(() => ({
        totalStagesTracked: 1,
        sessionDuration: 10,
      })),
    };

    const actionTraceOutputService = {
      writeTrace: jest.fn(() => Promise.reject(new Error('persist failed'))),
    };

    const { service, dependencies } = createService({
      actionAwareTraceFactory: () => trace,
      actionTraceFilter: {
        isEnabled: jest.fn(() => true),
        shouldTrace: jest.fn(() => true),
      },
      actionTraceOutputService,
    });

    dependencies.actionPipelineOrchestrator.discoverActions.mockResolvedValue({
      actions: [],
      errors: [],
    });

    await service.getValidActions(
      { id: 'actor-trace-warn' },
      {},
      { trace: true }
    );
    await flushPromises();

    expect(actionTraceOutputService.writeTrace).toHaveBeenCalledWith(trace);
    expect(dependencies.logger.warn).toHaveBeenCalledWith(
      'ActionDiscoveryService: Failed to write discovery trace',
      expect.objectContaining({
        actorId: 'actor-trace-warn',
        error: 'persist failed',
      })
    );
  });

  it('skips writing trace output when no actions were traced', async () => {
    const trace = {
      captureActionData: jest.fn(),
      withSpanAsync: jest.fn(async (name, execute) => execute()),
      info: jest.fn(),
      getTracedActions: jest.fn(() => new Map()),
    };

    const actionTraceOutputService = {
      writeTrace: jest.fn(() => Promise.resolve()),
    };

    const { service, dependencies } = createService({
      actionAwareTraceFactory: () => trace,
      actionTraceFilter: {
        isEnabled: jest.fn(() => true),
        shouldTrace: jest.fn(() => true),
      },
      actionTraceOutputService,
    });

    dependencies.actionPipelineOrchestrator.discoverActions.mockResolvedValue({
      actions: [{ id: 'trace:none' }],
      errors: [],
    });

    await service.getValidActions(
      { id: 'actor-empty-trace' },
      {},
      { trace: true }
    );

    expect(actionTraceOutputService.writeTrace).not.toHaveBeenCalled();
    expect(dependencies.logger.debug).not.toHaveBeenCalledWith(
      expect.stringContaining('Writing discovery trace')
    );
  });

  it('falls back to structured trace when tracing is disabled or unavailable', async () => {
    const structuredTrace = {
      info: jest.fn(),
      step: jest.fn(),
    };

    const { service, dependencies } = createService({
      traceContextFactory: jest.fn(() => structuredTrace),
    });

    dependencies.actionPipelineOrchestrator.discoverActions.mockResolvedValue({
      actions: [],
      errors: [],
    });

    const actor = { id: 'actor-structured' };
    await service.getValidActions(actor, {}, { trace: true });

    expect(dependencies.traceContextFactory).toHaveBeenCalled();
    expect(dependencies.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Created StructuredTrace for actor actor-structured'
      ),
      expect.objectContaining({ actorId: 'actor-structured' })
    );
    const [[, , options]] =
      dependencies.actionPipelineOrchestrator.discoverActions.mock.calls;
    expect(options).toEqual({ trace: structuredTrace });
  });

  it('logs errors when action-aware tracing creation fails but fallback succeeds', async () => {
    const structuredTrace = {
      info: jest.fn(),
      step: jest.fn(),
      withSpanAsync: jest.fn(async (name, execute) => execute()),
    };

    const traceContextFactory = jest.fn(() => structuredTrace);
    const logger = createEnhancedMockLogger();

    const { service, dependencies } = createService({
      logger,
      traceContextFactory,
      actionTraceFilter: {
        isEnabled: jest.fn(() => true),
        shouldTrace: jest.fn(() => true),
      },
      actionAwareTraceFactory: () => {
        throw new Error('primary trace failure');
      },
    });

    dependencies.actionPipelineOrchestrator.discoverActions.mockResolvedValue({
      actions: [],
      errors: [],
    });

    await service.getValidActions(
      { id: 'actor-fallback' },
      {},
      { trace: true }
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Failed to create trace context for actor actor-fallback'
      ),
      expect.any(Error)
    );
    expect(traceContextFactory).toHaveBeenCalledTimes(1);
    expect(structuredTrace.withSpanAsync).toHaveBeenCalled();
  });

  it('returns null trace when fallback trace context factory also fails', async () => {
    const errorLogger = createEnhancedMockLogger();
    const traceContextFactory = jest.fn(() => {
      throw new Error('fallback failure');
    });

    const { service, dependencies } = createService({
      logger: errorLogger,
      traceContextFactory,
      actionTraceFilter: {
        isEnabled: jest.fn(() => true),
        shouldTrace: jest.fn(() => true),
      },
      actionAwareTraceFactory: () => {
        throw new Error('primary failure');
      },
    });

    dependencies.actionPipelineOrchestrator.discoverActions.mockResolvedValue({
      actions: [],
      errors: [],
    });

    await service.getValidActions(
      { id: 'actor-no-trace' },
      {},
      { trace: true }
    );

    expect(traceContextFactory).toHaveBeenCalledTimes(1);
    expect(errorLogger.error).toHaveBeenCalledTimes(2);
    const [[, , options]] =
      dependencies.actionPipelineOrchestrator.discoverActions.mock.calls;
    expect(options).toEqual({ trace: null });
  });

  it('handles errors reported by actionTraceFilter.isEnabled', () => {
    const logger = createEnhancedMockLogger();
    const { service } = createService({
      logger,
      actionTraceFilter: {
        isEnabled: jest.fn(() => {
          throw new Error('status failure');
        }),
        shouldTrace: jest.fn(() => true),
      },
    });

    expect(service.getActionTracingStatus()).toEqual(
      expect.objectContaining({ enabled: false })
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'ActionDiscoveryService: Error checking action tracing status, assuming disabled',
      expect.any(Error)
    );
  });

  it('labels traces without known helpers as UnknownTrace', async () => {
    const unknownTrace = {
      info: jest.fn(),
      withSpanAsync: jest.fn(async (name, execute) => execute()),
    };

    const { service, dependencies } = createService({
      traceContextFactory: jest.fn(() => unknownTrace),
    });

    dependencies.actionPipelineOrchestrator.discoverActions.mockResolvedValue({
      actions: [],
      errors: [],
    });

    await service.getValidActions(
      { id: 'actor-unknown-trace' },
      {},
      { trace: true }
    );

    expect(dependencies.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Created UnknownTrace for actor actor-unknown-trace'
      ),
      expect.objectContaining({ actorId: 'actor-unknown-trace' })
    );
  });
});
