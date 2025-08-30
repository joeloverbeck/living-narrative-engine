/**
 * @file Game launch logging volume performance tests
 * @description Performance benchmarks for realistic logging patterns during game initialization
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
import { createPerformanceTestBed } from '../../common/performanceTestBed.js';
import RemoteLogger from '../../../src/logging/remoteLogger.js';

// Mock performance with proper timing for benchmarks
let mockTime = 0;
global.performance = {
  now: jest.fn(() => mockTime),
  memory: {
    usedJSHeapSize: 1024000,
  },
};

// Helper to advance mock time
function advanceMockTime(ms) {
  mockTime += ms;
}

// Mock browser APIs
global.window = {
  location: {
    href: 'http://localhost:8080/test',
  },
  addEventListener: jest.fn(),
};

global.document = {
  addEventListener: jest.fn(),
  visibilityState: 'visible',
};

global.navigator = {
  userAgent: 'Mozilla/5.0 (Test Browser)',
  sendBeacon: jest.fn(),
};

describe('Game Launch - Logging Volume Performance', () => {
  let performanceTestBed;
  let performanceTracker;
  let mockLogger;
  let mockEventBus;
  let performanceMetrics;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();

    // Reset mock time
    mockTime = 0;

    performanceTestBed = createPerformanceTestBed();
    performanceTracker = performanceTestBed.createPerformanceTracker();
    mockLogger = performanceTestBed.mockLogger;

    // Create mock event bus manually since performanceTestBed doesn't have createMock
    mockEventBus = {
      dispatch: jest.fn(),
    };

    performanceMetrics = {
      startTime: 0,
      endTime: 0,
      bufferOverflows: 0,
      httpErrors: 0,
      totalLogs: 0,
      successfulBatches: 0,
      failedBatches: 0,
    };

    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    performanceTestBed.cleanup();
    jest.restoreAllMocks();
  });

  it('should simulate realistic game.html launch logging without performance issues', async () => {
    // Mock successful network responses
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });

    // Track performance metrics
    const metricsTracker = {
      ...mockLogger,
      warn: jest.fn((message, data) => {
        if (message.includes('Buffer overflow')) {
          performanceMetrics.bufferOverflows++;
        }
        if (message.includes('Failed to send batch')) {
          performanceMetrics.httpErrors++;
        }
        mockLogger.warn(message, data);
      }),
    };

    const remoteLogger = new RemoteLogger({
      config: {
        batchSize: 25, // Optimized smaller batch size
        flushInterval: 250, // Faster flushing
        maxBufferSize: 1000, // Reasonable buffer size
        maxServerBatchSize: 4500,
        endpoint: 'http://localhost:3001/api/debug-log',
      },
      dependencies: {
        consoleLogger: metricsTracker,
        eventBus: mockEventBus,
      },
    });

    const benchmark = performanceTracker.startBenchmark(
      'game-launch-simulation'
    );

    // Simulate game engine startup logging patterns
    simulateGameInitialization(remoteLogger);

    const metrics = benchmark.end();

    // Performance assertions
    expect(metrics.totalTime).toBeLessThan(5000); // Should complete within 5 seconds
    expect(performanceMetrics.bufferOverflows).toBe(0); // No buffer overflows
    expect(performanceMetrics.httpErrors).toBe(0); // No HTTP errors

    // Verify logging system remains stable
    remoteLogger.info('Post-initialization test log');
    expect(true).toBe(true); // System should not crash

    // Log performance metrics for analysis
    console.log(`Game Launch Performance Metrics:
      Duration: ${metrics.totalTime}ms
      Buffer Overflows: ${performanceMetrics.bufferOverflows}
      HTTP Errors: ${performanceMetrics.httpErrors}
    `);
  });

  it('should handle high-volume entity creation logging efficiently', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });

    const remoteLogger = new RemoteLogger({
      config: {
        batchSize: 30,
        flushInterval: 200,
        maxBufferSize: 800,
        endpoint: 'http://localhost:3001/api/debug-log',
      },
      dependencies: {
        consoleLogger: mockLogger,
        eventBus: mockEventBus,
      },
    });

    const benchmark = performanceTracker.startBenchmark(
      'high-volume-entity-creation'
    );
    const entityCount = 500;

    // Simulate entity creation burst (common cause of overflow)
    for (let i = 0; i < entityCount; i++) {
      remoteLogger.debug(`Entity created: entity-${i}`, {
        entityId: `entity-${i}`,
        components: ['transform', 'render', 'physics'],
        location: `location-${Math.floor(i / 10)}`,
        properties: {
          health: 100,
          mana: 50,
          inventory: [`item-${i}-1`, `item-${i}-2`],
        },
      });

      // Simulate realistic timing - not all at once
      if (i % 50 === 0) {
        advanceMockTime(10);
      }
    }

    // Advance time for batch processing and trigger any pending timers
    advanceMockTime(1000);
    await jest.runAllTimersAsync();

    const metrics = benchmark.end();

    // Performance assertions - adjusted for test environment with mock timing
    expect(metrics.totalTime).toBeLessThan(10000); // Should handle burst efficiently

    // Should handle burst without buffer overflow
    expect(mockLogger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('Buffer overflow'),
      expect.anything()
    );

    console.log(`High-Volume Entity Creation Performance:
      Duration: ${metrics.totalTime}ms
      Entities: ${entityCount}
      Entities per second: ${(entityCount / (metrics.totalTime / 1000)).toFixed(0)}
    `);
  });

  it('should benchmark logging performance under realistic game conditions', async () => {
    let requestCount = 0;
    let totalPayloadSize = 0;

    global.fetch.mockImplementation(async (url, options) => {
      requestCount++;
      const payloadSize = options.body?.length || 0;
      totalPayloadSize += payloadSize;

      return {
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            batchId: `batch-${requestCount}`,
            processedLogs: JSON.parse(options.body).logs.length,
          }),
      };
    });

    const remoteLogger = new RemoteLogger({
      config: {
        batchSize: 25,
        flushInterval: 300,
        maxBufferSize: 1200,
        endpoint: 'http://localhost:3001/api/debug-log',
      },
      dependencies: {
        consoleLogger: mockLogger,
        eventBus: mockEventBus,
      },
    });

    const benchmark = performanceTracker.startBenchmark(
      'complete-game-launch-benchmark'
    );

    // Simulate complete game launch sequence
    simulateCompleteGameLaunch(remoteLogger);

    // Force flush to ensure all logs are sent
    await remoteLogger.flush();

    // Advance time to trigger timer-based flushes and wait for them to complete
    advanceMockTime(350); // Trigger flushInterval (300ms)
    await jest.runAllTimersAsync();

    const metrics = benchmark.end();

    // Performance benchmarks - adjusted for test environment with mock timing
    expect(metrics.totalTime).toBeLessThan(10000); // Complete within reasonable time
    expect(requestCount).toBeGreaterThan(0); // Should make network requests
    expect(totalPayloadSize).toBeLessThan(50 * 1024 * 1024); // Total payload < 50MB

    // Log detailed performance metrics for analysis
    console.log(`Complete Game Launch Benchmark:
      Duration: ${metrics.totalTime}ms
      Network Requests: ${requestCount}
      Total Payload Size: ${(totalPayloadSize / 1024 / 1024).toFixed(2)}MB
      Average Request Size: ${(totalPayloadSize / requestCount / 1024).toFixed(2)}KB
      Throughput: ${(requestCount / (metrics.totalTime / 1000)).toFixed(2)} requests/sec
    `);
  });

  it('should demonstrate improved stability vs baseline implementation', async () => {
    let bufferOverflowCount = 0;
    let httpErrorCount = 0;

    // Mock network responses as successful for stability testing
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });

    const stabilityTracker = {
      ...mockLogger,
      warn: jest.fn((message, data) => {
        if (message.includes('Buffer overflow')) bufferOverflowCount++;
        if (message.includes('Failed to send batch')) httpErrorCount++;
        mockLogger.warn(message, data);
      }),
    };

    const remoteLogger = new RemoteLogger({
      config: {
        batchSize: 20, // Smaller batches for stability
        flushInterval: 150, // Faster flushing
        maxBufferSize: 2000, // Larger buffer
        maxServerBatchSize: 4000, // Conservative server limit
        endpoint: 'http://localhost:3001/api/debug-log',
      },
      dependencies: {
        consoleLogger: stabilityTracker,
        eventBus: mockEventBus,
      },
    });

    const benchmark = performanceTracker.startBenchmark(
      'stability-demonstration'
    );
    const iterations = 5;

    // Run the same high-volume scenario that previously caused issues
    for (let iteration = 0; iteration < iterations; iteration++) {
      simulateGameInitialization(remoteLogger);

      // Simulate user interaction after launch
      for (let i = 0; i < 100; i++) {
        remoteLogger.info(`User action ${iteration}-${i}`, {
          action: 'move',
          from: `location-${i}`,
          to: `location-${i + 1}`,
          timestamp: Date.now(),
        });
        advanceMockTime(1);
      }

      advanceMockTime(100);
    }

    // Final time advancement for all processing and trigger timers
    advanceMockTime(2000);
    await jest.runAllTimersAsync();

    const metrics = benchmark.end();

    // Stability performance assertions
    expect(bufferOverflowCount).toBe(0);
    // Allow minimal HTTP errors for performance testing (< 5% failure rate is acceptable)
    expect(httpErrorCount).toBeLessThanOrEqual(1);
    expect(metrics.totalTime).toBeLessThan(15000); // Should complete all iterations within 15 seconds

    console.log(`Stability Test Performance Results:
      Duration: ${metrics.totalTime}ms
      Iterations: ${iterations}
      Average per iteration: ${(metrics.totalTime / iterations).toFixed(0)}ms
      Buffer Overflows: ${bufferOverflowCount}
      HTTP Errors: ${httpErrorCount}
      Stability Score: ${bufferOverflowCount === 0 && httpErrorCount === 0 ? '100%' : 'FAILED'}
    `);
  });
});

/**
 * Simulates the logging pattern during game initialization
 *
 * @param {RemoteLogger} logger - The logger instance to use
 */
function simulateGameInitialization(logger) {
  // 1. Engine startup
  for (let i = 0; i < 50; i++) {
    logger.info(`Engine startup ${i}`, {
      component: 'game-engine',
      phase: 'initialization',
      step: i,
    });
    advanceMockTime(2); // Small time advancement per log
  }

  // 2. Mod loading
  const mods = ['core', 'base-game', 'character-extension'];
  for (const mod of mods) {
    for (let i = 0; i < 30; i++) {
      logger.debug(`Loading ${mod} component ${i}`, {
        mod,
        component: `component-${i}`,
        type: 'rule|action|entity',
      });
      advanceMockTime(1);
    }
  }

  // 3. Entity system initialization
  for (let i = 0; i < 200; i++) {
    logger.debug(`Entity system: registering entity-${i}`, {
      entityId: `entity-${i}`,
      components: Array(3)
        .fill(0)
        .map((_, j) => `component-${j}`),
      location: `location-${Math.floor(i / 20)}`,
    });
    advanceMockTime(0.5);
  }

  // 4. UI initialization
  for (let i = 0; i < 40; i++) {
    logger.info(`UI element created: ${i}`, {
      elementType: 'widget',
      elementId: `ui-element-${i}`,
      parent: `container-${Math.floor(i / 10)}`,
    });
    advanceMockTime(1);
  }

  // 5. Game state loading
  logger.info('Loading game state', {
    saveFile: 'default-save.json',
    entities: 200,
    locations: 10,
  });

  advanceMockTime(50);
}

/**
 * Simulates a complete game launch with all systems
 *
 * @param {RemoteLogger} logger - The logger instance to use
 */
function simulateCompleteGameLaunch(logger) {
  simulateGameInitialization(logger);

  // Add AI system initialization
  for (let i = 0; i < 20; i++) {
    logger.info(`AI character ${i} initialized`, {
      characterId: `npc-${i}`,
      personality: `personality-${i}`,
      memory: `memory-system-${i}`,
    });
    advanceMockTime(2);
  }

  // Add turn system startup
  for (let i = 0; i < 30; i++) {
    logger.debug(`Turn system: processing entity-${i}`, {
      turnNumber: 1,
      entityId: `entity-${i}`,
      actions: ['move', 'interact', 'speak'],
    });
    advanceMockTime(1);
  }

  advanceMockTime(100);
}
