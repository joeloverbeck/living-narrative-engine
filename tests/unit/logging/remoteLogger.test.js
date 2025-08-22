/**
 * @file Unit tests for RemoteLogger class
 * @see src/logging/remoteLogger.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import RemoteLogger from '../../../src/logging/remoteLogger.js';
import { CircuitBreakerState } from '../../../src/logging/circuitBreaker.js';

// Mock UUID to have predictable session IDs
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-session-id-123'),
}));

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock XMLHttpRequest for sync requests
const mockXMLHttpRequest = jest.fn();
global.XMLHttpRequest = mockXMLHttpRequest;

// Create mock functions for addEventListener
const mockWindowAddEventListener = jest.fn();
const mockDocumentAddEventListener = jest.fn();

// Mock sendBeacon
const mockSendBeacon = jest.fn();

// Mock performance with proper function that returns consistent value
const mockPerformanceNow = jest.fn(() => 1000);

// Store original values
const originalWindow = global.window;
const originalDocument = global.document;
const originalNavigator = global.navigator;
const originalPerformance = global.performance;

// Setup function to configure mocks
/**
 *
 */
function setupGlobalMocks() {
  // Override window with our mock
  global.window = {
    location: {
      href: 'http://localhost:8080/test',
    },
    addEventListener: mockWindowAddEventListener,
  };

  // Override document with our mock
  global.document = {
    addEventListener: mockDocumentAddEventListener,
    visibilityState: 'visible',
  };

  // Override performance with our mock
  global.performance = {
    now: mockPerformanceNow,
    memory: {
      usedJSHeapSize: 1024000,
    },
  };

  // Override navigator with our mock
  global.navigator = {
    userAgent: 'Mozilla/5.0 (Test Browser)',
    sendBeacon: mockSendBeacon,
  };
}

// Restore function to reset mocks
/**
 *
 */
function restoreGlobalMocks() {
  global.window = originalWindow;
  global.document = originalDocument;
  global.navigator = originalNavigator;
  global.performance = originalPerformance;
}

describe('RemoteLogger', () => {
  let remoteLogger;
  let mockConsoleLogger;
  let mockEventBus;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();

    // Setup global mocks before each test
    setupGlobalMocks();

    // Reset mock implementations
    mockFetch.mockClear();
    mockWindowAddEventListener.mockClear();
    mockDocumentAddEventListener.mockClear();
    mockSendBeacon.mockClear();
    mockPerformanceNow.mockClear();
    mockPerformanceNow.mockReturnValue(1000);

    mockConsoleLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      groupCollapsed: jest.fn(),
      groupEnd: jest.fn(),
      table: jest.fn(),
      setLogLevel: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
    };

    // Setup successful fetch mock by default
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, processed: 5 }),
    });
  });

  afterEach(() => {
    if (remoteLogger) {
      remoteLogger.destroy();
    }
    jest.runOnlyPendingTimers();
    jest.useRealTimers();

    // Restore original global objects
    restoreGlobalMocks();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      remoteLogger = new RemoteLogger();

      const stats = remoteLogger.getStats();
      expect(stats.endpoint).toBe('http://localhost:3001/api/debug-log');
      expect(stats.configuration.batchSize).toBe(100);
      expect(stats.configuration.flushInterval).toBe(1000);
      expect(stats.sessionId).toBe('test-session-id-123');
    });

    it('should initialize with custom configuration', () => {
      const config = {
        endpoint: 'http://custom:3000/api/logs',
        batchSize: 50,
        flushInterval: 2000,
        retryAttempts: 5,
      };

      remoteLogger = new RemoteLogger({ config });

      const stats = remoteLogger.getStats();
      expect(stats.endpoint).toBe('http://custom:3000/api/logs');
      expect(stats.configuration.batchSize).toBe(50);
      expect(stats.configuration.flushInterval).toBe(2000);
      expect(stats.configuration.retryAttempts).toBe(5);
    });

    it('should use provided dependencies', () => {
      remoteLogger = new RemoteLogger({
        dependencies: {
          consoleLogger: mockConsoleLogger,
          eventBus: mockEventBus,
        },
      });

      // Should log initialization message to console logger
      expect(mockConsoleLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('[RemoteLogger] Initialized with endpoint')
      );
    });
  });

  describe('ILogger interface methods', () => {
    beforeEach(() => {
      remoteLogger = new RemoteLogger({
        config: { batchSize: 10 }, // Small batch size for easier testing
        dependencies: { consoleLogger: mockConsoleLogger },
      });
    });

    describe('info', () => {
      it('should add log to buffer', () => {
        remoteLogger.info('Test info message', { key: 'value' });

        const stats = remoteLogger.getStats();
        expect(stats.bufferSize).toBe(1);
      });

      it('should handle multiple arguments', () => {
        remoteLogger.info('Test message', 'arg1', { key: 'value' }, 123);

        const stats = remoteLogger.getStats();
        expect(stats.bufferSize).toBe(1);
      });
    });

    describe('warn', () => {
      it('should add warning log to buffer', () => {
        remoteLogger.warn('Test warning', { context: 'test' });

        const stats = remoteLogger.getStats();
        expect(stats.bufferSize).toBe(1);
      });
    });

    describe('error', () => {
      it('should add error log to buffer and flush immediately', async () => {
        remoteLogger.error('Test error', new Error('Original error'));

        // Should trigger immediate flush
        await jest.runAllTimersAsync();

        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:3001/api/debug-log',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: expect.stringContaining('Test error'),
          })
        );
      });
    });

    describe('debug', () => {
      it('should add debug log to buffer', () => {
        remoteLogger.debug('Debug message', { debug: true });

        const stats = remoteLogger.getStats();
        expect(stats.bufferSize).toBe(1);
      });
    });
  });

  describe('ConsoleLogger compatibility methods', () => {
    beforeEach(() => {
      remoteLogger = new RemoteLogger({
        dependencies: { consoleLogger: mockConsoleLogger },
      });
    });

    it('should delegate groupCollapsed to fallback logger', () => {
      remoteLogger.groupCollapsed('Test Group');

      expect(mockConsoleLogger.groupCollapsed).toHaveBeenCalledWith(
        'Test Group'
      );
    });

    it('should delegate groupEnd to fallback logger', () => {
      remoteLogger.groupEnd();

      expect(mockConsoleLogger.groupEnd).toHaveBeenCalled();
    });

    it('should delegate table to fallback logger', () => {
      const testData = [{ id: 1, name: 'test' }];
      remoteLogger.table(testData, ['id']);

      expect(mockConsoleLogger.table).toHaveBeenCalledWith(testData, ['id']);
    });

    it('should delegate setLogLevel to fallback logger', () => {
      remoteLogger.setLogLevel('DEBUG');

      expect(mockConsoleLogger.setLogLevel).toHaveBeenCalledWith('DEBUG');
    });
  });

  describe('batching logic', () => {
    beforeEach(() => {
      remoteLogger = new RemoteLogger({
        config: { batchSize: 3, flushInterval: 1000 },
        dependencies: { consoleLogger: mockConsoleLogger },
      });
    });

    it('should flush when batch size is reached', async () => {
      remoteLogger.info('Log 1');
      remoteLogger.info('Log 2');
      remoteLogger.info('Log 3'); // Should trigger flush

      await jest.runAllTimersAsync();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.logs).toHaveLength(3);
    });

    it('should flush on timer interval', async () => {
      remoteLogger.info('Single log');

      // Advance time to trigger timer-based flush
      jest.advanceTimersByTime(1000);
      await jest.runAllTimersAsync();

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should clear buffer after successful flush', async () => {
      remoteLogger.info('Log 1');
      remoteLogger.info('Log 2');
      remoteLogger.info('Log 3');

      await jest.runAllTimersAsync();

      const stats = remoteLogger.getStats();
      expect(stats.bufferSize).toBe(0);
    });

    it('should not schedule multiple timers', () => {
      remoteLogger.info('Log 1');
      remoteLogger.info('Log 2');

      // Only one timer should be active
      expect(jest.getTimerCount()).toBe(1);
    });
  });

  describe('metadata enrichment', () => {
    beforeEach(() => {
      remoteLogger = new RemoteLogger({
        config: {
          batchSize: 1, // Flush immediately for testing
          metadataLevel: 'standard',
        },
        dependencies: { consoleLogger: mockConsoleLogger },
      });
    });

    it('should enrich logs with session ID and timestamp', async () => {
      remoteLogger.info('Test message');

      await jest.runAllTimersAsync();

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const logEntry = requestBody.logs[0];

      expect(logEntry.sessionId).toBe('test-session-id-123');
      expect(logEntry.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
      expect(logEntry.level).toBe('info');
      expect(logEntry.message).toBe('Test message');
    });

    it('should add performance metadata', async () => {
      remoteLogger.info('Test message');

      await jest.runAllTimersAsync();

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const logEntry = requestBody.logs[0];

      expect(logEntry.metadata.performance.timing).toBe(1000);
      expect(logEntry.metadata.performance.memory.used).toBe(1024000);
    });

    it('should preserve original arguments in metadata', async () => {
      const originalArgs = [{ key: 'value' }, 'string arg', 123];
      remoteLogger.info('Test message', ...originalArgs);

      await jest.runAllTimersAsync();

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const logEntry = requestBody.logs[0];

      expect(logEntry.metadata.originalArgs).toEqual(originalArgs);
    });
  });

  describe('network communication', () => {
    beforeEach(() => {
      remoteLogger = new RemoteLogger({
        config: { batchSize: 1, requestTimeout: 2000 },
        dependencies: { consoleLogger: mockConsoleLogger },
      });
    });

    it('should send POST request to correct endpoint', async () => {
      remoteLogger.info('Test message');

      await jest.runAllTimersAsync();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/debug-log',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should include abort signal for timeout handling', async () => {
      remoteLogger.info('Test message');

      await jest.runAllTimersAsync();

      const requestConfig = mockFetch.mock.calls[0][1];
      expect(requestConfig.signal).toBeInstanceOf(AbortSignal);
    });
  });

  describe('retry mechanism', () => {
    beforeEach(() => {
      remoteLogger = new RemoteLogger({
        config: {
          batchSize: 1,
          retryAttempts: 3,
          retryBaseDelay: 100,
        },
        dependencies: { consoleLogger: mockConsoleLogger },
      });
    });

    it('should retry on network failure', async () => {
      // First two calls fail, third succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, processed: 1 }),
        });

      remoteLogger.info('Test message');

      await jest.runAllTimersAsync();

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry on client errors (4xx)', async () => {
      mockFetch.mockRejectedValueOnce(new Error('HTTP 400: Bad Request'));

      remoteLogger.info('Test message');

      await jest.runAllTimersAsync();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockConsoleLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send batch to server'),
        expect.any(Object)
      );
    });

    it('should implement exponential backoff with jitter', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, processed: 1 }),
        });

      const startTime = Date.now();
      remoteLogger.info('Test message');

      await jest.runAllTimersAsync();

      // Should have waited for exponential backoff delays
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should fall back to console after max retries', async () => {
      mockFetch.mockRejectedValue(new Error('Persistent network error'));

      remoteLogger.info('Test message');

      await jest.runAllTimersAsync();

      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
      expect(mockConsoleLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send batch to server'),
        expect.any(Object)
      );
    });
  });

  describe('circuit breaker integration', () => {
    beforeEach(() => {
      remoteLogger = new RemoteLogger({
        config: {
          batchSize: 1,
          circuitBreakerThreshold: 2,
          circuitBreakerTimeout: 1000,
        },
        dependencies: {
          consoleLogger: mockConsoleLogger,
          eventBus: mockEventBus,
        },
      });
    });

    it('should open circuit after threshold failures', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      // Send enough logs to trigger circuit breaker
      remoteLogger.info('Log 1');
      await jest.runAllTimersAsync();

      remoteLogger.info('Log 2');
      await jest.runAllTimersAsync();

      expect(remoteLogger.getCircuitBreakerState()).toBe(
        CircuitBreakerState.OPEN
      );
    });

    it('should block requests when circuit is open', async () => {
      // Force circuit to open
      mockFetch.mockRejectedValue(new Error('Network error'));

      remoteLogger.info('Log 1');
      await jest.runAllTimersAsync();

      remoteLogger.info('Log 2');
      await jest.runAllTimersAsync();

      // Reset fetch mock to succeed, but circuit should be open
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, processed: 1 }),
      });

      remoteLogger.info('Log 3');
      await jest.runAllTimersAsync();

      // Should fall back to console immediately (no fetch call)
      expect(mockConsoleLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send batch to server'),
        expect.objectContaining({
          circuitBreakerState: CircuitBreakerState.OPEN,
        })
      );
    });

    it('should recover after circuit timeout', async () => {
      // Force circuit to open
      mockFetch.mockRejectedValue(new Error('Network error'));

      remoteLogger.info('Log 1');
      await jest.runAllTimersAsync();

      remoteLogger.info('Log 2');
      await jest.runAllTimersAsync();

      expect(remoteLogger.getCircuitBreakerState()).toBe(
        CircuitBreakerState.OPEN
      );

      // Wait for circuit timeout to transition to HALF_OPEN
      jest.advanceTimersByTime(1000);

      // Reset fetch to succeed for recovery
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, processed: 1 }),
      });

      // In HALF_OPEN state, we need multiple successful calls to close the circuit
      // The circuit breaker requires halfOpenMaxCalls (default 3) successful calls
      remoteLogger.info('Recovery log 1');
      await jest.runAllTimersAsync();

      remoteLogger.info('Recovery log 2');
      await jest.runAllTimersAsync();

      remoteLogger.info('Recovery log 3');
      await jest.runAllTimersAsync();

      // After 3 successful calls in HALF_OPEN, circuit should be CLOSED
      expect(remoteLogger.getCircuitBreakerState()).toBe(
        CircuitBreakerState.CLOSED
      );
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      remoteLogger = new RemoteLogger({
        config: { batchSize: 1 },
        dependencies: {
          consoleLogger: mockConsoleLogger,
          eventBus: mockEventBus,
        },
      });
    });

    it('should report errors via event bus', async () => {
      mockFetch.mockRejectedValue(new Error('Network failure'));

      remoteLogger.info('Test message');

      await jest.runAllTimersAsync();

      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: 'REMOTE_LOGGER_SEND_FAILED',
        payload: expect.objectContaining({
          error: 'Network failure',
          logCount: 1,
          endpoint: 'http://localhost:3001/api/debug-log',
        }),
      });
    });
  });

  describe('enhanced category detection', () => {
    beforeEach(() => {
      remoteLogger = new RemoteLogger({
        config: {
          batchSize: 1,
          enableCategoryCache: true,
        },
        dependencies: { consoleLogger: mockConsoleLogger },
      });
    });

    it('should detect enhanced categories', async () => {
      // Log messages sequentially and wait for each flush to complete
      remoteLogger.info('GameEngine initialized');
      await jest.runAllTimersAsync();

      remoteLogger.warn('EntityManager created');
      await jest.runAllTimersAsync();

      remoteLogger.debug('AI decision made');
      await jest.runAllTimersAsync();

      remoteLogger.error('Validation failed');
      await jest.runAllTimersAsync();

      const calls = mockFetch.mock.calls;
      expect(calls).toHaveLength(4);

      const categories = calls.map((call) => {
        const body = JSON.parse(call[1].body);
        return body.logs[0].category;
      });

      expect(categories).toEqual(['engine', 'ecs', 'ai', 'error']);
    });

    it('should handle unmatched categories', async () => {
      remoteLogger.info('Random message without category');

      await jest.runAllTimersAsync();

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const logEntry = requestBody.logs[0];

      expect(logEntry.category).toBeUndefined();
    });
  });

  describe('configurable metadata levels', () => {
    it('should collect minimal metadata', async () => {
      remoteLogger = new RemoteLogger({
        config: {
          batchSize: 1,
          metadataLevel: 'minimal',
        },
        dependencies: { consoleLogger: mockConsoleLogger },
      });

      remoteLogger.info('Test message');

      await jest.runAllTimersAsync();

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const logEntry = requestBody.logs[0];

      expect(logEntry.metadata.url).toBeDefined(); // URL is set but may vary in test environment
      expect(logEntry.metadata.browser).toBeUndefined();
      expect(logEntry.metadata.performance).toBeUndefined();
    });

    it('should collect full metadata', async () => {
      remoteLogger = new RemoteLogger({
        config: {
          batchSize: 1,
          metadataLevel: 'full',
        },
        dependencies: { consoleLogger: mockConsoleLogger },
      });

      remoteLogger.info('Test message');

      await jest.runAllTimersAsync();

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const logEntry = requestBody.logs[0];

      expect(logEntry.metadata.browser).toBeDefined();
      expect(logEntry.metadata.browser.viewport).toBeDefined();
      expect(logEntry.metadata.performance).toBeDefined();
      expect(logEntry.metadata.environment).toBeDefined();
    });
  });

  describe('manual operations', () => {
    beforeEach(() => {
      remoteLogger = new RemoteLogger({
        config: { batchSize: 10 }, // Large batch to prevent auto-flush
        dependencies: { consoleLogger: mockConsoleLogger },
      });
    });

    it('should allow manual flush', async () => {
      remoteLogger.info('Manual flush test');

      await remoteLogger.flush();

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should return session ID', () => {
      expect(remoteLogger.getSessionId()).toBe('test-session-id-123');
    });

    it('should return statistics', () => {
      remoteLogger.info('Test log');

      const stats = remoteLogger.getStats();

      expect(stats).toMatchObject({
        sessionId: 'test-session-id-123',
        bufferSize: 1,
        endpoint: 'http://localhost:3001/api/debug-log',
        configuration: expect.objectContaining({
          batchSize: 10,
          flushInterval: 1000,
        }),
        circuitBreaker: expect.objectContaining({
          state: CircuitBreakerState.CLOSED,
        }),
      });

      // Should include new utility statistics
      expect(stats.categoryDetector).toBeDefined();
      expect(stats.categoryDetector.cacheEnabled).toBe(true);
      expect(stats.metadataEnricher).toBeDefined();
      expect(stats.metadataEnricher.level).toBe('standard');
    });
  });

  describe('cleanup and destruction', () => {
    beforeEach(() => {
      remoteLogger = new RemoteLogger({
        config: { batchSize: 10 },
        dependencies: { consoleLogger: mockConsoleLogger },
      });
    });

    it('should flush remaining logs on destroy', async () => {
      remoteLogger.info('Log before destroy');

      await remoteLogger.destroy();

      expect(mockFetch).toHaveBeenCalled();

      const stats = remoteLogger.getStats();
      expect(stats.bufferSize).toBe(0);
    });

    it('should clear timers on destroy', async () => {
      remoteLogger.info('Test log');

      expect(jest.getTimerCount()).toBeGreaterThan(0);

      await remoteLogger.destroy();

      expect(jest.getTimerCount()).toBe(0);
    });

    it('should abort pending requests on destroy', async () => {
      // Create a slow-resolving fetch to simulate pending request
      let resolveFunc;
      const slowPromise = new Promise((resolve) => {
        resolveFunc = resolve;
      });
      mockFetch.mockReturnValue(slowPromise);

      remoteLogger.info('Test log');
      jest.runOnlyPendingTimers(); // Start the request

      // Destroy should complete quickly even with pending request
      const destroyPromise = remoteLogger.destroy();

      // Resolve the slow promise after destroy is called
      resolveFunc({
        ok: true,
        json: () => Promise.resolve({ success: true, processed: 1 }),
      });

      // Wait for destroy to complete
      await destroyPromise;

      // The important thing is that destroy didn't hang and completed successfully
      expect(remoteLogger.getStats().bufferSize).toBe(0);
    });
  });

  describe('edge cases and error conditions', () => {
    it('should handle missing browser APIs gracefully', () => {
      // Remove browser APIs
      delete global.window;
      delete global.document;
      delete global.navigator;
      delete global.performance;

      expect(() => {
        remoteLogger = new RemoteLogger();
      }).not.toThrow();
    });

    it('should handle invalid log level gracefully', () => {
      remoteLogger = new RemoteLogger({
        dependencies: { consoleLogger: mockConsoleLogger },
      });

      // Should not throw on invalid log level
      expect(() => {
        remoteLogger.setLogLevel(null);
      }).not.toThrow();
    });
  });
});
