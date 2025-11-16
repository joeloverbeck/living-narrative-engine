/**
 * @file Integration tests for BaseCharacterBuilderController async utilities toolkit
 * @description Tests debounce, throttle, timeout management, and async toolkit registration/cleanup
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { BaseCharacterBuilderControllerIntegrationTestBase } from './BaseCharacterBuilderController.integration.testbase.js';
import BaseCharacterBuilderController from '../../../../src/characterBuilder/controllers/BaseCharacterBuilderController.js';

class AsyncUtilitiesTestController extends BaseCharacterBuilderController {
  constructor(dependencies) {
    super(dependencies);
    this.callLog = [];
  }

  async initialize() {
    // Override to bypass heavy initialization
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

  scheduleTimeout(callback, delay) {
    return this._setTimeout(callback, delay);
  }

  clearScheduledTimeout(id) {
    this._clearTimeout(id);
  }

  logCall(name) {
    this.callLog.push({ name, timestamp: Date.now() });
  }

  getCallLog() {
    return [...this.callLog];
  }

  clearCallLog() {
    this.callLog = [];
  }
}

describe('BaseCharacterBuilderController - Async Utilities Integration', () => {
  let testBase;
  let controller;

  beforeEach(async () => {
    testBase = new BaseCharacterBuilderControllerIntegrationTestBase();
    await testBase.setup({ includeFullDOM: false, mockGlobalFunctions: true });

    controller = new AsyncUtilitiesTestController(testBase.getDependencies());
    jest.useFakeTimers();
  });

  afterEach(async () => {
    jest.useRealTimers();
    if (controller && typeof controller.destroy === 'function') {
      await controller.destroy();
    }
    await testBase.cleanup();
  });

  describe('Debounce Functionality', () => {
    it('should create debounced function that delays execution', () => {
      const mockFn = jest.fn();
      const debounced = controller.createDebounced(mockFn, 100);

      debounced();
      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(50);
      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(50);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should reset debounce timer on repeated calls', () => {
      const mockFn = jest.fn();
      const debounced = controller.createDebounced(mockFn, 100);

      debounced();
      jest.advanceTimersByTime(50);
      debounced(); // Reset timer
      jest.advanceTimersByTime(50);
      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(50);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should support leading edge debounce option', () => {
      const mockFn = jest.fn();
      const debounced = controller.createDebounced(mockFn, 100, { leading: true });

      debounced();
      expect(mockFn).toHaveBeenCalledTimes(1); // Called immediately

      jest.advanceTimersByTime(100);
      debounced();
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should support trailing edge debounce option', () => {
      const mockFn = jest.fn();
      const debounced = controller.createDebounced(mockFn, 100, { trailing: true });

      debounced();
      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should handle rapid successive calls correctly', () => {
      const mockFn = jest.fn();
      const debounced = controller.createDebounced(mockFn, 100);

      for (let i = 0; i < 10; i++) {
        debounced();
        jest.advanceTimersByTime(20);
      }

      expect(mockFn).not.toHaveBeenCalled();
      jest.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Throttle Functionality', () => {
    it('should create throttled function that limits execution rate', () => {
      const mockFn = jest.fn();
      const throttled = controller.createThrottled(mockFn, 100);

      throttled();
      expect(mockFn).toHaveBeenCalledTimes(1);

      throttled();
      throttled();
      expect(mockFn).toHaveBeenCalledTimes(1); // Still 1, throttled

      jest.advanceTimersByTime(100);
      throttled();
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should execute immediately on first call', () => {
      const mockFn = jest.fn();
      const throttled = controller.createThrottled(mockFn, 100);

      throttled();
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should support leading edge throttle option', () => {
      const mockFn = jest.fn();
      const throttled = controller.createThrottled(mockFn, 100, { leading: true });

      throttled();
      expect(mockFn).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(100);
      throttled();
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should support trailing edge throttle option', () => {
      const mockFn = jest.fn();
      const throttled = controller.createThrottled(mockFn, 100, { trailing: true });

      throttled();
      throttled();
      throttled();
      
      jest.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalled();
    });

    it('should handle high-frequency calls efficiently', () => {
      const mockFn = jest.fn();
      const throttled = controller.createThrottled(mockFn, 100);

      // Simulate 50 rapid calls
      for (let i = 0; i < 50; i++) {
        throttled();
        jest.advanceTimersByTime(10);
      }

      // Should have been called approximately every 100ms
      expect(mockFn.mock.calls.length).toBeLessThan(10);
      expect(mockFn.mock.calls.length).toBeGreaterThan(0);
    });
  });

  describe('Cached Handler Management', () => {
    it('should cache and reuse debounced handlers by key', () => {
      const mockFn = jest.fn();
      
      const handler1 = controller.getDebouncedHandler('search', mockFn, 100);
      const handler2 = controller.getDebouncedHandler('search', mockFn, 100);

      expect(handler1).toBe(handler2); // Same instance
    });

    it('should cache and reuse throttled handlers by key', () => {
      const mockFn = jest.fn();
      
      const handler1 = controller.getThrottledHandler('scroll', mockFn, 100);
      const handler2 = controller.getThrottledHandler('scroll', mockFn, 100);

      expect(handler1).toBe(handler2);
    });

    it('should create separate handlers for different keys', () => {
      const mockFn = jest.fn();
      
      const searchHandler = controller.getDebouncedHandler('search', mockFn, 100);
      const filterHandler = controller.getDebouncedHandler('filter', mockFn, 100);

      expect(searchHandler).not.toBe(filterHandler);
    });

    it('should cleanup cached handlers on destroy', async () => {
      const mockFn = jest.fn();
      
      controller.getDebouncedHandler('search', mockFn, 100);
      controller.getThrottledHandler('scroll', mockFn, 100);

      await controller.destroy();

      expect(testBase.mocks.logger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/cleanup|handler|async/i)
      );
    });
  });

  describe('Timeout Management', () => {
    it('should schedule timeout and execute callback', () => {
      const mockCallback = jest.fn();
      
      const timeoutId = controller.scheduleTimeout(mockCallback, 100);
      
      expect(mockCallback).not.toHaveBeenCalled();
      expect(timeoutId).toBeTruthy();
      
      jest.advanceTimersByTime(100);
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('should clear scheduled timeout', () => {
      const mockCallback = jest.fn();
      
      const timeoutId = controller.scheduleTimeout(mockCallback, 100);
      controller.clearScheduledTimeout(timeoutId);
      
      jest.advanceTimersByTime(100);
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should track active timeouts for cleanup', async () => {
      const mockCallback1 = jest.fn();
      const mockCallback2 = jest.fn();
      
      controller.scheduleTimeout(mockCallback1, 100);
      controller.scheduleTimeout(mockCallback2, 200);

      await controller.destroy();

      // Should have cleared both timeouts
      expect(global.clearTimeout).toHaveBeenCalledTimes(2);
    });

    it('should handle timeout errors gracefully', () => {
      const errorCallback = () => {
        throw new Error('Timeout callback error');
      };
      
      controller.scheduleTimeout(errorCallback, 100);
      
      expect(() => {
        jest.advanceTimersByTime(100);
      }).not.toThrow(); // Should be caught internally

      expect(testBase.mocks.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Timeout callback error')
      );
    });
  });

  describe('AsyncUtilitiesToolkit Integration', () => {
    it('should register toolkit on initialization', async () => {
      await controller.initialize();

      expect(testBase.mocks.logger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/register|toolkit|async/i)
      );
    });

    it('should unregister toolkit on destruction', async () => {
      await controller.initialize();
      await controller.destroy();

      expect(testBase.mocks.logger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/unregister|toolkit|cleanup/i)
      );
    });

    it('should provide toolkit utilities throughout controller lifecycle', async () => {
      await controller.initialize();

      // Should be able to use toolkit utilities
      const mockFn = jest.fn();
      const debounced = controller.createDebounced(mockFn, 100);
      
      debounced();
      jest.advanceTimersByTime(100);
      
      expect(mockFn).toHaveBeenCalled();
    });

    it('should prevent toolkit usage after destruction', async () => {
      await controller.initialize();
      await controller.destroy();

      expect(() => {
        controller.createDebounced(() => {}, 100);
      }).toThrow();
    });
  });

  describe('Real-World Usage Patterns', () => {
    it('should support search input debouncing pattern', async () => {
      const searchResults = [];
      const performSearch = (query) => {
        searchResults.push({ query, timestamp: Date.now() });
      };

      const debouncedSearch = controller.createDebounced(performSearch, 300);

      // Simulate rapid typing
      debouncedSearch('a');
      jest.advanceTimersByTime(100);
      debouncedSearch('ab');
      jest.advanceTimersByTime(100);
      debouncedSearch('abc');
      jest.advanceTimersByTime(300);

      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].query).toBe('abc');
    });

    it('should support scroll event throttling pattern', () => {
      const scrollPositions = [];
      const trackScroll = (position) => {
        scrollPositions.push(position);
      };

      const throttledScroll = controller.createThrottled(trackScroll, 100);

      // Simulate continuous scrolling
      for (let i = 0; i < 20; i++) {
        throttledScroll(i * 10);
        jest.advanceTimersByTime(20);
      }

      // Should have throttled to roughly every 100ms
      expect(scrollPositions.length).toBeLessThan(10);
      expect(scrollPositions.length).toBeGreaterThan(0);
    });

    it('should support form validation with debounce and throttle', () => {
      const validationResults = [];
      const validate = (field, value) => {
        validationResults.push({ field, value, timestamp: Date.now() });
      };

      // Debounce for text inputs (wait for user to stop typing)
      const debouncedValidate = controller.getDebouncedHandler(
        'text-validation',
        validate,
        300
      );

      // Throttle for immediate feedback fields (e.g., password strength)
      const throttledValidate = controller.getThrottledHandler(
        'password-validation',
        validate,
        100
      );

      // Simulate text input
      debouncedValidate('email', 'test@example.com');
      jest.advanceTimersByTime(300);

      // Simulate password typing
      throttledValidate('password', 'pass');
      jest.advanceTimersByTime(50);
      throttledValidate('password', 'password');
      jest.advanceTimersByTime(100);

      expect(validationResults.length).toBeGreaterThan(0);
    });

    it('should cleanup all async utilities on controller destruction', async () => {
      await controller.initialize();

      // Create various async utilities
      controller.createDebounced(() => {}, 100);
      controller.createThrottled(() => {}, 100);
      controller.scheduleTimeout(() => {}, 100);
      controller.getDebouncedHandler('test', () => {}, 100);

      await controller.destroy();

      // All should be cleaned up
      expect(global.clearTimeout).toHaveBeenCalled();
      expect(testBase.mocks.logger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/cleanup|clear|destroy/i)
      );
    });
  });
});
