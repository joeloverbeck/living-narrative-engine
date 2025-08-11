/**
 * @file Test bed for TraceQueueProcessor testing
 */

import { jest } from '@jest/globals';
import { TraceQueueProcessor } from '../../../src/actions/tracing/traceQueueProcessor.js';
import { TracePriority } from '../../../src/actions/tracing/tracePriority.js';
import { TestTimerService } from '../../../src/actions/tracing/timerService.js';
import { createMockLogger } from '../mockFactories/loggerMocks.js';

/**
 * Test bed for TraceQueueProcessor with comprehensive testing support
 */
export class TraceQueueProcessorTestBed {
  constructor() {
    this.mockLogger = null;
    this.mockStorageAdapter = null;
    this.mockEventBus = null;
    this.processor = null;
    this.config = null;
    this.timerService = null;
    
    // Test data helpers
    this.traceCounter = 0;
    this.testTraces = [];
  }

  /**
   * Initialize test bed with default configuration
   */
  setup() {
    this.mockLogger = createMockLogger();
    // Use a simpler mock that doesn't rely on setTimeout for tests
    this.mockStorageAdapter = this.createSimpleMockStorageAdapter();
    
    this.mockEventBus = {
      dispatch: jest.fn(),
    };

    this.config = {
      maxQueueSize: 100,
      batchSize: 5,
      batchTimeout: 100,
      maxRetries: 2,
      memoryLimit: 1024 * 1024, // 1MB
      enableParallelProcessing: true,
      storageKey: 'test-traces',
      maxStoredTraces: 50,
    };

    // Create test timer service for controlled execution
    this.timerService = new TestTimerService();

    this.processor = new TraceQueueProcessor({
      storageAdapter: this.mockStorageAdapter,
      logger: this.mockLogger,
      eventBus: this.mockEventBus,
      config: this.config,
      timerService: this.timerService,
    });

    return this;
  }
  
  /**
   * Create a simple mock storage adapter that works well with fake timers
   *
   * @returns {object} Mock storage adapter
   */
  createSimpleMockStorageAdapter() {
    const storage = new Map();
    
    return {
      getItem: jest.fn().mockImplementation((key) => {
        // Return synchronously wrapped in Promise for immediate resolution
        return Promise.resolve(storage.get(key) || null);
      }),
      setItem: jest.fn().mockImplementation((key, value) => {
        storage.set(key, value);
        // Return synchronously wrapped in Promise
        return Promise.resolve(undefined);
      }),
      removeItem: jest.fn().mockImplementation((key) => {
        storage.delete(key);
        return Promise.resolve(undefined);
      }),
      getAllKeys: jest.fn().mockImplementation(() => {
        return Promise.resolve([...storage.keys()]);
      }),
    };
  }

  /**
   * Create processor with custom configuration
   *
   * @param {object} customConfig - Custom configuration options
   * @returns {TraceQueueProcessorTestBed} This test bed instance
   */
  withConfig(customConfig) {
    this.config = { ...this.config, ...customConfig };
    
    // Ensure we have a storage adapter
    if (!this.mockStorageAdapter) {
      this.mockStorageAdapter = this.createSimpleMockStorageAdapter();
    }
    
    // Ensure we have a timer service
    if (!this.timerService) {
      this.timerService = new TestTimerService();
    }
    
    this.processor = new TraceQueueProcessor({
      storageAdapter: this.mockStorageAdapter,
      logger: this.mockLogger,
      eventBus: this.mockEventBus,
      config: this.config,
      timerService: this.timerService,
    });

    return this;
  }

  /**
   * Create processor without event bus
   *
   * @returns {TraceQueueProcessorTestBed} This test bed instance
   */
  withoutEventBus() {
    this.mockEventBus = null;
    
    // Ensure we have a storage adapter
    if (!this.mockStorageAdapter) {
      this.mockStorageAdapter = this.createSimpleMockStorageAdapter();
    }
    
    // Ensure we have a timer service
    if (!this.timerService) {
      this.timerService = new TestTimerService();
    }
    
    this.processor = new TraceQueueProcessor({
      storageAdapter: this.mockStorageAdapter,
      logger: this.mockLogger,
      eventBus: null,
      config: this.config,
      timerService: this.timerService,
    });

    return this;
  }

  /**
   * Create mock trace object
   *
   * @param {object} options - Trace options
   * @returns {object} Mock trace object
   */
  createMockTrace(options = {}) {
    const trace = {
      actionId: options.actionId || `test:action-${++this.traceCounter}`,
      actorId: options.actorId || 'test-actor',
      isComplete: options.isComplete !== undefined ? options.isComplete : false,
      hasError: options.hasError !== undefined ? options.hasError : false,
      duration: options.duration || null,
      timestamp: options.timestamp || Date.now(),
      toJSON: jest.fn().mockReturnValue({
        actionId: options.actionId || `test:action-${this.traceCounter}`,
        actorId: options.actorId || 'test-actor',
        traceType: 'execution',
        timestamp: options.timestamp || Date.now(),
        data: options.data || { test: true },
      }),
      ...options.additionalProps,
    };

    this.testTraces.push(trace);
    return trace;
  }

  /**
   * Create structured trace mock
   *
   * @param {object} options - Structured trace options
   * @returns {object} Mock structured trace
   */
  createMockStructuredTrace(options = {}) {
    const tracedActions = new Map();
    tracedActions.set(options.actionId || 'structured-action', {
      stages: options.stages || {
        start: { timestamp: 1000 },
        end: { timestamp: 2000 },
      },
    });

    const trace = {
      getTracedActions: jest.fn().mockReturnValue(tracedActions),
      getSpans: jest.fn().mockReturnValue(options.spans || ['span1']),
      ...options.additionalProps,
    };

    this.testTraces.push(trace);
    return trace;
  }

  /**
   * Create multiple test traces
   *
   * @param {number} count - Number of traces to create
   * @param {object} baseOptions - Base options for all traces
   * @returns {Array} Array of mock traces
   */
  createMultipleTraces(count, baseOptions = {}) {
    const traces = [];
    for (let i = 0; i < count; i++) {
      const trace = this.createMockTrace({
        ...baseOptions,
        actionId: `${baseOptions.actionId || 'batch:action'}-${i}`,
      });
      traces.push(trace);
    }
    return traces;
  }

  /**
   * Enqueue test traces with various priorities
   *
   * @param {number} count - Number of traces to enqueue
   * @returns {Array} Array of enqueued traces
   */
  enqueueTestTraces(count = 5) {
    const traces = [];
    const priorities = [TracePriority.LOW, TracePriority.NORMAL, TracePriority.HIGH, TracePriority.CRITICAL];
    
    for (let i = 0; i < count; i++) {
      const priority = priorities[i % priorities.length];
      const trace = this.createMockTrace({
        actionId: `priority:${priority}-${i}`,
        priority,
      });
      
      this.processor.enqueue(trace, priority);
      traces.push(trace);
    }
    
    return traces;
  }

  /**
   * Fill queue to capacity
   *
   * @param {number} [capacity] - Queue capacity (uses config if not provided)
   * @returns {Array} Array of enqueued traces
   */
  fillQueueToCapacity(capacity) {
    const maxSize = capacity || this.config.maxQueueSize;
    return this.createMultipleTraces(maxSize, { actionId: 'capacity-test' });
  }

  /**
   * Simulate storage failure
   *
   * @param {Error} [error] - Error to throw (default: generic error)
   */
  simulateStorageFailure(error) {
    const testError = error || new Error('Storage failure');
    this.mockStorageAdapter.setItem.mockRejectedValue(testError);
    this.mockStorageAdapter.getItem.mockRejectedValue(testError);
  }

  /**
   * Simulate storage success
   */
  simulateStorageSuccess() {
    this.mockStorageAdapter.setItem.mockResolvedValue(undefined);
    this.mockStorageAdapter.getItem.mockResolvedValue([]);
  }

  /**
   * Wait for processing to complete
   *
   * @param {number} [timeout] - Timeout in milliseconds
   * @returns {Promise<void>}
   */
  async waitForProcessing(timeout = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const stats = this.processor.getQueueStats();
      if (stats.totalSize === 0 && !stats.isProcessing) {
        return; // Processing complete
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    
    throw new Error('Timeout waiting for processing to complete');
  }

  /**
   * Advance timers and flush promises
   *
   * @param {number} timeMs - Time to advance
   * @returns {Promise<void>}
   */
  async advanceTimersAndFlush(timeMs) {
    // With the TestTimerService, we can directly control timer execution
    // This avoids all the issues with Jest's fake timers
    
    // First trigger any immediate timers (like the first batch)
    if (timeMs > 0) {
      // Advance simulated time for delayed timers
      await this.timerService.advanceTime(timeMs);
    } else {
      // Trigger all immediate timers
      await this.timerService.triggerAll();
    }
    
    // Process any timers that were scheduled during execution
    // Keep processing until no more timers are pending or queue is empty
    let maxIterations = 10; // Safety limit to prevent infinite loops
    while (maxIterations-- > 0) {
      // Allow promises to settle
      await Promise.resolve();
      await new Promise(resolve => process.nextTick(resolve));
      
      // Check if there are more timers to process
      if (!this.timerService.hasPending()) {
        // No more pending timers
        const stats = this.processor.getQueueStats();
        if (stats.totalSize === 0) {
          // Queue is empty, we're done
          break;
        }
        // Queue has items but no timers scheduled - this shouldn't happen
        // but let's try advancing time to trigger any delayed timers
        await this.timerService.advanceTime(100);
      } else {
        // Trigger all pending timers
        await this.timerService.triggerAll();
      }
    }
    
    // Final promise flush
    await Promise.resolve();
    await new Promise(resolve => process.nextTick(resolve));
  }

  /**
   * Wait for processing to complete with better async handling
   *
   * @param {number} [timeout] - Timeout in milliseconds
   * @returns {Promise<void>}
   */
  async waitForProcessingComplete(timeout = 2000) {
    let attempts = 0;
    const maxAttempts = timeout / 25; // Check every 25ms for better responsiveness
    
    while (attempts < maxAttempts) {
      // First advance any immediate timers
      await jest.advanceTimersByTimeAsync(0);
      await this.flushPromises();
      
      const stats = this.processor.getQueueStats();
      if (stats.totalSize === 0 && !stats.isProcessing) {
        // Processing is done - do final flush to ensure completion
        await this.flushPromises();
        return;
      }
      
      // Advance a small amount and flush
      await jest.advanceTimersByTimeAsync(25);
      await this.flushPromises();
      attempts++;
    }
    
    // Log current state for debugging if processing didn't complete
    const finalStats = this.processor.getQueueStats();
    console.warn(`Processing didn't complete: totalSize=${finalStats.totalSize}, isProcessing=${finalStats.isProcessing}`);
  }

  /**
   * Flush all pending promises
   *
   * @returns {Promise<void>}
   */
  async flushPromises() {
    // Multiple rounds of promise flushing to handle nested async operations
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      // Also flush any microtasks
      await Promise.resolve();
    }
  }

  /**
   * Get processor metrics
   *
   * @returns {object} Current metrics
   */
  getMetrics() {
    return this.processor.getMetrics();
  }

  /**
   * Get queue statistics
   *
   * @returns {object} Queue statistics
   */
  getQueueStats() {
    return this.processor.getQueueStats();
  }

  /**
   * Get storage adapter call history
   *
   * @returns {object} Call history for storage methods
   */
  getStorageCallHistory() {
    return {
      setItem: this.mockStorageAdapter.setItem.mock.calls,
      getItem: this.mockStorageAdapter.getItem.mock.calls,
      removeItem: this.mockStorageAdapter.removeItem.mock.calls,
      getAllKeys: this.mockStorageAdapter.getAllKeys.mock.calls,
    };
  }

  /**
   * Get event bus call history
   *
   * @returns {Array} Event dispatch calls
   */
  getEventBusCallHistory() {
    if (!this.mockEventBus) {
      return [];
    }
    return this.mockEventBus.dispatch.mock.calls;
  }

  /**
   * Verify event was dispatched
   *
   * @param {string} eventType - Event type to verify
   * @returns {boolean} True if event was dispatched
   */
  wasEventDispatched(eventType) {
    if (!this.mockEventBus) {
      return false;
    }
    
    return this.mockEventBus.dispatch.mock.calls.some((call) => {
      const event = call[0];
      return event && event.type === eventType;
    });
  }

  /**
   * Get all traces from storage
   *
   * @returns {Array} Stored traces
   */
  getStoredTraces() {
    const setItemCalls = this.mockStorageAdapter.setItem.mock.calls;
    if (setItemCalls.length === 0) {
      return [];
    }
    
    // Return traces from last setItem call
    const lastCall = setItemCalls[setItemCalls.length - 1];
    return lastCall[1] || []; // Second parameter is the traces array
  }

  /**
   * Check if circuit breaker is open
   *
   * @returns {boolean} True if circuit breaker is open
   */
  isCircuitBreakerOpen() {
    const stats = this.processor.getQueueStats();
    return stats.circuitBreakerOpen;
  }

  /**
   * Force circuit breaker to close (for testing recovery)
   */
  forceCircuitBreakerClose() {
    // Simulate successful processing to close circuit breaker
    this.simulateStorageSuccess();
    // The circuit breaker should close on next successful batch
  }

  /**
   * Enhanced cleanup that ensures proper shutdown
   */
  async ensureProperShutdown() {
    if (this.processor) {
      try {
        // Force close circuit breaker if needed
        if (this.isCircuitBreakerOpen()) {
          this.forceCircuitBreakerClose();
        }
        
        // The shutdown method has been fixed to work with fake timers
        // so we no longer need to switch timer modes
        await this.processor.shutdown();
      } catch (error) {
        // Log but don't throw shutdown errors in cleanup
        console.warn('Processor shutdown error in cleanup:', error.message);
      }
    }
  }

  /**
   * Reset all mocks and counters
   */
  reset() {
    if (this.mockLogger) {
      jest.clearAllMocks();
    }
    
    if (this.timerService) {
      this.timerService.clearAll();
    }
    
    this.traceCounter = 0;
    this.testTraces = [];
  }

  /**
   * Cleanup test bed
   */
  async cleanup() {
    await this.ensureProperShutdown();
    this.reset();
    this.processor = null;
  }
}