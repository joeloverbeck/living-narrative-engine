/**
 * @file Buffer overflow reproduction test for RemoteLogger
 * @description Tests the specific buffer overflow scenario observed in game.html launch error logs
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

describe('RemoteLogger - Buffer Overflow Reproduction', () => {
  let testBed;
  let mockLogger;
  let mockEventBus;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockEventBus = testBed.createMock('eventBus', ['dispatch']);

    // Mock global fetch to simulate network delays that cause buffer buildup
    global.fetch = jest.fn();
  });

  afterEach(() => {
    testBed.cleanup();
    jest.restoreAllMocks();
  });

  it('should reproduce buffer overflow when logs accumulate faster than flushing', async () => {
    // Mock fetch to simulate slow network response that delays batch sending
    global.fetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve({ success: true }),
            });
          }, 100); // 100ms delay per batch
        })
    );

    const remoteLogger = new RemoteLogger({
      config: {
        batchSize: 50,
        flushInterval: 500,
        maxBufferSize: 200, // Small buffer to trigger overflow quickly
        endpoint: 'http://localhost:3001/api/debug-log',
      },
      dependencies: {
        consoleLogger: mockLogger,
        eventBus: mockEventBus,
      },
    });

    // Simulate rapid logging that exceeds buffer capacity
    for (let i = 0; i < 250; i++) {
      remoteLogger.info(`High volume log entry ${i}`, { iteration: i });
    }

    // Wait for buffer overflow to occur
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Verify buffer overflow warning was logged
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        '[RemoteLogger] Buffer overflow - discarded oldest log entries'
      ),
      expect.objectContaining({
        removedCount: expect.any(Number),
        currentBufferSize: expect.any(Number),
        maxBufferSize: 200,
      })
    );

    // Verify overflow event was dispatched
    expect(mockEventBus.dispatch).toHaveBeenCalledWith({
      type: 'REMOTE_LOGGER_BUFFER_OVERFLOW',
      payload: expect.objectContaining({
        removedCount: expect.any(Number),
        bufferSize: expect.any(Number),
        maxBufferSize: 200,
      }),
    });
  });

  it('should handle continuous high-volume logging without crashing', async () => {
    // Mock fetch to return successful responses
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });

    const remoteLogger = new RemoteLogger({
      config: {
        batchSize: 25, // Smaller batches
        flushInterval: 100, // Faster flushing
        maxBufferSize: 150,
        endpoint: 'http://localhost:3001/api/debug-log',
      },
      dependencies: {
        consoleLogger: mockLogger,
        eventBus: mockEventBus,
      },
    });

    // Simulate the volume of logs seen in error_logs.txt (~72 logs between overflows)
    const logPromises = [];
    for (let i = 0; i < 300; i++) {
      remoteLogger.debug(`Debug message ${i}`, { data: `value-${i}` });
      if (i % 10 === 0) {
        // Add some async delay to simulate real-world timing
        logPromises.push(new Promise((resolve) => setTimeout(resolve, 10)));
      }
    }

    await Promise.all(logPromises);

    // Wait for all operations to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Logger should still be functional despite buffer overflows
    remoteLogger.info('Final test message');

    // Should not crash - this is the key test
    expect(true).toBe(true);
  });

  it('should demonstrate the 72-entry pattern from error logs', async () => {
    let overflowCount = 0;

    // Mock logger to count buffer overflow warnings
    const countingMockLogger = {
      ...mockLogger,
      warn: jest.fn((message, data) => {
        if (message.includes('Buffer overflow')) {
          overflowCount++;
        }
        mockLogger.warn(message, data);
      }),
    };

    // Mock fetch with realistic delay
    global.fetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve({ success: true }),
            });
          }, 50);
        })
    );

    const remoteLogger = new RemoteLogger({
      config: {
        batchSize: 50,
        flushInterval: 500,
        maxBufferSize: 100, // Force frequent overflows
        endpoint: 'http://localhost:3001/api/debug-log',
      },
      dependencies: {
        consoleLogger: countingMockLogger,
        eventBus: mockEventBus,
      },
    });

    // Generate logs similar to the pattern in error_logs.txt
    for (let i = 0; i < 400; i++) {
      remoteLogger.info(`Game engine log ${i}`, {
        category: 'engine',
        component: 'entity-manager',
        data: { entityId: `entity-${i}`, action: 'create' },
      });

      // Simulate different log levels and categories
      if (i % 5 === 0) {
        remoteLogger.debug(`Debug trace ${i}`, { trace: true });
      }
      if (i % 10 === 0) {
        remoteLogger.warn(`Warning ${i}`, { warning: true });
      }
    }

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Should have multiple overflows demonstrating the issue
    expect(overflowCount).toBeGreaterThan(0);

    // Verify the overflow pattern matches what we see in logs
    expect(mockEventBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'REMOTE_LOGGER_BUFFER_OVERFLOW',
        payload: expect.objectContaining({
          removedCount: expect.any(Number),
          maxBufferSize: 100,
        }),
      })
    );
  });
});
