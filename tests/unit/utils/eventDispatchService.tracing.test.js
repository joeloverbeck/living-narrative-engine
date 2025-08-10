/**
 * @file Basic tracing test for EventDispatchService
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EventDispatchService } from '../../../src/utils/eventDispatchService.js';
import { EventDispatchTracer } from '../../../src/events/tracing/eventDispatchTracer.js';

describe('EventDispatchService - Basic Tracing', () => {
  let eventDispatchService;
  let writtenTraces;

  beforeEach(async () => {
    jest.clearAllMocks();
    writtenTraces = [];

    const mockSafeEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(true),
    };

    const mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const mockActionTraceFilter = {
      isEnabled: jest.fn().mockReturnValue(true),
      shouldTrace: jest.fn().mockReturnValue(true),
    };

    const mockOutputService = {
      writeTrace: jest.fn().mockImplementation(async (trace) => {
        writtenTraces.push(trace.toJSON());
      }),
    };

    const eventDispatchTracer = new EventDispatchTracer({
      logger: mockLogger,
      outputService: mockOutputService,
    });

    eventDispatchService = new EventDispatchService({
      safeEventDispatcher: mockSafeEventDispatcher,
      logger: mockLogger,
      actionTraceFilter: mockActionTraceFilter,
      eventDispatchTracer: eventDispatchTracer,
    });
  });

  it('should create and write trace when enabled', async () => {
    const result = await eventDispatchService.dispatchWithErrorHandling(
      'TEST_EVENT',
      { data: 'test' },
      'Test context'
    );

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(result).toBe(true);
    expect(writtenTraces).toHaveLength(1);
    expect(writtenTraces[0].metadata.eventName).toBe('TEST_EVENT');
    expect(writtenTraces[0].dispatch.success).toBe(true);
  });
});
