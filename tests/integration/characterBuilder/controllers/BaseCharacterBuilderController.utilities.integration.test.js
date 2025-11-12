/**
 * @file Integration tests for BaseCharacterBuilderController utility helpers
 */

import ConsoleLogger from '../../../../src/logging/consoleLogger.js';
import { SafeEventDispatcher } from '../../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../../src/events/eventBus.js';
import InMemoryDataRegistry from '../../../../src/data/inMemoryDataRegistry.js';
import GameDataRepository from '../../../../src/data/gameDataRepository.js';
import AjvSchemaValidator from '../../../../src/validation/ajvSchemaValidator.js';
import { CHARACTER_BUILDER_EVENTS } from '../../../../src/characterBuilder/services/characterBuilderService.js';
import BaseCharacterBuilderController from '../../../../src/characterBuilder/controllers/BaseCharacterBuilderController.js';

class MinimalCharacterBuilderService {
  constructor(logger) {
    this.logger = logger;
  }

  async initialize() {
    this.logger.debug('Minimal service initialized');
  }

  async getAllCharacterConcepts() {
    return [];
  }

  async getCharacterConcept() {
    return null;
  }

  async createCharacterConcept() {
    return { id: 'generated-id' };
  }

  async updateCharacterConcept() {
    return { id: 'updated-id' };
  }

  async deleteCharacterConcept() {
    return true;
  }

  async generateThematicDirections() {
    return [];
  }

  async getThematicDirections() {
    return [];
  }
}

class TestCharacterBuilderController extends BaseCharacterBuilderController {
  constructor(dependencies) {
    super(dependencies);
  }

  setWeakReference(key, value) {
    this._setWeakReference(key, value);
  }

  getWeakReference(key) {
    return this._getWeakReference(key);
  }

  trackWeakly(obj) {
    this._trackWeakly(obj);
  }

  isWeaklyTracked(obj) {
    return this._isWeaklyTracked(obj);
  }

  createDebounced(fn, delay, options) {
    return this._debounce(fn, delay, options);
  }

  createThrottled(fn, wait, options) {
    return this._throttle(fn, wait, options);
  }

  getDebouncedHandler(key, fn, delay, options) {
    return this._getDebouncedHandler(key, fn, delay, options);
  }

  getThrottledHandler(key, fn, wait, options) {
    return this._getThrottledHandler(key, fn, wait, options);
  }

  registerCleanupTask(task, description) {
    this._registerCleanupTask(task, description);
  }

  checkDestroyed(operation) {
    return this._checkDestroyed(operation);
  }

  makeDestructionSafe(method, name) {
    return this._makeDestructionSafe(method, name);
  }

  scheduleTimeout(callback, delay) {
    return this._setTimeout(callback, delay);
  }

  performanceMark(name) {
    this._performanceMark(name);
  }

  performanceMeasure(measureName, startMark, endMark) {
    return this._performanceMeasure(measureName, startMark, endMark);
  }

  performanceMeasurements() {
    return this._getPerformanceMeasurements();
  }

  clearPerformanceData(prefix) {
    this._clearPerformanceData(prefix);
  }
}

function createControllerDependencies() {
  const logger = new ConsoleLogger('DEBUG');
  logger.setLogLevel('DEBUG');

  const registry = new InMemoryDataRegistry({ logger });
  const repository = new GameDataRepository(registry, logger);
  const schemaValidator = new AjvSchemaValidator({ logger });
  const eventBus = new EventBus({ logger });
  const validatedDispatcher = new ValidatedEventDispatcher({
    eventBus,
    gameDataRepository: repository,
    schemaValidator,
    logger,
  });
  const safeDispatcher = new SafeEventDispatcher({
    validatedEventDispatcher: validatedDispatcher,
    logger,
  });
  const characterBuilderService = new MinimalCharacterBuilderService(logger);

  return {
    logger,
    schemaValidator,
    eventBus: safeDispatcher,
    characterBuilderService,
  };
}

function setupController(ControllerClass = TestCharacterBuilderController) {
  document.body.innerHTML = `
    <div id="empty-state" class="state-container"></div>
    <div id="loading-state" class="state-container"></div>
    <div id="error-state" class="state-container"></div>
    <div id="results-state" class="state-container"></div>
  `;

  const dependencies = createControllerDependencies();
  const controller = new ControllerClass(dependencies);

  return { controller, dependencies };
}

describe('BaseCharacterBuilderController utility behaviours (integration)', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('manages weak references and tracking safety checks', () => {
    const { controller } = setupController();

    const tracked = {};
    controller.setWeakReference(tracked, 'value');
    expect(controller.getWeakReference(tracked)).toBe('value');

    controller.trackWeakly(tracked);
    expect(controller.isWeaklyTracked(tracked)).toBe(true);

    expect(() => controller.setWeakReference(null, 'bad')).toThrow(
      'WeakMap key must be an object'
    );
    expect(() => controller.trackWeakly('oops')).toThrow(
      'WeakSet value must be an object'
    );

    controller.destroy();
  });

  it('creates debounced handlers with maxWait, cancel, flush, and pending support', () => {
    const { controller } = setupController();
    jest.useFakeTimers();

    const calls = [];
    const leadingDebounced = controller.createDebounced(
      (value) => {
        calls.push({ value, timestamp: Date.now() });
      },
      20,
      { leading: true }
    );

    leadingDebounced('initial');
    expect(calls).toHaveLength(1);

    leadingDebounced('second');
    expect(leadingDebounced.pending()).toBe(true);
    jest.advanceTimersByTime(19);
    expect(leadingDebounced.pending()).toBe(true);
    jest.advanceTimersByTime(1);
    expect(calls).toHaveLength(2);
    expect(calls[1].value).toBe('second');

    leadingDebounced('third');
    leadingDebounced.cancel();
    expect(leadingDebounced.pending()).toBe(false);

    leadingDebounced('fourth');
    leadingDebounced.flush();
    expect(calls[calls.length - 1].value).toBe('fourth');

    const maxWaitCalls = [];
    const maxWaitDebounced = controller.createDebounced(
      (value) => {
        maxWaitCalls.push(value);
      },
      20,
      { maxWait: 50 }
    );

    maxWaitDebounced('mw-initial');
    jest.advanceTimersByTime(10);
    maxWaitDebounced('mw-mid');
    jest.advanceTimersByTime(10);
    maxWaitDebounced('mw-late');
    jest.advanceTimersByTime(10);
    maxWaitDebounced('mw-final');
    jest.advanceTimersByTime(40);
    expect(maxWaitCalls[maxWaitCalls.length - 1]).toBe('mw-final');
    maxWaitDebounced.cancel();

    const shared = controller.getDebouncedHandler(
      'search',
      (value) => calls.push({ value, type: 'shared' }),
      15
    );
    const reused = controller.getDebouncedHandler(
      'search',
      () => calls.push({ value: 'should-not-run' }),
      15
    );
    expect(shared).toBe(reused);

    controller.destroy();
  });

  it('creates throttled handlers with trailing execution, cancel, flush, and caching', () => {
    const { controller } = setupController();
    jest.useFakeTimers();

    const results = [];
    const throttled = controller.createThrottled(
      (value) => {
        results.push({ value, timestamp: Date.now() });
      },
      30,
      { leading: true, trailing: true }
    );

    throttled('start');
    expect(results).toHaveLength(1);

    throttled('queued');
    jest.advanceTimersByTime(10);
    throttled('queued-late');
    expect(results).toHaveLength(1);

    jest.advanceTimersByTime(30);
    expect(results).toHaveLength(2);
    expect(results[1].value).toBe('queued-late');

    throttled.cancel();
    throttled('post-cancel');
    jest.advanceTimersByTime(30);
    expect(results[results.length - 1].value).toBe('post-cancel');

    const cached = controller.getThrottledHandler(
      'throttle-key',
      (value) => results.push({ value, type: 'cached' }),
      25,
      { leading: false, trailing: true }
    );
    const cachedAgain = controller.getThrottledHandler(
      'throttle-key',
      () => results.push({ value: 'unused' }),
      25
    );
    expect(cached).toBe(cachedAgain);

    cached('cached-call');
    jest.advanceTimersByTime(5);
    cached('cached-final');
    cached.flush();
    expect(results.some((entry) => entry.value === 'cached-final')).toBe(true);

    controller.destroy();
  });

  it('clears performance data selectively and fully while dispatching warnings', () => {
    const { controller } = setupController();
    const warningEvents = [];
    const unsubscribe = controller.eventBus.subscribe(
      CHARACTER_BUILDER_EVENTS.CHARACTER_BUILDER_PERFORMANCE_WARNING,
      ({ payload }) => {
        warningEvents.push(payload);
      }
    );

    const nowSpy = jest.spyOn(performance, 'now');
    nowSpy.mockReturnValueOnce(5);
    controller.performanceMark('load-start');
    nowSpy.mockReturnValueOnce(205);
    const duration = controller.performanceMeasure('load-phase', 'load-start');

    expect(duration).toBe(200);
    expect(warningEvents).toHaveLength(1);
    expect(warningEvents[0]).toMatchObject({ measurement: 'load-phase', duration: 200 });

    controller.performanceMark('other-start');
    controller.performanceMeasure('other-phase', 'other-start');

    expect(controller.performanceMeasurements().has('load-phase')).toBe(true);
    controller.clearPerformanceData('load');
    expect(controller.performanceMeasurements().has('load-phase')).toBe(false);
    expect(controller.performanceMeasurements().has('other-phase')).toBe(true);

    controller.clearPerformanceData();
    expect(controller.performanceMeasurements().size).toBe(0);

    nowSpy.mockRestore();
    if (typeof unsubscribe === 'function') {
      unsubscribe();
    }
    controller.destroy();
  });

  it('executes cleanup tasks during destruction and guards post-destruction calls', () => {
    const { controller } = setupController();
    jest.useFakeTimers();

    const executionOrder = [];
    controller.registerCleanupTask(() => executionOrder.push('first'), 'first cleanup');
    controller.registerCleanupTask(() => executionOrder.push('second'), 'second cleanup');

    const safeMethod = controller.makeDestructionSafe((label) => {
      executionOrder.push(label);
      return label;
    }, 'safeMethod');

    expect(safeMethod('alive')).toBe('alive');

    controller.scheduleTimeout(() => executionOrder.push('timeout'), 100);

    const dispatcher = controller.eventBus;
    const dispatchSpy = jest
      .spyOn(dispatcher, 'dispatch')
      .mockImplementation(() => {
        throw new Error('dispatch failure');
      });

    controller.destroy();

    jest.runOnlyPendingTimers();
    expect(executionOrder).toEqual(['alive', 'second', 'first']);
    expect(controller.isDestroyed).toBe(true);
    expect(controller.isDestroying).toBe(false);

    expect(() => controller.checkDestroyed('perform operation')).toThrow(
      `${controller.constructor.name}: Cannot perform operation - controller is destroyed`
    );
    expect(controller.checkDestroyed()).toBe(true);
    expect(() => safeMethod('after-destroy')).toThrow(
      `${controller.constructor.name}: Cannot call safeMethod - controller is destroyed`
    );

    controller.destroy();

    dispatchSpy.mockRestore();
  });

  it('rejects invalid cleanup tasks', () => {
    const { controller } = setupController();
    expect(() => controller.registerCleanupTask('not-a-function')).toThrow(
      'Cleanup task must be a function'
    );
    controller.destroy();
  });

  it('logs warnings when performance APIs fail or marks are missing', () => {
    const { controller, dependencies } = setupController();
    const warnSpy = jest.spyOn(dependencies.logger, 'warn');

    const originalMark = jest
      .spyOn(performance, 'mark')
      .mockImplementation(() => {
        throw new Error('mark failure');
      });

    controller.performanceMark('problem-mark');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to create performance mark: problem-mark'),
      expect.any(Error)
    );

    originalMark.mockRestore();
    warnSpy.mockClear();

    const measurement = controller.performanceMeasure(
      'missing-measurement',
      'missing-start',
      'missing-end'
    );

    expect(measurement).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Performance marks not found for measurement: missing-measurement'
      ),
      expect.objectContaining({
        startMark: 'missing-start',
        endMark: 'missing-end',
        hasStartMark: false,
        hasEndMark: false,
      })
    );

    warnSpy.mockRestore();
    controller.destroy();
  });

  it('recovers from performance measurement failures triggered by event dispatch errors', () => {
    const { controller, dependencies } = setupController();
    const warnSpy = jest.spyOn(dependencies.logger, 'warn');
    const nowSpy = jest.spyOn(performance, 'now');

    nowSpy.mockReturnValueOnce(125);
    controller.performanceMark('phase-start');

    nowSpy.mockReturnValueOnce(340);
    controller.performanceMark('phase-end');

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockClear();

    const dispatchSpy = jest
      .spyOn(controller.eventBus, 'dispatch')
      .mockImplementation(() => {
        throw new Error('dispatch failure');
      });

    const result = controller.performanceMeasure(
      'phase',
      'phase-start',
      'phase-end'
    );

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to measure performance: phase'),
      expect.any(Error)
    );

    dispatchSpy.mockRestore();
    nowSpy.mockRestore();
    warnSpy.mockRestore();
    controller.destroy();
  });

  it('manages debounce timers when maxWait forces immediate execution, cancellation, and flushing', () => {
    const { controller } = setupController();
    jest.useFakeTimers({ doNotFake: ['Date'] });

    let fakeNow = 100;
    const dateNowSpy = jest
      .spyOn(Date, 'now')
      .mockImplementation(() => fakeNow);
    const clearSpy = jest.spyOn(controller, '_clearTimeout');

    const immediateHandler = jest.fn();
    const immediateDebounced = controller.createDebounced(
      immediateHandler,
      10,
      { maxWait: 1 }
    );

    immediateDebounced('first');
    fakeNow = 220;
    immediateDebounced('second');
    expect(immediateHandler).toHaveBeenCalledTimes(2);

    const cancelHandler = jest.fn();
    const cancelDebounced = controller.createDebounced(
      cancelHandler,
      50,
      { maxWait: 120 }
    );

    fakeNow = 400;
    const clearCallsBeforeCancel = clearSpy.mock.calls.length;
    cancelDebounced('cancel-me');
    cancelDebounced.cancel();
    expect(clearSpy.mock.calls.length).toBeGreaterThan(clearCallsBeforeCancel);

    const flushHandler = jest.fn();
    const flushDebounced = controller.createDebounced(
      flushHandler,
      30,
      { maxWait: 200 }
    );

    fakeNow = 520;
    flushDebounced('queued-1');
    fakeNow = 640;
    flushDebounced('queued-2');
    flushDebounced.flush();
    expect(flushHandler).toHaveBeenCalledWith('queued-2');

    clearSpy.mockRestore();
    dateNowSpy.mockRestore();
    jest.runOnlyPendingTimers();
    controller.destroy();
  });

  it('clears throttled timers when executing immediately and via cancellation', () => {
    const { controller } = setupController();
    jest.useFakeTimers({ doNotFake: ['Date'] });

    let fakeNow = 150;
    const dateNowSpy = jest
      .spyOn(Date, 'now')
      .mockImplementation(() => fakeNow);
    const clearSpy = jest.spyOn(controller, '_clearTimeout');
    const handler = jest.fn();
    const throttled = controller.createThrottled(
      handler,
      50,
      { leading: true, trailing: true }
    );

    throttled('initial');
    fakeNow = 170;
    throttled('queued');
    fakeNow = 250;
    throttled('trigger');

    expect(handler).toHaveBeenCalledTimes(2);

    fakeNow = 260;
    const clearCallsBeforeCancel = clearSpy.mock.calls.length;
    throttled('final');
    throttled.cancel();
    expect(clearSpy.mock.calls.length).toBeGreaterThan(clearCallsBeforeCancel);

    jest.runOnlyPendingTimers();
    expect(handler).toHaveBeenCalledTimes(2);

    clearSpy.mockRestore();
    dateNowSpy.mockRestore();
    controller.destroy();
  });

  it('warns when destroy is invoked during an ongoing destruction cycle', () => {
    class ReentrantDestroyController extends TestCharacterBuilderController {
      constructor(dependencies) {
        super(dependencies);
        this._reentered = false;
      }

      _preDestroy() {
        if (!this._reentered) {
          this._reentered = true;
          this.destroy();
        }
      }
    }

    const { controller, dependencies } = setupController(
      ReentrantDestroyController
    );
    const warnSpy = jest.spyOn(dependencies.logger, 'warn');

    controller.destroy();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Destruction already in progress')
    );
    expect(controller.isDestroyed).toBe(true);

    warnSpy.mockRestore();
  });

  it('propagates errors from destruction phases while marking the controller as destroyed', () => {
    const { controller } = setupController();
    const error = new Error('phase failure');
    const phaseSpy = jest
      .spyOn(controller, '_executePhase')
      .mockImplementation(() => {
        throw error;
      });

    expect(() => controller.destroy()).toThrow(error);
    expect(controller.isDestroyed).toBe(true);
    expect(controller.isDestroying).toBe(false);

    phaseSpy.mockRestore();
  });
});
