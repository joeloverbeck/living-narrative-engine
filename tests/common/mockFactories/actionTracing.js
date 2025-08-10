/**
 * @file Mock factories for action tracing components
 * @description Provides mock implementations for testing action tracing features
 */

import { jest } from '@jest/globals';

/**
 * Create mock ActionTraceFilter
 *
 * @returns {object} Mock ActionTraceFilter instance
 */
export function createMockActionTraceFilter() {
  return {
    isEnabled: jest.fn().mockReturnValue(true),
    shouldTrace: jest.fn().mockReturnValue(false),
    getVerbosityLevel: jest.fn().mockReturnValue('standard'),
    getInclusionConfig: jest.fn().mockReturnValue({
      componentData: false,
      prerequisites: false,
      targets: false,
    }),
  };
}

/**
 * Create mock ActionExecutionTrace
 *
 * @returns {object} Mock ActionExecutionTrace instance
 */
export function createMockActionExecutionTrace() {
  const mock = {
    actionId: 'test:action',
    actorId: 'test-actor',
    isComplete: false,
    hasError: false,
    duration: null,
    captureDispatchStart: jest.fn(),
    captureEventPayload: jest.fn(),
    captureDispatchResult: jest.fn(),
    captureError: jest.fn(),
    getExecutionPhases: jest.fn().mockReturnValue([]),
    toJSON: jest.fn().mockReturnValue({
      metadata: {
        actionId: 'test:action',
        actorId: 'test-actor',
        traceType: 'execution',
        createdAt: new Date().toISOString(),
        version: '1.0',
      },
      turnAction: {
        actionDefinitionId: 'test:action',
        commandString: 'test command',
        parameters: {},
      },
      execution: {
        startTime: null,
        endTime: null,
        duration: null,
        eventPayload: null,
        dispatchResult: null,
        error: null,
        phases: [],
      },
    }),
  };

  // Update isComplete when captureDispatchResult or captureError is called
  mock.captureDispatchResult.mockImplementation((result) => {
    mock.isComplete = true;
    mock.duration = 100; // Mock duration
  });

  mock.captureError.mockImplementation((error) => {
    mock.isComplete = true;
    mock.hasError = true;
    mock.duration = 100; // Mock duration
  });

  return mock;
}

/**
 * Create mock ActionExecutionTraceFactory
 *
 * @returns {object} Mock ActionExecutionTraceFactory instance
 */
export function createMockActionExecutionTraceFactory() {
  return {
    createTrace: jest
      .fn()
      .mockImplementation(({ actionId, actorId, turnAction }) => {
        const trace = createMockActionExecutionTrace();
        trace.actionId = actionId;
        trace.actorId = actorId;
        return trace;
      }),
    createFromTurnAction: jest
      .fn()
      .mockImplementation((turnAction, actorId) => {
        const trace = createMockActionExecutionTrace();
        trace.actionId = turnAction.actionDefinitionId;
        trace.actorId = actorId;
        return trace;
      }),
  };
}

/**
 * Create mock ActionTraceOutputService
 *
 * @returns {object} Mock ActionTraceOutputService instance
 */
export function createMockActionTraceOutputService() {
  return {
    writeTrace: jest.fn().mockResolvedValue(undefined),
    waitForPendingWrites: jest.fn().mockResolvedValue(undefined),
    getStatistics: jest.fn().mockReturnValue({
      totalWrites: 0,
      totalErrors: 0,
      pendingWrites: 0,
      errorRate: 0,
    }),
    resetStatistics: jest.fn(),
  };
}

// Note: createMockEventDispatchService, createMockLogger, and createMockSafeEventDispatcher
// are already defined in coreServices.js and should be imported from there
