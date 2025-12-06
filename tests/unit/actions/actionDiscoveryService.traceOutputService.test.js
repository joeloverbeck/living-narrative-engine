/**
 * @file Additional coverage tests for ActionDiscoveryService tracing output.
 */

import { describe, expect, it, jest } from '@jest/globals';
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';

/**
 *
 */
function createLoggerMock() {
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
function createBaseDependencies(overrides = {}) {
  const defaults = {
    entityManager: {},
    actionPipelineOrchestrator: {
      discoverActions: jest.fn(async () => ({ actions: [], errors: [] })),
    },
    traceContextFactory: jest.fn(() => ({ info: jest.fn() })),
    getActorLocationFn: jest.fn(() => 'station'),
    logger: createLoggerMock(),
  };

  return { ...defaults, ...overrides };
}

describe('ActionDiscoveryService tracing configuration edge cases', () => {
  it('logs warnings when optional tracing dependencies are invalid', () => {
    const logger = createLoggerMock();

    new ActionDiscoveryService(
      createBaseDependencies({
        logger,
        actionAwareTraceFactory: {},
        actionTraceFilter: { isEnabled: jest.fn(() => true) },
        actionTraceOutputService: { writeTrace: 'not-a-function' },
      })
    );

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

  it('writes discovery traces through the output service and swallows write errors', async () => {
    const logger = createLoggerMock();
    const traceStub = {
      info: jest.fn(),
      getTracedActions: jest.fn(() => new Set([{ id: 'action-1' }])),
      getTracingSummary: jest.fn(() => ({
        totalStagesTracked: 4,
        sessionDuration: 12,
      })),
    };
    const traceContextFactory = jest.fn(() => traceStub);
    const writeError = new Error('storage offline');
    const writeTrace = jest.fn(() => Promise.reject(writeError));
    const orchestratorResult = {
      actions: [{ id: 'core:jump' }],
      errors: [{ message: 'minor' }],
    };

    const actionDiscoveryService = new ActionDiscoveryService(
      createBaseDependencies({
        logger,
        traceContextFactory,
        actionPipelineOrchestrator: {
          discoverActions: jest.fn(async () => orchestratorResult),
        },
        actionTraceFilter: {
          isEnabled: jest.fn(() => false),
          shouldTrace: jest.fn(() => false),
        },
        actionTraceOutputService: { writeTrace },
      })
    );

    const actor = { id: 'actor-99' };
    const result = await actionDiscoveryService.getValidActions(
      actor,
      {},
      { trace: true }
    );

    expect(result).toBe(orchestratorResult);
    expect(writeTrace).toHaveBeenCalledWith(traceStub);

    await new Promise((resolve) => setImmediate(resolve));

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to write discovery trace'),
      expect.objectContaining({
        error: writeError.message,
        actorId: actor.id,
      })
    );

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Initialized with ActionTraceOutputService')
    );
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(`Created UnknownTrace for actor ${actor.id}`),
      expect.objectContaining({ traceType: 'UnknownTrace' })
    );
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(`Writing discovery trace for actor ${actor.id}`),
      expect.objectContaining({ tracedActionCount: 1 })
    );
  });
  it('respects existing getActor and handles missing tracing summary data', async () => {
    const logger = createLoggerMock();
    const traceStub = {
      info: jest.fn(),
      getTracedActions: jest.fn(() => new Set()),
    };
    const traceContextFactory = jest.fn(() => traceStub);
    const writeTrace = jest.fn(() => Promise.resolve());
    const existingGetActor = jest.fn(() => ({ id: 'existing' }));

    const discoverActions = jest.fn(async () => ({ actions: [], errors: [] }));
    const actionDiscoveryService = new ActionDiscoveryService(
      createBaseDependencies({
        logger,
        traceContextFactory,
        actionPipelineOrchestrator: { discoverActions },
        actionTraceFilter: {
          isEnabled: jest.fn(() => false),
          shouldTrace: jest.fn(() => true),
        },
        actionTraceOutputService: { writeTrace },
      })
    );

    const actor = { id: 'actor-42' };
    const baseContext = {
      getActor: existingGetActor,
      currentLocation: 'tower',
    };
    const result = await actionDiscoveryService.getValidActions(
      actor,
      baseContext,
      {
        trace: true,
      }
    );

    expect(result).toEqual({ actions: [], errors: [] });
    expect(traceStub.getTracedActions).toHaveBeenCalled();

    const [, discoveryContextArg] = discoverActions.mock.calls[0];
    expect(discoveryContextArg.getActor).toBe(existingGetActor);
    expect(existingGetActor).not.toHaveBeenCalled();

    await new Promise((resolve) => setImmediate(resolve));

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Action discovery completed for actor ${actor.id} with action tracing`
      ),
      expect.objectContaining({
        tracedActionCount: 0,
        totalStagesTracked: 0,
        sessionDuration: 0,
      })
    );
  });

  it('uses default getActorLocation utility when none is provided', async () => {
    const logger = createLoggerMock();
    const entity = { getComponentData: () => ({ locationId: 'hangar-7' }) };
    const entityManager = {
      getEntityInstance: jest.fn(() => entity),
      getComponentData: jest.fn(() => ({ locationId: 'hangar-7' })),
    };
    const discoverActions = jest.fn(async () => ({ actions: [], errors: [] }));
    const traceContextFactory = jest.fn(() => null);

    const service = new ActionDiscoveryService({
      entityManager,
      logger,
      actionPipelineOrchestrator: { discoverActions },
      traceContextFactory,
    });

    const actor = { id: 'actor-5' };
    await service.getValidActions(actor);

    const [, discoveryContext] = discoverActions.mock.calls[0];
    expect(discoveryContext.currentLocation).toBe(entity);
    expect(entityManager.getEntityInstance).toHaveBeenCalledWith(actor.id);
  });
});
