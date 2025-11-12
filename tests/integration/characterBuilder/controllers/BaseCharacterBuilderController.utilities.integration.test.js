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

function setupController() {
  document.body.innerHTML = `
    <div id="empty-state" class="state-container"></div>
    <div id="loading-state" class="state-container"></div>
    <div id="error-state" class="state-container"></div>
    <div id="results-state" class="state-container"></div>
  `;

  const dependencies = createControllerDependencies();
  const controller = new TestCharacterBuilderController(dependencies);

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
});
