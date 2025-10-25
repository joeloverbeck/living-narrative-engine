import { jest } from '@jest/globals';
import { CHARACTER_BUILDER_EVENTS } from '../../../../src/characterBuilder/events/characterBuilderEvents.js';
import {
  BaseCharacterBuilderControllerTestBase,
  TestController,
} from './BaseCharacterBuilderController.testbase.js';

/**
 * @file Comprehensive coverage for BaseCharacterBuilderController instrumentation helpers.
 */
describe('BaseCharacterBuilderController - instrumentation helpers', () => {
  let testBase;
  let controller;
  let logger;
  let eventBus;

  beforeEach(async () => {
    testBase = new BaseCharacterBuilderControllerTestBase();
    await testBase.setup();
    controller = new TestController(testBase.mockDependencies);
    await controller.initialize();
    testBase.controller = controller;
    logger = testBase.mockDependencies.logger;
    eventBus = testBase.mockDependencies.eventBus;
  });

  afterEach(async () => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    if (controller && !controller.isDestroyed) {
      await controller.destroy();
    }
    await testBase.cleanup();
  });

  describe('performance instrumentation', () => {
    it('should record marks and measure durations, dispatching warnings when slow', () => {
      const nowSpy = jest
        .spyOn(performance, 'now')
        .mockReturnValueOnce(100)
        .mockReturnValueOnce(250)
        .mockReturnValue(250);
      const markSpy = jest.spyOn(performance, 'mark');
      const measureSpy = jest.spyOn(performance, 'measure');

      controller._performanceMark('start');
      controller._performanceMark('end');

      const duration = controller._performanceMeasure('measure', 'start', 'end');

      expect(duration).toBe(150);
      expect(eventBus.dispatch).toHaveBeenCalledWith(
        CHARACTER_BUILDER_EVENTS.CHARACTER_BUILDER_PERFORMANCE_WARNING,
        expect.objectContaining({
          controller: controller.constructor.name,
          measurement: 'measure',
          duration: 150,
          threshold: 100,
        })
      );
      expect(markSpy).toHaveBeenCalledTimes(2);
      expect(measureSpy).toHaveBeenCalledWith('measure', 'start', 'end');
      expect(logger.debug).toHaveBeenCalledWith(
        'Performance measurement: measure',
        expect.objectContaining({ duration: '150.00ms' })
      );

      const measurements = controller._getPerformanceMeasurements();
      expect(measurements).not.toBe(controller._getPerformanceMeasurements());
      expect(measurements.get('measure')).toMatchObject({
        duration: 150,
        startMark: 'start',
        endMark: 'end',
      });

      nowSpy.mockRestore();
    });

    it('should create an end mark automatically when omitted', () => {
      const nowSpy = jest
        .spyOn(performance, 'now')
        .mockReturnValueOnce(10)
        .mockReturnValueOnce(60)
        .mockReturnValue(60);
      const markSpy = jest.spyOn(performance, 'mark');

      controller._performanceMark('only-start');
      const duration = controller._performanceMeasure('auto', 'only-start');

      expect(duration).toBe(50);
      expect(markSpy).toHaveBeenCalledWith('auto-end');
      nowSpy.mockRestore();
    });

    it('should warn and return null when marks are missing', () => {
      const result = controller._performanceMeasure('missing', 'not-found');

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        'Performance marks not found for measurement: missing',
        expect.objectContaining({ hasStartMark: false, hasEndMark: true })
      );
    });

    it('should handle measurement failures gracefully', () => {
      const nowSpy = jest.spyOn(performance, 'now');
      nowSpy
        .mockReturnValueOnce(100)
        .mockReturnValueOnce(400)
        .mockReturnValueOnce(500)
        .mockReturnValueOnce(650)
        .mockReturnValue(650);
      controller._performanceMark('failure-start');
      controller._performanceMark('failure-end');
      const baselineDuration = controller._performanceMeasure(
        'baseline',
        'failure-start',
        'failure-end'
      );
      expect(baselineDuration).toBeGreaterThan(0);
      const dispatchSpy = jest
        .spyOn(controller.eventBus, 'dispatch')
        .mockImplementation((eventType, payload) => {
          if (eventType === CHARACTER_BUILDER_EVENTS.CHARACTER_BUILDER_PERFORMANCE_WARNING) {
            throw new Error('dispatch failure');
          }
          return Promise.resolve(true);
        });
      nowSpy.mockImplementationOnce(() => 1000);
      controller._performanceMark('failure-start');
      nowSpy.mockImplementationOnce(() => 1200);
      controller._performanceMark('failure-end');

      const result = controller._performanceMeasure(
        'failure',
        'failure-start',
        'failure-end'
      );

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenLastCalledWith(
        'Failed to measure performance: failure',
        expect.any(Error)
      );
    });

    it('should clear performance data by prefix or entirely', () => {
      jest
        .spyOn(performance, 'now')
        .mockReturnValueOnce(100)
        .mockReturnValueOnce(300)
        .mockReturnValue(500);
      const clearMarksSpy = jest.spyOn(performance, 'clearMarks');
      const clearMeasuresSpy = jest.spyOn(performance, 'clearMeasures');

      controller._performanceMark('test-start');
      controller._performanceMark('other-start');
      controller._performanceMark('test-end');
      controller._performanceMeasure('test-measure', 'test-start', 'test-end');
      controller._performanceMeasure('other-measure', 'other-start', 'test-end');

      expect(controller._getPerformanceMeasurements().has('test-measure')).toBe(
        true
      );

      controller._clearPerformanceData('test');
      expect(clearMarksSpy).toHaveBeenCalledWith('test-start');
      expect(clearMeasuresSpy).toHaveBeenCalledWith('test-measure');
      expect(controller._getPerformanceMeasurements().has('test-measure')).toBe(
        false
      );
      expect(controller._getPerformanceMeasurements().has('other-measure')).toBe(
        true
      );

      controller._clearPerformanceData();
      expect(logger.debug).toHaveBeenCalledWith('Cleared performance data', {
        prefix: null,
      });
      expect(controller._getPerformanceMeasurements().size).toBe(0);
      expect(clearMarksSpy).toHaveBeenLastCalledWith();
      expect(clearMeasuresSpy).toHaveBeenLastCalledWith();
    });
  });

  describe('memory helpers', () => {
    it('should manage weak references safely', () => {
      const key = {};
      controller._setWeakReference(key, 'value');
      expect(controller._getWeakReference(key)).toBe('value');
      expect(() => controller._setWeakReference(null, 'nope')).toThrow(
        'WeakMap key must be an object'
      );
    });

    it('should track weak objects and validate inputs', () => {
      const obj = {};
      controller._trackWeakly(obj);
      expect(controller._isWeaklyTracked(obj)).toBe(true);
      expect(() => controller._trackWeakly('not-object')).toThrow(
        'WeakSet value must be an object'
      );
    });
  });

  describe('debounce and throttle utilities', () => {
    it('should debounce function calls with flush, cancel, and pending helpers', () => {
      jest.useFakeTimers();
      jest.setSystemTime(0);
      const fn = jest.fn();
      const debounced = controller._debounce(fn, 50, {
        leading: true,
        trailing: true,
        maxWait: 100,
      });

      debounced('a');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(debounced.pending()).toBe(true);

      jest.advanceTimersByTime(25);
      debounced('b');

      jest.advanceTimersByTime(50);
      expect(fn).toHaveBeenCalledTimes(2);

      debounced.cancel();
      expect(debounced.pending()).toBe(false);

      jest.setSystemTime(500);
      debounced('c');
      expect(fn).toHaveBeenCalledTimes(4);

      debounced('d');
      jest.advanceTimersByTime(10);
      debounced.flush();
      expect(fn).toHaveBeenCalledTimes(5);
    });

    it('should reuse debounced handlers by key', () => {
      const handler = controller._getDebouncedHandler('key', jest.fn(), 10);
      const handler2 = controller._getDebouncedHandler('key', jest.fn(), 10);
      expect(handler).toBe(handler2);
    });

    it('should throttle function calls with cancel and flush support', () => {
      jest.useFakeTimers();
      const fn = jest.fn();
      const throttled = controller._throttle(fn, 100, {
        leading: true,
        trailing: true,
      });

      throttled('first');
      expect(fn).toHaveBeenCalledTimes(1);

      throttled('second');
      jest.advanceTimersByTime(50);
      expect(fn).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(60);
      expect(fn).toHaveBeenCalledTimes(2);

      throttled.cancel();
      throttled('third');
      jest.advanceTimersByTime(120);
      expect(fn).toHaveBeenCalledTimes(3);

      throttled('fourth');
      jest.advanceTimersByTime(20);
      throttled.flush();
      expect(fn).toHaveBeenCalledTimes(4);
    });

    it('should reuse throttled handlers by key', () => {
      const handler = controller._getThrottledHandler('key', jest.fn(), 10);
      const handler2 = controller._getThrottledHandler('key', jest.fn(), 10);
      expect(handler).toBe(handler2);
    });
  });

  describe('cleanup tasks and destruction guards', () => {
    it('should register cleanup tasks and execute them in LIFO order', async () => {
      const first = jest.fn();
      const second = jest.fn();

      controller._registerCleanupTask(first, 'first');
      controller._registerCleanupTask(second, 'second');

      await controller.destroy();

      expect(
        second.mock.invocationCallOrder[0]
      ).toBeLessThan(first.mock.invocationCallOrder[0]);
      expect(logger.debug).toHaveBeenCalledWith(
        `${controller.constructor.name}: Registered cleanup task: first`
      );
      expect(logger.debug).toHaveBeenCalledWith(
        `${controller.constructor.name}: Registered cleanup task: second`
      );
    });

    it('should reject non-function cleanup tasks', () => {
      expect(() => controller._registerCleanupTask('nope')).toThrow(
        new TypeError('Cleanup task must be a function')
      );
    });

    it('should guard destroyed controllers', async () => {
      const safe = controller._makeDestructionSafe(() => 'ok', 'test');
      expect(safe()).toBe('ok');

      await controller.destroy();

      expect(controller._checkDestroyed()).toBe(true);
      expect(() => controller._checkDestroyed('operate')).toThrow(
        `${controller.constructor.name}: Cannot operate - controller is destroyed`
      );
      expect(controller.isDestroyed).toBe(true);
      expect(controller.isDestroying).toBe(false);
      expect(() => safe()).toThrow(
        `${controller.constructor.name}: Cannot call test - controller is destroyed`
      );
    });

    it('should warn when destruction is called more than once', async () => {
      const warnSpy = jest.spyOn(logger, 'warn');

      await controller.destroy();
      controller.destroy();
      expect(warnSpy).toHaveBeenCalledWith(
        `${controller.constructor.name}: Already destroyed, skipping destruction`
      );
    });

    it('should warn when destruction is re-entered while in progress', async () => {
      const warnSpy = jest.spyOn(logger, 'warn');

      class ReentrantController extends TestController {
        _preDestroy() {
          super._preDestroy();
          if (!this._reentered) {
            this._reentered = true;
            this.destroy();
          }
        }
      }

      await controller.destroy();
      controller = new ReentrantController(testBase.mockDependencies);
      testBase.controller = controller;
      await controller.initialize();
      controller.destroy();

      expect(warnSpy).toHaveBeenCalledWith(
        `${controller.constructor.name}: Destruction already in progress`
      );
    });
  });
});
