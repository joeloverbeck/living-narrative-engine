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
});
