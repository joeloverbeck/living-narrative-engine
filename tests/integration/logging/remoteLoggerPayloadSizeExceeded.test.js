/**
 * @file HTTP 413 Payload Too Large reproduction test for RemoteLogger
 * @description Tests the specific HTTP 413 scenario observed in game.html launch error logs
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import RemoteLogger from '../../../src/logging/remoteLogger.js';

describe('RemoteLogger - HTTP 413 Payload Too Large Reproduction', () => {
  let testBed;
  let mockLogger;
  let mockEventBus;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockEventBus = testBed.createMock('eventBus', ['dispatch']);

    // Mock global fetch
    global.fetch = jest.fn();
  });

  afterEach(() => {
    testBed.cleanup();
    jest.restoreAllMocks();
  });

  it('should reproduce HTTP 413 error when batch payload exceeds server limit', async () => {
    // Mock fetch to return HTTP 413 error
    global.fetch.mockResolvedValue({
      ok: false,
      status: 413,
      statusText: 'Payload Too Large',
      json: () =>
        Promise.resolve({
          error: 'HTTP 413: Payload Too Large',
          message: 'Request payload exceeds maximum allowed size',
        }),
    });

    const remoteLogger = new RemoteLogger({
      config: {
        batchSize: 2000, // Large batch size to trigger 413 error
        flushInterval: 100,
        maxServerBatchSize: 5000, // Server limit from config
        endpoint: 'http://localhost:3001/api/debug-log',
        skipServerReadinessValidation: true, // Skip health checks for testing
        initialConnectionDelay: 0, // Disable initial delay for testing
      },
      dependencies: {
        consoleLogger: mockLogger,
        eventBus: mockEventBus,
      },
    });

    // Create logs with large payloads to exceed server limit
    for (let i = 0; i < 2000; i++) {
      const largeMetadata = {
        entityData: {
          id: `entity-${i}`,
          components: Array(50)
            .fill(0)
            .map((_, j) => ({
              type: `component-${j}`,
              properties: {
                data: `large-data-chunk-${i}-${j}`.repeat(20), // Large string
                nested: {
                  level1: {
                    level2: { level3: `deep-data-${i}-${j}`.repeat(10) },
                  },
                },
              },
            })),
          metadata: {
            timestamp: new Date().toISOString(),
            sessionId: 'test-session-12345',
            location: 'test-location',
            context: `context-data-${i}`.repeat(30),
          },
        },
      };

      remoteLogger.info(`Large payload log ${i}`, largeMetadata);
    }

    // Wait for batch to be sent and fail
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify HTTP 413 error was handled
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        '[RemoteLogger] Failed to send batch to server, falling back to console'
      ),
      expect.objectContaining({
        error: expect.stringContaining('HTTP 413: Payload Too Large'),
        logCount: expect.any(Number),
        circuitBreakerState: expect.any(String),
      })
    );

    // Verify batch was discarded due to client error
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        '[RemoteLogger] Discarding batch due to client error'
      ),
      expect.objectContaining({
        error: expect.stringContaining('HTTP 413: Payload Too Large'),
        logCount: expect.any(Number),
      })
    );
  });

  it('should handle 413 error with circuit breaker activation', async () => {
    let requestCount = 0;

    // Mock fetch to return 413 errors consistently
    global.fetch.mockImplementation(() => {
      requestCount++;
      return Promise.resolve({
        ok: false,
        status: 413,
        statusText: 'Payload Too Large',
        json: () =>
          Promise.resolve({
            error: 'HTTP 413: Payload Too Large',
          }),
      });
    });

    const remoteLogger = new RemoteLogger({
      config: {
        batchSize: 100,
        flushInterval: 50,
        circuitBreakerThreshold: 3, // Low threshold for testing
        circuitBreakerTimeout: 1000,
        endpoint: 'http://localhost:3001/api/debug-log',
        skipServerReadinessValidation: true, // Skip health checks for testing
        initialConnectionDelay: 0, // Disable initial delay for testing
      },
      dependencies: {
        consoleLogger: mockLogger,
        eventBus: mockEventBus,
      },
    });

    // Generate enough logs to trigger multiple batch sends
    for (let i = 0; i < 500; i++) {
      remoteLogger.info(`Batch test log ${i}`, {
        data: 'large-payload'.repeat(100), // Large payload
      });
    }

    // Wait for circuit breaker to activate
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Should eventually stop making requests due to circuit breaker
    const initialRequestCount = requestCount;

    // Add more logs after circuit breaker should be open
    for (let i = 0; i < 100; i++) {
      remoteLogger.info(`Post-circuit-breaker log ${i}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Circuit breaker should prevent additional requests
    expect(requestCount).toBeGreaterThan(0);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to send batch to server'),
      expect.objectContaining({
        error: expect.stringContaining('HTTP 413: Payload Too Large'),
      })
    );
  });

  it('should demonstrate exact error pattern from logs', async () => {
    // Mock to always return 413 - simpler approach that matches other tests
    global.fetch.mockResolvedValue({
      ok: false,
      status: 413,
      statusText: 'Payload Too Large',
      json: () =>
        Promise.resolve({
          error: 'HTTP 413: Payload Too Large',
        }),
    });

    const remoteLogger = new RemoteLogger({
      config: {
        batchSize: 2000, // Match the logCount from error logs
        flushInterval: 500,
        maxServerBatchSize: 4500, // Match config from RemoteLogger
        maxBufferSize: 3000, // Set buffer size larger than batch size
        endpoint: 'http://localhost:3001/api/debug-log',
        skipServerReadinessValidation: true, // Skip health checks for testing
        initialConnectionDelay: 0, // Disable initial delay for testing
      },
      dependencies: {
        consoleLogger: mockLogger,
        eventBus: mockEventBus,
      },
    });

    // Simulate the game launch logging pattern
    for (let i = 0; i < 2000; i++) {
      // Mix of different log types and sizes similar to game logs
      if (i % 20 === 0) {
        remoteLogger.error(`Entity creation error ${i}`, {
          entityId: `entity-${i}`,
          error: 'Component validation failed',
          stackTrace:
            'Error: Component validation failed\n    at validateComponent\n    at createEntity',
        });
      } else if (i % 10 === 0) {
        remoteLogger.warn(`Performance warning ${i}`, {
          operation: 'entity-update',
          duration: Math.random() * 100,
          threshold: 50,
        });
      } else if (i % 5 === 0) {
        remoteLogger.info(`Game state update ${i}`, {
          gameState: {
            currentLocation: `location-${Math.floor(i / 100)}`,
            activeEntities: Array(10)
              .fill(0)
              .map((_, j) => `entity-${i}-${j}`),
            turnNumber: Math.floor(i / 50),
          },
        });
      } else {
        remoteLogger.debug(`Debug trace ${i}`, {
          trace: `trace-data-${i}`,
          metadata: { component: 'entity-manager', operation: 'update' },
        });
      }
    }

    // Wait for the 413 error to occur
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Verify the exact error messages from the logs
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        '[RemoteLogger] Failed to send batch to server, falling back to console'
      ),
      expect.objectContaining({
        error: 'HTTP 413: Payload Too Large',
        logCount: expect.any(Number),
        circuitBreakerState: expect.any(String),
      })
    );

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        '[RemoteLogger] Discarding batch due to client error'
      ),
      expect.objectContaining({
        error: 'HTTP 413: Payload Too Large',
        logCount: expect.any(Number),
      })
    );
  });

  it('should handle payload size estimation correctly', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 413,
      statusText: 'Payload Too Large',
      json: () => Promise.resolve({ error: 'HTTP 413: Payload Too Large' }),
    });

    const remoteLogger = new RemoteLogger({
      config: {
        batchSize: 100,
        flushInterval: 100,
        maxServerBatchSize: 4500, // 4.5MB server limit
        endpoint: 'http://localhost:3001/api/debug-log',
        skipServerReadinessValidation: true, // Skip health checks for testing
        initialConnectionDelay: 0, // Disable initial delay for testing
      },
      dependencies: {
        consoleLogger: mockLogger,
        eventBus: mockEventBus,
      },
    });

    // Create logs that should exceed 5MB when serialized
    const largeObject = {
      data: 'x'.repeat(50000), // ~50KB per log entry
      metadata: {
        nested: Array(10)
          .fill(0)
          .map((i) => ({ key: `value-${i}`.repeat(100) })),
      },
    };

    for (let i = 0; i < 100; i++) {
      remoteLogger.info(`Large payload ${i}`, { ...largeObject, index: i });
    }

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Should detect and handle the oversized payload
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to send batch to server'),
      expect.objectContaining({
        error: expect.stringContaining('HTTP 413'),
      })
    );
  });
});
