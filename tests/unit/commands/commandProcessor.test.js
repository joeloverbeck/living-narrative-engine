import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import CommandProcessor from '../../../src/commands/commandProcessor.js';
import { ATTEMPT_ACTION_ID } from '../../../src/constants/eventIds.js';
import { safeDispatchError } from '../../../src/utils/safeDispatchErrorUtils.js';

jest.mock('../../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: jest.fn(),
}));

const mkLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('CommandProcessor.dispatchAction', () => {
  let logger;
  let safeEventDispatcher;
  let eventDispatchService;
  let processor;

  beforeEach(() => {
    logger = mkLogger();
    safeEventDispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    eventDispatchService = {
      dispatchWithErrorHandling: jest.fn().mockResolvedValue(true),
      dispatchWithLogging: jest.fn().mockResolvedValue(undefined),
      safeDispatchEvent: jest.fn().mockResolvedValue(undefined),
    };
    processor = new CommandProcessor({
      logger,
      safeEventDispatcher,
      eventDispatchService,
    });
    jest.clearAllMocks();
  });

  it('AC1: dispatches a pre-resolved action successfully', async () => {
    const actor = { id: 'actor1' };
    const turnAction = {
      actionDefinitionId: 'look',
      resolvedParameters: { targetId: 't1', direction: 'north' },
      commandString: 'look north',
    };

    const result = await processor.dispatchAction(actor, turnAction);

    expect(result).toEqual({
      success: true,
      turnEnded: false,
      originalInput: 'look north',
      actionResult: { actionId: 'look' },
    });
    expect(
      eventDispatchService.dispatchWithErrorHandling
    ).toHaveBeenCalledTimes(1);
    expect(eventDispatchService.dispatchWithErrorHandling).toHaveBeenCalledWith(
      ATTEMPT_ACTION_ID,
      expect.objectContaining({
        eventName: ATTEMPT_ACTION_ID,
        actorId: 'actor1',
        actionId: 'look',
        targetId: 't1',
        originalInput: 'look north',
        // New fields added for enhanced payload
        primaryId: 't1',
        secondaryId: null,
        tertiaryId: null,
        resolvedTargetCount: 1,
        hasContextDependencies: false,
      }),
      'ATTEMPT_ACTION_ID dispatch for pre-resolved action look'
    );
    expect(logger.debug).toHaveBeenCalledWith(
      "CommandProcessor.dispatchAction: Successfully dispatched 'look' for actor actor1."
    );
  });

  it('returns failure when actor is missing an id', async () => {
    const actor = {};
    const turnAction = {
      actionDefinitionId: 'look',
      resolvedParameters: {},
      commandString: 'look',
    };

    const result = await processor.dispatchAction(actor, turnAction);

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      'Internal error: Malformed action prevented execution.'
    );
    expect(safeDispatchError).toHaveBeenCalledWith(
      safeEventDispatcher,
      'Internal error: Malformed action prevented execution.',
      expect.any(Object),
      logger
    );
  });

  it('returns failure when actor id is invalid', async () => {
    const actor = { id: '   ' };
    const turnAction = {
      actionDefinitionId: 'look',
      resolvedParameters: {},
      commandString: 'look',
    };

    const result = await processor.dispatchAction(actor, turnAction);

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        turnEnded: true,
        error: 'Internal error: Malformed action prevented execution.',
        internalError:
          "CommandProcessor.dispatchAction: Invalid ID '   '. Expected non-blank string.",
        originalInput: 'look',
      })
    );
    expect(result.actionResult).toEqual({ actionId: 'look' });
    expect(safeDispatchError).toHaveBeenCalledWith(
      safeEventDispatcher,
      'Internal error: Malformed action prevented execution.',
      expect.any(Object),
      logger
    );
  });

  it('returns failure when turnAction is not an object', async () => {
    const actor = { id: 'actor-invalid' };
    const result = await processor.dispatchAction(actor, null);

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      'Internal error: Malformed action prevented execution.'
    );
    expect(safeDispatchError).toHaveBeenCalledWith(
      safeEventDispatcher,
      'Internal error: Malformed action prevented execution.',
      expect.any(Object),
      logger
    );
  });

  it('AC2: returns failure and dispatches system error when actionDefinitionId is missing', async () => {
    const actor = { id: 'actor2' };
    const turnAction = { resolvedParameters: {}, commandString: 'noop' };

    const result = await processor.dispatchAction(actor, turnAction);

    expect(result.success).toBe(false);
    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        turnEnded: true,
        error: 'Internal error: Malformed action prevented execution.',
        internalError:
          'actor must have id and turnAction must include actionDefinitionId.',
      })
    );
    expect(safeDispatchError).toHaveBeenCalledTimes(1);
    expect(safeDispatchError).toHaveBeenCalledWith(
      safeEventDispatcher,
      'Internal error: Malformed action prevented execution.',
      expect.any(Object),
      logger
    );
  });

  it('returns identical CommandResult structures for missing and invalid actor ids', async () => {
    const resultMissing = await processor.dispatchAction(
      {},
      {
        actionDefinitionId: 'look',
        resolvedParameters: {},
        commandString: 'look',
      }
    );
    const resultInvalid = await processor.dispatchAction(
      { id: '   ' },
      {
        actionDefinitionId: 'look',
        resolvedParameters: {},
        commandString: 'look',
      }
    );
    expect(Object.keys(resultMissing)).toEqual(Object.keys(resultInvalid));
  });

  it('AC3: returns failure when dispatcher reports failure', async () => {
    eventDispatchService.dispatchWithErrorHandling.mockResolvedValueOnce(false);

    const actor = { id: 'actor3' };
    const turnAction = {
      actionDefinitionId: 'take',
      commandString: 'take',
      resolvedParameters: {},
    };

    const result = await processor.dispatchAction(actor, turnAction);

    expect(result.success).toBe(false);
    expect(
      eventDispatchService.dispatchWithErrorHandling
    ).toHaveBeenNthCalledWith(
      1,
      ATTEMPT_ACTION_ID,
      expect.any(Object),
      'ATTEMPT_ACTION_ID dispatch for pre-resolved action take'
    );
    expect(safeDispatchError).toHaveBeenCalledWith(
      safeEventDispatcher,
      'Internal error: Failed to initiate action.',
      expect.any(Object),
      logger
    );
    // The warning is now logged inside EventDispatchService, not directly by CommandProcessor
  });

  it('constructs expected failure result when dispatcher reports failure', async () => {
    eventDispatchService.dispatchWithErrorHandling.mockResolvedValueOnce(false);

    const actor = { id: 'actor3' };
    const turnAction = {
      actionDefinitionId: 'take',
      commandString: 'take',
      resolvedParameters: {},
    };

    const result = await processor.dispatchAction(actor, turnAction);

    expect(result).toEqual({
      success: false,
      turnEnded: true,
      internalError:
        'CRITICAL: Failed to dispatch pre-resolved ATTEMPT_ACTION_ID for actor3, action "take". Dispatcher reported failure.',
      originalInput: 'take',
      actionResult: { actionId: 'take' },
      error: 'Internal error: Failed to initiate action.',
    });
  });

  it('AC4: handles exception thrown by dispatcher', async () => {
    // Mock the safeEventDispatcher to throw an error internally
    // This will be caught by dispatchWithErrorHandling and it will return false
    eventDispatchService.dispatchWithErrorHandling.mockImplementationOnce(
      async () => {
        // Simulate what happens inside dispatchWithErrorHandling when dispatch throws
        await safeDispatchError(
          safeEventDispatcher,
          'System error during event dispatch.',
          {},
          logger
        );
        return false;
      }
    );

    const actor = { id: 'actor4' };
    const turnAction = {
      actionDefinitionId: 'jump',
      commandString: 'jump',
      resolvedParameters: {},
    };

    const result = await processor.dispatchAction(actor, turnAction);

    expect(result.success).toBe(false);
    expect(
      eventDispatchService.dispatchWithErrorHandling
    ).toHaveBeenNthCalledWith(
      1,
      ATTEMPT_ACTION_ID,
      expect.any(Object),
      'ATTEMPT_ACTION_ID dispatch for pre-resolved action jump'
    );
    // safeDispatchError should be called twice:
    // 1. From within dispatchWithErrorHandling when it catches the error
    // 2. From CommandProcessor when dispatchWithErrorHandling returns false
    expect(safeDispatchError).toHaveBeenCalledTimes(2);
  });
});

describe('CommandProcessor.dispatchAction payload specifics', () => {
  let logger;
  let safeEventDispatcher;
  let eventDispatchService;
  let processor;

  beforeEach(() => {
    logger = mkLogger();
    safeEventDispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    eventDispatchService = {
      dispatchWithErrorHandling: jest.fn().mockResolvedValue(true),
      dispatchWithLogging: jest.fn().mockResolvedValue(undefined),
      safeDispatchEvent: jest.fn().mockResolvedValue(undefined),
    };
    processor = new CommandProcessor({
      logger,
      safeEventDispatcher,
      eventDispatchService,
    });
    jest.clearAllMocks();
  });

  it('AC5: does NOT include "direction" in the ATTEMPT_ACTION_ID payload even if present in resolvedParameters', async () => {
    const actor = { id: 'actorTest' };
    const turnAction = {
      actionDefinitionId: 'testAction',
      resolvedParameters: { targetId: 'target1', direction: 'shouldBeIgnored' },
      commandString: 'testAction target1',
    };

    await processor.dispatchAction(actor, turnAction);

    expect(
      eventDispatchService.dispatchWithErrorHandling
    ).toHaveBeenCalledTimes(1);
    expect(eventDispatchService.dispatchWithErrorHandling).toHaveBeenCalledWith(
      ATTEMPT_ACTION_ID,
      expect.objectContaining({
        eventName: ATTEMPT_ACTION_ID,
        actorId: 'actorTest',
        actionId: 'testAction',
        targetId: 'target1',
        originalInput: 'testAction target1',
        // Enhanced payload fields
        primaryId: 'target1',
        secondaryId: null,
        tertiaryId: null,
        resolvedTargetCount: 1,
        hasContextDependencies: false,
      }),
      'ATTEMPT_ACTION_ID dispatch for pre-resolved action testAction'
    );

    // Specifically check that 'direction' is not in the payload
    const dispatchedPayload =
      eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];
    expect(dispatchedPayload).not.toHaveProperty('direction');
  });
});

describe('CommandProcessor enhanced multi-target payload', () => {
  let logger;
  let safeEventDispatcher;
  let eventDispatchService;
  let processor;

  beforeEach(() => {
    logger = mkLogger();
    safeEventDispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    eventDispatchService = {
      dispatchWithErrorHandling: jest.fn().mockResolvedValue(true),
      dispatchWithLogging: jest.fn().mockResolvedValue(undefined),
      safeDispatchEvent: jest.fn().mockResolvedValue(undefined),
    };
    processor = new CommandProcessor({
      logger,
      safeEventDispatcher,
      eventDispatchService,
    });
    jest.clearAllMocks();
  });

  it('creates enhanced payload with multi-target information', async () => {
    const actor = { id: 'amaia_castillo_instance' };
    const turnAction = {
      actionDefinitionId: 'caressing:adjust_clothing',
      resolvedParameters: {
        isMultiTarget: true,
        targetIds: {
          primary: ['p_erotica:iker_aguirre_instance'],
          secondary: ['fd6a1e00-36b7-47cc-bdb2-4b65473614eb'],
        },
      },
      commandString: "adjust Iker Aguirre's denim trucker jacket",
    };

    await processor.dispatchAction(actor, turnAction);

    const calledPayload =
      eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

    // Check base fields
    expect(calledPayload.eventName).toBe(ATTEMPT_ACTION_ID);
    expect(calledPayload.actorId).toBe('amaia_castillo_instance');
    expect(calledPayload.actionId).toBe('caressing:adjust_clothing');
    expect(calledPayload.originalInput).toBe(
      "adjust Iker Aguirre's denim trucker jacket"
    );

    // Check legacy fields for backward compatibility
    expect(calledPayload.primaryId).toBe('p_erotica:iker_aguirre_instance');
    expect(calledPayload.secondaryId).toBe(
      'fd6a1e00-36b7-47cc-bdb2-4b65473614eb'
    );
    expect(calledPayload.tertiaryId).toBeNull();

    // Check backward compatibility targetId
    expect(calledPayload.targetId).toBe('p_erotica:iker_aguirre_instance');

    // Check comprehensive targets object
    expect(calledPayload.targets).toBeDefined();
    expect(calledPayload.targets.primary).toEqual({
      entityId: 'p_erotica:iker_aguirre_instance',
      placeholder: 'primary',
      description: 'p_erotica:iker_aguirre_instance', // Would be actual name in full implementation
      resolvedFromContext: false,
    });
    expect(calledPayload.targets.secondary).toEqual({
      entityId: 'fd6a1e00-36b7-47cc-bdb2-4b65473614eb',
      placeholder: 'secondary',
      description: 'fd6a1e00-36b7-47cc-bdb2-4b65473614eb', // Would be actual name in full implementation
      resolvedFromContext: true,
      contextSource: 'primary',
    });

    // Check metadata
    expect(calledPayload.resolvedTargetCount).toBe(2);
    expect(calledPayload.hasContextDependencies).toBe(true);
  });

  it('handles single target action with legacy compatibility', async () => {
    const actor = { id: 'actor1' };
    const turnAction = {
      actionDefinitionId: 'core:examine',
      resolvedParameters: {
        targetId: 'item_123',
      },
      commandString: 'examine sword',
    };

    await processor.dispatchAction(actor, turnAction);

    const calledPayload =
      eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

    // Check legacy fields
    expect(calledPayload.targetId).toBe('item_123');
    expect(calledPayload.primaryId).toBe('item_123');
    expect(calledPayload.secondaryId).toBeNull();
    expect(calledPayload.tertiaryId).toBeNull();

    // Should not have targets object for single target
    expect(calledPayload.targets).toBeUndefined();

    // Check metadata
    expect(calledPayload.resolvedTargetCount).toBe(1);
    expect(calledPayload.hasContextDependencies).toBe(false);
  });

  it('handles action with no targets', async () => {
    const actor = { id: 'actor1' };
    const turnAction = {
      actionDefinitionId: 'core:wait',
      resolvedParameters: {},
      commandString: 'wait',
    };

    await processor.dispatchAction(actor, turnAction);

    const calledPayload =
      eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

    // Check all target fields are null
    expect(calledPayload.targetId).toBeNull();
    expect(calledPayload.primaryId).toBeNull();
    expect(calledPayload.secondaryId).toBeNull();
    expect(calledPayload.tertiaryId).toBeNull();

    // Should not have targets object
    expect(calledPayload.targets).toBeUndefined();

    // Check metadata
    expect(calledPayload.resolvedTargetCount).toBe(0);
    expect(calledPayload.hasContextDependencies).toBe(false);
  });

  it('handles three-target action', async () => {
    const actor = { id: 'actor1' };
    const turnAction = {
      actionDefinitionId: 'magic:complex_spell',
      resolvedParameters: {
        isMultiTarget: true,
        targetIds: {
          primary: ['target1'],
          secondary: ['target2'],
          tertiary: ['target3'],
        },
      },
      commandString: 'cast complex spell',
    };

    await processor.dispatchAction(actor, turnAction);

    const calledPayload =
      eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

    // Check all legacy fields
    expect(calledPayload.primaryId).toBe('target1');
    expect(calledPayload.secondaryId).toBe('target2');
    expect(calledPayload.tertiaryId).toBe('target3');

    // Check targets object has all three
    expect(Object.keys(calledPayload.targets)).toHaveLength(3);
    expect(calledPayload.targets.primary.entityId).toBe('target1');
    expect(calledPayload.targets.secondary.entityId).toBe('target2');
    expect(calledPayload.targets.tertiary.entityId).toBe('target3');

    // Check metadata
    expect(calledPayload.resolvedTargetCount).toBe(3);
  });

  it('gracefully handles malformed multi-target data', async () => {
    const actor = { id: 'actor1' };
    const turnAction = {
      actionDefinitionId: 'test:action',
      resolvedParameters: {
        targetId: 'target1',
        // Invalid data that might cause error - targetIds must be object with arrays
        isMultiTarget: true,
        targetIds: 'not-an-object', // This will cause an error in forEach
      },
      commandString: 'test command',
    };

    await processor.dispatchAction(actor, turnAction);

    // Even with error, should still dispatch with valid payload
    expect(eventDispatchService.dispatchWithErrorHandling).toHaveBeenCalled();

    const calledPayload =
      eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

    // Should still have all required fields
    expect(calledPayload.actorId).toBe('actor1');
    expect(calledPayload.actionId).toBe('test:action');
    expect(calledPayload.targetId).toBe('target1');

    // Should have metadata fields
    expect(calledPayload.resolvedTargetCount).toBeDefined();
    expect(calledPayload.hasContextDependencies).toBeDefined();

    // Should have timestamp
    expect(calledPayload.timestamp).toBeDefined();
    expect(calledPayload.timestamp).toBeGreaterThan(0);
  });

  it('respects performance constraints', async () => {
    const actor = { id: 'actor1' };
    const turnAction = {
      actionDefinitionId: 'test:action',
      resolvedParameters: {
        isMultiTarget: true,
        targetIds: {
          primary: ['target1'],
          secondary: ['target2'],
        },
      },
      commandString: 'test command',
    };

    const startTime = performance.now();
    await processor.dispatchAction(actor, turnAction);
    const duration = performance.now() - startTime;

    // Should complete within reasonable time (allowing for test overhead)
    expect(duration).toBeLessThan(50); // 50ms is generous for tests

    // Should not log performance warning for fast execution
    const perfWarningCalls = logger.warn.mock.calls.filter((call) =>
      call[0].includes('Payload creation exceeded target time')
    );
    expect(perfWarningCalls).toHaveLength(0);
  });

  it('logs metrics periodically', async () => {
    // Reset statistics
    processor.resetPayloadCreationStatistics();

    // Create a multi-target action
    const actor = { id: 'actor1' };
    const multiTargetAction = {
      actionDefinitionId: 'test:multi',
      resolvedParameters: {
        isMultiTarget: true,
        targetIds: { primary: ['t1'], secondary: ['t2'] },
      },
      commandString: 'multi',
    };

    // Create enough payloads to trigger metric logging (100)
    for (let i = 0; i < 100; i++) {
      await processor.dispatchAction(actor, multiTargetAction);
    }

    // Check if metrics were logged
    const metricsLogCalls = logger.info.mock.calls.filter(
      (call) => call[0] === 'Payload creation metrics update'
    );
    expect(metricsLogCalls).toHaveLength(1);

    const stats = processor.getPayloadCreationStatistics();
    expect(stats.totalPayloadsCreated).toBe(100);
    expect(stats.multiTargetPayloads).toBe(100);
    expect(stats.averageCreationTime).toBeGreaterThan(0);
  });
});

describe('CommandProcessor with tracing functionality', () => {
  let logger;
  let safeEventDispatcher;
  let eventDispatchService;
  let actionTraceFilter;
  let actionExecutionTraceFactory;
  let actionTraceOutputService;
  let mockTrace;
  let processor;

  beforeEach(() => {
    logger = mkLogger();
    safeEventDispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    eventDispatchService = {
      dispatchWithErrorHandling: jest.fn().mockResolvedValue(true),
      dispatchWithLogging: jest.fn().mockResolvedValue(undefined),
      safeDispatchEvent: jest.fn().mockResolvedValue(undefined),
    };

    // Setup mock trace object
    mockTrace = {
      captureDispatchStart: jest.fn(),
      captureEventPayload: jest.fn(),
      captureDispatchResult: jest.fn(),
      captureError: jest.fn(),
      isComplete: true,
      hasError: false,
    };

    // Setup tracing dependencies
    actionTraceFilter = {
      isEnabled: jest.fn().mockReturnValue(true),
      shouldTrace: jest.fn().mockReturnValue(true),
    };

    actionExecutionTraceFactory = {
      createFromTurnAction: jest.fn().mockReturnValue(mockTrace),
    };

    actionTraceOutputService = {
      writeTrace: jest.fn().mockResolvedValue(undefined),
    };

    processor = new CommandProcessor({
      logger,
      safeEventDispatcher,
      eventDispatchService,
      actionTraceFilter,
      actionExecutionTraceFactory,
      actionTraceOutputService,
    });

    jest.clearAllMocks();
  });

  it('creates and writes trace when tracing is enabled', async () => {
    const actor = { id: 'traced-actor' };
    const turnAction = {
      actionDefinitionId: 'traced-action',
      resolvedParameters: { targetId: 'target1' },
      commandString: 'traced action command',
    };

    const result = await processor.dispatchAction(actor, turnAction);

    expect(result.success).toBe(true);
    expect(actionTraceFilter.isEnabled).toHaveBeenCalled();
    expect(actionTraceFilter.shouldTrace).toHaveBeenCalledWith('traced-action');
    expect(
      actionExecutionTraceFactory.createFromTurnAction
    ).toHaveBeenCalledWith(turnAction, 'traced-actor');
    expect(mockTrace.captureDispatchStart).toHaveBeenCalled();
    expect(mockTrace.captureEventPayload).toHaveBeenCalled();
    expect(mockTrace.captureDispatchResult).toHaveBeenCalled();
    expect(actionTraceOutputService.writeTrace).toHaveBeenCalledWith(mockTrace);
  });

  it('skips trace creation when filter is disabled', async () => {
    actionTraceFilter.isEnabled.mockReturnValue(false);

    const actor = { id: 'actor1' };
    const turnAction = {
      actionDefinitionId: 'action1',
      resolvedParameters: {},
      commandString: 'test',
    };

    const result = await processor.dispatchAction(actor, turnAction);

    expect(result.success).toBe(true);
    expect(actionTraceFilter.isEnabled).toHaveBeenCalled();
    expect(actionTraceFilter.shouldTrace).not.toHaveBeenCalled();
    expect(
      actionExecutionTraceFactory.createFromTurnAction
    ).not.toHaveBeenCalled();
  });

  it('skips trace creation when action should not be traced', async () => {
    actionTraceFilter.shouldTrace.mockReturnValue(false);

    const actor = { id: 'actor1' };
    const turnAction = {
      actionDefinitionId: 'untraced-action',
      resolvedParameters: {},
      commandString: 'test',
    };

    const result = await processor.dispatchAction(actor, turnAction);

    expect(result.success).toBe(true);
    expect(actionTraceFilter.isEnabled).toHaveBeenCalled();
    expect(actionTraceFilter.shouldTrace).toHaveBeenCalledWith(
      'untraced-action'
    );
    expect(
      actionExecutionTraceFactory.createFromTurnAction
    ).not.toHaveBeenCalled();
  });

  it('continues execution when trace creation fails', async () => {
    actionExecutionTraceFactory.createFromTurnAction.mockImplementation(() => {
      throw new Error('Trace creation failed');
    });

    const actor = { id: 'actor1' };
    const turnAction = {
      actionDefinitionId: 'action1',
      resolvedParameters: {},
      commandString: 'test',
    };

    const result = await processor.dispatchAction(actor, turnAction);

    expect(result.success).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to create execution trace',
      expect.objectContaining({
        error: 'Trace creation failed',
        actionId: 'action1',
        actorId: 'actor1',
      })
    );
  });

  it('handles trace payload capture failure gracefully', async () => {
    mockTrace.captureEventPayload.mockImplementation(() => {
      throw new Error('Payload capture failed');
    });

    const actor = { id: 'actor1' };
    const turnAction = {
      actionDefinitionId: 'action1',
      resolvedParameters: {},
      commandString: 'test',
    };

    const result = await processor.dispatchAction(actor, turnAction);

    expect(result.success).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to capture event payload in trace',
      expect.objectContaining({
        error: 'Payload capture failed',
        actionId: 'action1',
      })
    );
  });

  it('handles trace result capture failure gracefully', async () => {
    mockTrace.captureDispatchResult.mockImplementation(() => {
      throw new Error('Result capture failed');
    });

    const actor = { id: 'actor1' };
    const turnAction = {
      actionDefinitionId: 'action1',
      resolvedParameters: {},
      commandString: 'test',
    };

    const result = await processor.dispatchAction(actor, turnAction);

    expect(result.success).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to capture dispatch result in trace',
      expect.objectContaining({
        error: 'Result capture failed',
        actionId: 'action1',
      })
    );
  });

  it('writes trace and handles error capture when dispatch fails', async () => {
    eventDispatchService.dispatchWithErrorHandling.mockRejectedValue(
      new Error('Dispatch error')
    );

    const actor = { id: 'actor1' };
    const turnAction = {
      actionDefinitionId: 'action1',
      resolvedParameters: {},
      commandString: 'test',
    };

    const result = await processor.dispatchAction(actor, turnAction);

    expect(result.success).toBe(false);
    expect(mockTrace.captureError).toHaveBeenCalled();
    expect(actionTraceOutputService.writeTrace).toHaveBeenCalledWith(mockTrace);
  });

  it('handles trace error capture failure gracefully', async () => {
    eventDispatchService.dispatchWithErrorHandling.mockRejectedValue(
      new Error('Dispatch error')
    );
    mockTrace.captureError.mockImplementation(() => {
      throw new Error('Error capture failed');
    });

    const actor = { id: 'actor1' };
    const turnAction = {
      actionDefinitionId: 'action1',
      resolvedParameters: {},
      commandString: 'test',
    };

    const result = await processor.dispatchAction(actor, turnAction);

    expect(result.success).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to capture error in trace',
      expect.objectContaining({
        originalError: 'Dispatch error',
        traceError: 'Error capture failed',
        actionId: 'action1',
      })
    );
  });

  it('handles trace write failure gracefully', async () => {
    actionTraceOutputService.writeTrace.mockRejectedValue(
      new Error('Write failed')
    );

    const actor = { id: 'actor1' };
    const turnAction = {
      actionDefinitionId: 'action1',
      resolvedParameters: {},
      commandString: 'test',
    };

    const result = await processor.dispatchAction(actor, turnAction);

    // Should still succeed despite trace write failure
    expect(result.success).toBe(true);

    // Wait a bit for async write to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to write execution trace',
      expect.objectContaining({
        error: 'Write failed',
        actionId: 'action1',
        traceComplete: true,
        hasError: false,
      })
    );
  });

  it('writes trace on dispatch failure', async () => {
    eventDispatchService.dispatchWithErrorHandling.mockResolvedValue(false);

    const actor = { id: 'actor1' };
    const turnAction = {
      actionDefinitionId: 'action1',
      resolvedParameters: {},
      commandString: 'test',
    };

    const result = await processor.dispatchAction(actor, turnAction);

    expect(result.success).toBe(false);
    expect(actionTraceOutputService.writeTrace).toHaveBeenCalledWith(mockTrace);
  });
});

describe('CommandProcessor validation of optional tracing dependencies', () => {
  let logger;
  let safeEventDispatcher;
  let eventDispatchService;

  beforeEach(() => {
    logger = mkLogger();
    safeEventDispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    eventDispatchService = {
      dispatchWithErrorHandling: jest.fn().mockResolvedValue(true),
      dispatchWithLogging: jest.fn().mockResolvedValue(undefined),
      safeDispatchEvent: jest.fn().mockResolvedValue(undefined),
    };
    jest.clearAllMocks();
  });

  it('validates actionTraceFilter when provided', () => {
    const invalidFilter = {
      isEnabled: jest.fn(),
      // Missing shouldTrace method
    };

    expect(() => {
      new CommandProcessor({
        logger,
        safeEventDispatcher,
        eventDispatchService,
        actionTraceFilter: invalidFilter,
      });
    }).toThrow();
  });

  it('validates actionExecutionTraceFactory when provided', () => {
    const invalidFactory = {
      // Missing createFromTurnAction method
    };

    expect(() => {
      new CommandProcessor({
        logger,
        safeEventDispatcher,
        eventDispatchService,
        actionExecutionTraceFactory: invalidFactory,
      });
    }).toThrow();
  });

  it('validates actionTraceOutputService when provided', () => {
    const invalidService = {
      // Missing writeTrace method
    };

    expect(() => {
      new CommandProcessor({
        logger,
        safeEventDispatcher,
        eventDispatchService,
        actionTraceOutputService: invalidService,
      });
    }).toThrow();
  });
});

describe('CommandProcessor multi-target edge cases', () => {
  let logger;
  let safeEventDispatcher;
  let eventDispatchService;
  let processor;

  beforeEach(() => {
    logger = mkLogger();
    safeEventDispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    eventDispatchService = {
      dispatchWithErrorHandling: jest.fn().mockResolvedValue(true),
      dispatchWithLogging: jest.fn().mockResolvedValue(undefined),
      safeDispatchEvent: jest.fn().mockResolvedValue(undefined),
    };
    processor = new CommandProcessor({
      logger,
      safeEventDispatcher,
      eventDispatchService,
    });
    jest.clearAllMocks();
  });

  it('handles target items that are objects with entityId', async () => {
    const actor = { id: 'actor1' };
    const turnAction = {
      actionDefinitionId: 'test:action',
      resolvedParameters: {
        isMultiTarget: true,
        targetIds: {
          primary: [{ entityId: 'entity1', description: 'Entity 1' }],
          secondary: [{ entityId: 'entity2', description: 'Entity 2' }],
        },
      },
      commandString: 'test command',
    };

    await processor.dispatchAction(actor, turnAction);

    const calledPayload =
      eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

    expect(calledPayload.targets.primary.entityId).toBe('entity1');
    expect(calledPayload.targets.secondary.entityId).toBe('entity2');
    expect(calledPayload.primaryId).toBe('entity1');
    expect(calledPayload.secondaryId).toBe('entity2');
  });

  it('skips invalid target items (non-string, empty string)', async () => {
    const actor = { id: 'actor1' };
    const turnAction = {
      actionDefinitionId: 'test:action',
      resolvedParameters: {
        isMultiTarget: true,
        targetIds: {
          primary: [null], // Invalid
          secondary: ['   '], // Empty string
          tertiary: ['valid-target'], // Valid
        },
      },
      commandString: 'test command',
    };

    await processor.dispatchAction(actor, turnAction);

    const calledPayload =
      eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

    // Should only have the valid target
    expect(calledPayload.targets).toBeDefined();
    expect(calledPayload.targets.primary).toBeUndefined();
    expect(calledPayload.targets.secondary).toBeUndefined();
    expect(calledPayload.targets.tertiary).toBeDefined();
    expect(calledPayload.targets.tertiary.entityId).toBe('valid-target');
    expect(calledPayload.resolvedTargetCount).toBe(1);
  });

  it('uses first available target as primary when no primary or target placeholder exists', async () => {
    const actor = { id: 'actor1' };
    const turnAction = {
      actionDefinitionId: 'test:action',
      resolvedParameters: {
        isMultiTarget: true,
        targetIds: {
          customPlaceholder: ['custom-target'],
          anotherPlaceholder: ['another-target'],
        },
      },
      commandString: 'test command',
    };

    await processor.dispatchAction(actor, turnAction);

    const calledPayload =
      eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

    // Should use first available target as primary
    expect(calledPayload.targetId).toBe('custom-target');
    expect(calledPayload.targets.customPlaceholder.entityId).toBe(
      'custom-target'
    );
    expect(calledPayload.targets.anotherPlaceholder.entityId).toBe(
      'another-target'
    );
  });

  it('handles targetIds that is an array instead of object', async () => {
    const actor = { id: 'actor1' };
    const turnAction = {
      actionDefinitionId: 'test:action',
      resolvedParameters: {
        isMultiTarget: true,
        targetIds: ['target1', 'target2'], // Array instead of object
      },
      commandString: 'test command',
    };

    await processor.dispatchAction(actor, turnAction);

    const calledPayload =
      eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

    // Should have no targets since targetIds is not a proper object
    expect(calledPayload.targets).toBeUndefined();
    expect(calledPayload.targetId).toBeNull();
    expect(calledPayload.resolvedTargetCount).toBe(0);
  });

  it('prefers target placeholder over first available when no primary exists', async () => {
    const actor = { id: 'actor1' };
    const turnAction = {
      actionDefinitionId: 'test:action',
      resolvedParameters: {
        isMultiTarget: true,
        targetIds: {
          custom: ['custom-target'],
          target: ['preferred-target'], // 'target' placeholder has priority
          another: ['another-target'],
        },
      },
      commandString: 'test command',
    };

    await processor.dispatchAction(actor, turnAction);

    const calledPayload =
      eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

    // Should prefer 'target' placeholder
    expect(calledPayload.targetId).toBe('preferred-target');
  });

  it('handles empty target arrays gracefully', async () => {
    const actor = { id: 'actor1' };
    const turnAction = {
      actionDefinitionId: 'test:action',
      resolvedParameters: {
        isMultiTarget: true,
        targetIds: {
          primary: [], // Empty array
          secondary: ['valid-target'],
        },
      },
      commandString: 'test command',
    };

    await processor.dispatchAction(actor, turnAction);

    const calledPayload =
      eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

    // Should only have secondary target
    expect(calledPayload.targets.primary).toBeUndefined();
    expect(calledPayload.targets.secondary).toBeDefined();
    expect(calledPayload.targets.secondary.entityId).toBe('valid-target');
    expect(calledPayload.primaryId).toBeNull();
    expect(calledPayload.secondaryId).toBe('valid-target');
    expect(calledPayload.targetId).toBe('valid-target'); // Should use secondary as primary is missing
  });
});

describe('CommandProcessor performance and error scenarios', () => {
  let logger;
  let safeEventDispatcher;
  let eventDispatchService;
  let processor;

  beforeEach(() => {
    logger = mkLogger();
    safeEventDispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    eventDispatchService = {
      dispatchWithErrorHandling: jest.fn().mockResolvedValue(true),
      dispatchWithLogging: jest.fn().mockResolvedValue(undefined),
      safeDispatchEvent: jest.fn().mockResolvedValue(undefined),
    };
    processor = new CommandProcessor({
      logger,
      safeEventDispatcher,
      eventDispatchService,
    });
    jest.clearAllMocks();
  });

  it('logs performance warning when payload creation takes too long', async () => {
    // Mock performance.now to simulate slow execution
    const originalPerformanceNow = performance.now;
    let callCount = 0;
    jest.spyOn(performance, 'now').mockImplementation(() => {
      callCount++;
      // First call returns 0, second call returns 15 (>10ms threshold)
      return callCount === 1 ? 0 : 15;
    });

    const actor = { id: 'actor1' };
    const turnAction = {
      actionDefinitionId: 'test:action',
      resolvedParameters: {
        isMultiTarget: true,
        targetIds: {
          primary: ['target1'],
          secondary: ['target2'],
        },
      },
      commandString: 'test command',
    };

    await processor.dispatchAction(actor, turnAction);

    expect(logger.warn).toHaveBeenCalledWith(
      'Payload creation took longer than expected',
      expect.objectContaining({
        duration: '15.00',
        target: '< 10ms',
      })
    );

    performance.now.mockRestore();
  });

  it('creates valid payload even with edge case inputs', async () => {
    const actor = { id: 'actor1' };
    const turnAction = {
      actionDefinitionId: 'test:action',
      resolvedParameters: {
        targetId: 'fallback-target',
      },
      commandString: 'test command',
    };

    await processor.dispatchAction(actor, turnAction);

    const calledPayload =
      eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

    // Should have created a valid payload
    expect(calledPayload.eventName).toBe(ATTEMPT_ACTION_ID);
    expect(calledPayload.actorId).toBe('actor1');
    expect(calledPayload.actionId).toBe('test:action');
    expect(calledPayload.targetId).toBe('fallback-target');
    expect(calledPayload.originalInput).toBe('test command');
  });

  it('handles payload creation error and uses fallback', async () => {
    // Mock MultiTargetEventBuilder to throw error
    const MultiTargetEventBuilder = jest.requireActual(
      '../../../src/entities/multiTarget/multiTargetEventBuilder.js'
    ).default;
    const originalBuild = MultiTargetEventBuilder.prototype.build;

    jest
      .spyOn(MultiTargetEventBuilder.prototype, 'build')
      .mockImplementation(function () {
        throw new Error('Builder error');
      });

    const actor = { id: 'actor1' };
    const turnAction = {
      actionDefinitionId: 'test:action',
      resolvedParameters: {
        targetId: 'target1',
      },
      commandString: 'test command',
    };

    await processor.dispatchAction(actor, turnAction);

    // Should have still dispatched with fallback payload
    expect(eventDispatchService.dispatchWithErrorHandling).toHaveBeenCalled();

    const calledPayload =
      eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

    // Fallback payload should have these fields
    expect(calledPayload.eventName).toBe(ATTEMPT_ACTION_ID);
    expect(calledPayload.actorId).toBe('actor1');
    expect(calledPayload.actionId).toBe('test:action');

    // Should have logged the error
    expect(logger.error).toHaveBeenCalledWith(
      'Enhanced payload creation failed, using fallback',
      expect.objectContaining({
        error: 'Builder error',
        actorId: 'actor1',
        actionId: 'test:action',
      })
    );

    MultiTargetEventBuilder.prototype.build.mockRestore();
  });

  it('handles missing both commandString and actionDefinitionId in fallback', async () => {
    const actor = { id: 'actor1' };
    const turnAction = {
      actionDefinitionId: '', // Empty string
      resolvedParameters: {},
      commandString: '', // Empty string
    };

    const result = await processor.dispatchAction(actor, turnAction);

    // Should fail validation before payload creation
    expect(result.success).toBe(false);
    expect(result.error).toBe(
      'Internal error: Malformed action prevented execution.'
    );
  });

  it('validates payload inputs and throws for invalid actor', async () => {
    const actor = null; // Invalid actor
    const turnAction = {
      actionDefinitionId: 'test:action',
      resolvedParameters: {},
      commandString: 'test',
    };

    const result = await processor.dispatchAction(actor, turnAction);

    expect(result.success).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      'CommandProcessor.dispatchAction: Input validation failed',
      expect.any(Object)
    );
  });

  it('validates payload inputs and throws for missing actionDefinitionId', async () => {
    const actor = { id: 'actor1' };
    const turnAction = {
      // Missing actionDefinitionId
      resolvedParameters: {},
      commandString: 'test',
    };

    const result = await processor.dispatchAction(actor, turnAction);

    expect(result.success).toBe(false);
    expect(result.internalError).toBe(
      'actor must have id and turnAction must include actionDefinitionId.'
    );
  });
});

describe('CommandProcessor getEntityDescription error handling', () => {
  let logger;
  let safeEventDispatcher;
  let eventDispatchService;
  let processor;

  beforeEach(() => {
    logger = mkLogger();
    safeEventDispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    eventDispatchService = {
      dispatchWithErrorHandling: jest.fn().mockResolvedValue(true),
      dispatchWithLogging: jest.fn().mockResolvedValue(undefined),
      safeDispatchEvent: jest.fn().mockResolvedValue(undefined),
    };
    processor = new CommandProcessor({
      logger,
      safeEventDispatcher,
      eventDispatchService,
    });
    jest.clearAllMocks();
  });

  it('returns entityId when getEntityDescription encounters an error', async () => {
    // This is already covered by default behavior since we don't have entity manager
    // But we can test that it handles the case gracefully
    const actor = { id: 'actor1' };
    const turnAction = {
      actionDefinitionId: 'test:action',
      resolvedParameters: {
        isMultiTarget: true,
        targetIds: {
          primary: ['entity-with-error'],
        },
      },
      commandString: 'test command',
    };

    await processor.dispatchAction(actor, turnAction);

    const calledPayload =
      eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

    // Should use entity ID as description
    expect(calledPayload.targets.primary.description).toBe('entity-with-error');
  });
});

describe('CommandProcessor additional edge cases', () => {
  let logger;
  let safeEventDispatcher;
  let eventDispatchService;
  let processor;

  beforeEach(() => {
    logger = mkLogger();
    safeEventDispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    eventDispatchService = {
      dispatchWithErrorHandling: jest.fn().mockResolvedValue(true),
      dispatchWithLogging: jest.fn().mockResolvedValue(undefined),
      safeDispatchEvent: jest.fn().mockResolvedValue(undefined),
    };
    jest.clearAllMocks();
  });

  it('skips trace creation when actionId is null', async () => {
    // Create processor with all trace dependencies
    const actionTraceFilter = {
      isEnabled: jest.fn().mockReturnValue(true),
      shouldTrace: jest.fn().mockReturnValue(true),
    };

    processor = new CommandProcessor({
      logger,
      safeEventDispatcher,
      eventDispatchService,
      actionTraceFilter,
      actionExecutionTraceFactory: {
        createFromTurnAction: jest.fn(),
      },
      actionTraceOutputService: {
        writeTrace: jest.fn(),
      },
    });

    const actor = { id: 'actor1' };
    const turnAction = {
      actionDefinitionId: null, // Will skip trace creation
      resolvedParameters: {},
      commandString: 'test',
    };

    const result = await processor.dispatchAction(actor, turnAction);

    // Should fail validation
    expect(result.success).toBe(false);

    // Should not attempt to create trace with null actionId
    expect(actionTraceFilter.shouldTrace).not.toHaveBeenCalled();
  });

  it('handles object with invalid entityId type in multi-target', async () => {
    processor = new CommandProcessor({
      logger,
      safeEventDispatcher,
      eventDispatchService,
    });

    const actor = { id: 'actor1' };
    const turnAction = {
      actionDefinitionId: 'test:action',
      resolvedParameters: {
        isMultiTarget: true,
        targetIds: {
          primary: [{ entityId: { nested: 'object' } }], // Object instead of string
          secondary: [{ someOtherField: 'value' }], // Missing entityId
        },
      },
      commandString: 'test command',
    };

    await processor.dispatchAction(actor, turnAction);

    const calledPayload =
      eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

    // Should skip all invalid targets
    expect(calledPayload.targets).toBeUndefined();
    expect(calledPayload.resolvedTargetCount).toBe(0);
  });

  it('handles invalid target object with non-string entityId', async () => {
    processor = new CommandProcessor({
      logger,
      safeEventDispatcher,
      eventDispatchService,
    });

    const actor = { id: 'actor1' };
    const turnAction = {
      actionDefinitionId: 'test:action',
      resolvedParameters: {
        isMultiTarget: true,
        targetIds: {
          primary: [{ entityId: 123 }], // Non-string entityId
          secondary: [{ entityId: null }], // Null entityId
        },
      },
      commandString: 'test command',
    };

    await processor.dispatchAction(actor, turnAction);

    const calledPayload =
      eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

    // Should skip invalid targets
    expect(calledPayload.targets).toBeUndefined();
    expect(calledPayload.resolvedTargetCount).toBe(0);
  });

  it('validates turnAction with missing commandString and empty actionDefinitionId', async () => {
    processor = new CommandProcessor({
      logger,
      safeEventDispatcher,
      eventDispatchService,
    });

    const actor = { id: 'actor1' };
    const turnAction = {
      actionDefinitionId: null, // Null instead of string
      resolvedParameters: {},
      // Missing commandString
    };

    const result = await processor.dispatchAction(actor, turnAction);

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      'Internal error: Malformed action prevented execution.'
    );
  });

  it('handles payload input validation for actor without id', async () => {
    processor = new CommandProcessor({
      logger,
      safeEventDispatcher,
      eventDispatchService,
    });

    const actor = { name: 'Actor' }; // Has properties but no id
    const turnAction = {
      actionDefinitionId: 'test:action',
      resolvedParameters: {},
      commandString: 'test',
    };

    const result = await processor.dispatchAction(actor, turnAction);

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      'Internal error: Malformed action prevented execution.'
    );
  });

  it('handles payload validation for turnAction without both commandString and actionDefinitionId', async () => {
    processor = new CommandProcessor({
      logger,
      safeEventDispatcher,
      eventDispatchService,
    });

    const actor = { id: 'actor1' };
    const turnAction = {
      actionDefinitionId: null,
      resolvedParameters: {},
      // Both missing/null
    };

    const result = await processor.dispatchAction(actor, turnAction);

    expect(result.success).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      'CommandProcessor.dispatchAction: Input validation failed',
      expect.any(Object)
    );
  });
});
