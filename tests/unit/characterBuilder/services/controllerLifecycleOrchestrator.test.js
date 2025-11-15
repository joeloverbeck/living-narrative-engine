import { jest } from '@jest/globals';
import {
  ControllerLifecycleOrchestrator,
  LIFECYCLE_PHASES,
  DESTRUCTION_PHASES,
  DEFAULT_INITIALIZATION_SEQUENCE,
  DEFAULT_DESTRUCTION_SEQUENCE,
} from '../../../../src/characterBuilder/services/controllerLifecycleOrchestrator.js';
import { createMockLogger } from '../../../common/mockFactories/index.js';

const REQUIRED_INIT_PHASES = [
  LIFECYCLE_PHASES.PRE_INIT,
  LIFECYCLE_PHASES.CACHE_ELEMENTS,
  LIFECYCLE_PHASES.INIT_SERVICES,
  LIFECYCLE_PHASES.SETUP_EVENT_LISTENERS,
  LIFECYCLE_PHASES.LOAD_DATA,
  LIFECYCLE_PHASES.INIT_UI,
  LIFECYCLE_PHASES.POST_INIT,
  LIFECYCLE_PHASES.INIT_ERROR,
];

const REQUIRED_DESTROY_PHASES = [
  DESTRUCTION_PHASES.PRE_DESTROY,
  DESTRUCTION_PHASES.CANCEL_OPERATIONS,
  DESTRUCTION_PHASES.REMOVE_LISTENERS,
  DESTRUCTION_PHASES.CLEANUP_SERVICES,
  DESTRUCTION_PHASES.CLEAR_ELEMENTS,
  DESTRUCTION_PHASES.CLEAR_REFERENCES,
  DESTRUCTION_PHASES.POST_DESTROY,
];

const createDeferred = () => {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const registerBaselineHooks = (orchestrator) => {
  const asyncNoop = async () => {};
  REQUIRED_INIT_PHASES.forEach((phase) => {
    orchestrator.registerHook(phase, asyncNoop);
  });

  const syncNoop = () => {};
  REQUIRED_DESTROY_PHASES.forEach((phase) => {
    orchestrator.registerHook(phase, syncNoop);
  });
};

describe('ControllerLifecycleOrchestrator', () => {
  let logger;
  let eventBus;
  let orchestrator;

  beforeEach(() => {
    jest.useFakeTimers();
    logger = createMockLogger();
    eventBus = { dispatch: jest.fn() };
    orchestrator = new ControllerLifecycleOrchestrator({
      logger,
      eventBus,
    });
    orchestrator.setControllerName('TestController');
    registerBaselineHooks(orchestrator);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('runs lifecycle hooks in order and dispatches events', async () => {
    const initOrder = [];
    const destroyOrder = [];

    DEFAULT_INITIALIZATION_SEQUENCE.forEach((phase) => {
      orchestrator.registerHook(phase, async () => {
        initOrder.push(phase);
        await new Promise((resolve) => setTimeout(resolve, 5));
      });
    });

    DEFAULT_DESTRUCTION_SEQUENCE.forEach((phase) => {
      orchestrator.registerHook(phase, () => {
        destroyOrder.push(phase);
      });
    });

    const initPromise = orchestrator.initialize();
    await jest.advanceTimersByTimeAsync(50);
    await initPromise;

    expect(initOrder).toEqual(DEFAULT_INITIALIZATION_SEQUENCE);
    expect(eventBus.dispatch).toHaveBeenCalledWith(
      'core:controller_initialized',
      expect.objectContaining({ controllerName: 'TestController' })
    );

    orchestrator.destroy();
    expect(destroyOrder).toEqual(DEFAULT_DESTRUCTION_SEQUENCE);
    expect(eventBus.dispatch).toHaveBeenCalledWith(
      'CONTROLLER_DESTROYED',
      expect.objectContaining({ controllerName: 'TestController' })
    );
  });

  it('propagates errors and triggers error hooks', async () => {
    const errorSpy = jest.fn();
    orchestrator.registerHook(LIFECYCLE_PHASES.INIT_ERROR, errorSpy);
    orchestrator.registerHook(LIFECYCLE_PHASES.LOAD_DATA, async () => {
      throw new Error('boom');
    });

    await expect(orchestrator.initialize()).rejects.toThrow('boom');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(errorSpy.mock.calls[0][0].message).toContain('boom');
  });

  it('prevents overlapping initialization attempts', async () => {
    const gate = createDeferred();
    const blockingHook = jest.fn(() => gate.promise);

    orchestrator.registerHook(LIFECYCLE_PHASES.PRE_INIT, blockingHook);

    const first = orchestrator.initialize();
    const second = orchestrator.initialize();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('already in progress')
    );

    gate.resolve();
    await first;
    await second;

    expect(blockingHook).toHaveBeenCalledTimes(1);
  });

  it('executes cleanup tasks in LIFO order', () => {
    const order = [];
    orchestrator.registerCleanupTask(() => order.push('first'), 'first');
    orchestrator.registerCleanupTask(() => order.push('second'), 'second');

    orchestrator.destroy();

    expect(order).toEqual(['second', 'first']);
  });

  it('supports hook deregistration', async () => {
    const hook = jest.fn();
    const unregister = orchestrator.registerHook(
      LIFECYCLE_PHASES.POST_INIT,
      hook
    );

    unregister();

    const initPromise = orchestrator.initialize();
    await jest.advanceTimersByTimeAsync(5);
    await initPromise;

    expect(hook).not.toHaveBeenCalled();
  });

  it('removes phase storage when the final hook is deregistered', () => {
    const phase = 'customPhase';
    const hook = jest.fn();

    orchestrator.registerHook(phase, hook);

    expect(orchestrator.deregisterHook(phase, hook)).toBe(true);
    expect(orchestrator.deregisterHook(phase, hook)).toBe(false);
  });

  it('reinitializes and runs reset callbacks', async () => {
    const initHook = jest.fn();
    orchestrator.registerHook(LIFECYCLE_PHASES.POST_INIT, initHook);
    const resetSpy = jest.fn();

    await orchestrator.initialize();
    expect(initHook).toHaveBeenCalledTimes(1);

    await orchestrator.reinitialize({
      controllerName: 'TestController',
      onReset: resetSpy,
    });

    expect(initHook).toHaveBeenCalledTimes(2);
    expect(resetSpy).toHaveBeenCalledTimes(1);
  });

  it('throws when attempting to initialize after destruction', async () => {
    orchestrator.destroy();

    await expect(orchestrator.initialize()).rejects.toThrow(
      'TestController: Cannot initialize after destruction'
    );
  });

  it('guards destruction state and safe wrappers', () => {
    const safe = orchestrator.makeDestructionSafe(() => 'ok', 'test');
    expect(safe()).toBe('ok');

    orchestrator.destroy();

    expect(orchestrator.checkDestroyed()).toBe(true);
    expect(() => orchestrator.checkDestroyed('operate')).toThrow(
      'TestController: Cannot operate - controller is destroyed'
    );
    expect(orchestrator.isDestroyed).toBe(true);
    expect(orchestrator.isDestroying).toBe(false);
    expect(() => safe()).toThrow('TestController: Cannot call test');
  });

  it('logs errors thrown by reset callbacks without rethrowing', () => {
    const error = new Error('reset failed');

    orchestrator.resetInitializationState(() => {
      throw error;
    });

    expect(logger.error).toHaveBeenCalledWith(
      'TestController: Error while running reset callback',
      error
    );
  });

  it('validates cleanup task inputs', () => {
    expect(() => orchestrator.registerCleanupTask('nope')).toThrow(
      'Cleanup task must be a function'
    );
  });

  it('propagates destruction errors that occur while logging duration', () => {
    let callCount = 0;
    const nowSpy = jest.spyOn(performance, 'now').mockImplementation(() => {
      callCount += 1;
      if (callCount === 2) {
        throw new Error('timer failure');
      }
      return 0;
    });

    expect(() => orchestrator.destroy()).toThrow('timer failure');
    expect(logger.error).toHaveBeenCalledWith(
      'TestController: Error during destruction',
      expect.any(Error)
    );

    nowSpy.mockRestore();
  });

  it('creates controller method hooks that skip optional methods gracefully', async () => {
    const customLogger = createMockLogger();
    const localOrchestrator = new ControllerLifecycleOrchestrator({
      logger: customLogger,
    });
    const hook = localOrchestrator.createControllerMethodHook(
      {},
      'missingMethod',
      'optionalPhase'
    );

    await expect(hook()).resolves.toBeUndefined();
    expect(customLogger.debug).toHaveBeenCalledWith(
      'Object: Skipping optionalPhase (method not implemented)'
    );
  });

  it('requires a controller when creating controller method hooks', () => {
    expect(() =>
      orchestrator.createControllerMethodHook(
        null,
        'method',
        'phase',
        { required: true }
      )
    ).toThrow('controller is required to create lifecycle hooks');
  });

  it('initializes correctly when created with hook configuration objects', async () => {
    const hookOne = jest.fn();
    const hookTwo = jest.fn();
    const configLogger = createMockLogger();
    const configEventBus = { dispatch: jest.fn() };
    const orchestratorWithHooks = new ControllerLifecycleOrchestrator({
      logger: configLogger,
      eventBus: configEventBus,
      hooks: {
        [LIFECYCLE_PHASES.PRE_INIT]: [hookOne, hookTwo],
        [LIFECYCLE_PHASES.POST_INIT]: null,
      },
    });

    await orchestratorWithHooks.initialize();

    expect(hookOne).toHaveBeenCalledTimes(1);
    expect(hookTwo).toHaveBeenCalledTimes(1);
  });

  it('ignores invalid hook configuration values', () => {
    expect(
      () =>
        new ControllerLifecycleOrchestrator({
          logger,
          hooks: null,
        })
    ).not.toThrow();
  });

  it('handles initialization when no hooks are registered and event bus is unavailable', async () => {
    const silentLogger = createMockLogger();
    const bareOrchestrator = new ControllerLifecycleOrchestrator({
      logger: silentLogger,
    });

    await bareOrchestrator.initialize();
    bareOrchestrator.destroy();

    expect(silentLogger.error).not.toHaveBeenCalled();
  });

  it('logs failures when initialization events cannot be dispatched', async () => {
    eventBus.dispatch.mockImplementation(() => {
      throw new Error('dispatch failed');
    });

    await orchestrator.initialize();

    expect(logger.error).toHaveBeenCalledWith(
      'TestController: Failed to dispatch initialization event',
      expect.any(Error)
    );
  });

  it('logs async destruction hook rejections', async () => {
    const rejection = new Error('async cleanup failed');
    orchestrator.registerHook(
      DESTRUCTION_PHASES.CLEAR_ELEMENTS,
      () => Promise.reject(rejection)
    );

    orchestrator.destroy();
    await Promise.resolve();

    expect(logger.error).toHaveBeenCalledWith(
      'TestController: Async hook rejected in destroy:clearElements',
      rejection
    );
  });

  it('skips destruction event dispatch when dispatcher is missing', () => {
    const bareLogger = createMockLogger();
    const orchestratorWithoutDispatch = new ControllerLifecycleOrchestrator({
      logger: bareLogger,
      eventBus: {},
    });
    registerBaselineHooks(orchestratorWithoutDispatch);

    orchestratorWithoutDispatch.destroy();

    expect(bareLogger.error).not.toHaveBeenCalled();
  });

  it('logs errors when destruction event dispatch fails', () => {
    const failingEventBus = {
      dispatch: jest.fn(() => {
        throw new Error('bus down');
      }),
    };
    const destructionLogger = createMockLogger();
    const orchestratorWithFailingBus = new ControllerLifecycleOrchestrator({
      logger: destructionLogger,
      eventBus: failingEventBus,
    });
    registerBaselineHooks(orchestratorWithFailingBus);

    orchestratorWithFailingBus.destroy();

    expect(destructionLogger.error).toHaveBeenCalledWith(
      'Controller: Failed to dispatch destruction event',
      expect.any(Error)
    );
  });
});
