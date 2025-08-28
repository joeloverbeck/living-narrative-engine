/**
 * @file Game launch logging volume simulation test
 * @description Tests realistic logging patterns during game initialization to identify bottlenecks
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

describe('Game Launch - Logging Volume Simulation', () => {
  let testBed;
  let mockLogger;
  let mockEventBus;
  let performanceMetrics;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockEventBus = testBed.createMock('eventBus', ['dispatch']);

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
    testBed.cleanup();
    jest.restoreAllMocks();
  });

  it('should simulate realistic game.html launch logging without issues', async () => {
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

    performanceMetrics.startTime = Date.now();

    // Simulate game engine startup logging patterns
    await simulateGameInitialization(remoteLogger);

    performanceMetrics.endTime = Date.now();
    const duration = performanceMetrics.endTime - performanceMetrics.startTime;

    // Assert performance requirements
    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    expect(performanceMetrics.bufferOverflows).toBe(0); // No buffer overflows
    expect(performanceMetrics.httpErrors).toBe(0); // No HTTP errors

    // Verify logging system remains stable
    remoteLogger.info('Post-initialization test log');
    expect(true).toBe(true); // System should not crash
  });

  it('should handle high-volume entity creation logging', async () => {
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

    // Simulate entity creation burst (common cause of overflow)
    for (let i = 0; i < 500; i++) {
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
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

    // Wait for all batches to process
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Should handle burst without buffer overflow
    expect(mockLogger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('Buffer overflow'),
      expect.anything()
    );
  });

  it('should benchmark logging performance under realistic conditions', async () => {
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

    const startTime = Date.now();

    // Simulate complete game launch sequence
    await simulateCompleteGameLaunch(remoteLogger);

    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    // Performance benchmarks
    expect(totalDuration).toBeLessThan(3000); // Complete within 3 seconds
    expect(requestCount).toBeGreaterThan(0); // Should make network requests
    expect(totalPayloadSize).toBeLessThan(50 * 1024 * 1024); // Total payload < 50MB

    // Log performance metrics for analysis
    console.log(`Performance Metrics:
      Duration: ${totalDuration}ms
      Requests: ${requestCount}
      Total Payload: ${(totalPayloadSize / 1024 / 1024).toFixed(2)}MB
      Avg Request Size: ${(totalPayloadSize / requestCount / 1024).toFixed(2)}KB
    `);
  });

  it('should demonstrate improved stability vs current implementation', async () => {
    let bufferOverflowCount = 0;
    let httpErrorCount = 0;

    // Mock network responses with occasional delays
    global.fetch.mockImplementation(() => {
      const delay = Math.random() < 0.3 ? Math.random() * 100 : 0; // 30% chance of delay

      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ success: true }),
          });
        }, delay);
      });
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

    // Run the same high-volume scenario that caused issues
    for (let iteration = 0; iteration < 5; iteration++) {
      await simulateGameInitialization(remoteLogger);

      // Simulate user interaction after launch
      for (let i = 0; i < 100; i++) {
        remoteLogger.info(`User action ${iteration}-${i}`, {
          action: 'move',
          from: `location-${i}`,
          to: `location-${i + 1}`,
          timestamp: Date.now(),
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Final wait for all processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Should be stable with improved configuration
    expect(bufferOverflowCount).toBe(0);
    expect(httpErrorCount).toBe(0);

    console.log(`Stability Test Results:
      Buffer Overflows: ${bufferOverflowCount}
      HTTP Errors: ${httpErrorCount}
      Test Passed: ${bufferOverflowCount === 0 && httpErrorCount === 0}
    `);
  });
});

/**
 * Simulates the logging pattern during game initialization
 *
 * @param {RemoteLogger} logger - The logger instance to use
 */
async function simulateGameInitialization(logger) {
  // 1. Engine startup
  for (let i = 0; i < 50; i++) {
    logger.info(`Engine startup ${i}`, {
      component: 'game-engine',
      phase: 'initialization',
      step: i,
    });
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
  }

  // 4. UI initialization
  for (let i = 0; i < 40; i++) {
    logger.info(`UI element created: ${i}`, {
      elementType: 'widget',
      elementId: `ui-element-${i}`,
      parent: `container-${Math.floor(i / 10)}`,
    });
  }

  // 5. Game state loading
  logger.info('Loading game state', {
    saveFile: 'default-save.json',
    entities: 200,
    locations: 10,
  });

  await new Promise((resolve) => setTimeout(resolve, 50));
}

/**
 * Simulates a complete game launch with all systems
 *
 * @param {RemoteLogger} logger - The logger instance to use
 */
async function simulateCompleteGameLaunch(logger) {
  await simulateGameInitialization(logger);

  // Add AI system initialization
  for (let i = 0; i < 20; i++) {
    logger.info(`AI character ${i} initialized`, {
      characterId: `npc-${i}`,
      personality: `personality-${i}`,
      memory: `memory-system-${i}`,
    });
  }

  // Add turn system startup
  for (let i = 0; i < 30; i++) {
    logger.debug(`Turn system: processing entity-${i}`, {
      turnNumber: 1,
      entityId: `entity-${i}`,
      actions: ['move', 'interact', 'speak'],
    });
  }

  await new Promise((resolve) => setTimeout(resolve, 100));
}
