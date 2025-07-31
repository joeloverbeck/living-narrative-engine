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
      actionDefinitionId: 'intimacy:adjust_clothing',
      resolvedParameters: {
        isMultiTarget: true,
        targetIds: {
          primary: ['p_erotica:iker_aguirre_instance'],
          secondary: ['fd6a1e00-36b7-47cc-bdb2-4b65473614eb']
        }
      },
      commandString: "adjust Iker Aguirre's denim trucker jacket",
    };

    await processor.dispatchAction(actor, turnAction);

    const calledPayload = eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];
    
    // Check base fields
    expect(calledPayload.eventName).toBe(ATTEMPT_ACTION_ID);
    expect(calledPayload.actorId).toBe('amaia_castillo_instance');
    expect(calledPayload.actionId).toBe('intimacy:adjust_clothing');
    expect(calledPayload.originalInput).toBe("adjust Iker Aguirre's denim trucker jacket");
    
    // Check legacy fields for backward compatibility
    expect(calledPayload.primaryId).toBe('p_erotica:iker_aguirre_instance');
    expect(calledPayload.secondaryId).toBe('fd6a1e00-36b7-47cc-bdb2-4b65473614eb');
    expect(calledPayload.tertiaryId).toBeNull();
    
    // Check backward compatibility targetId
    expect(calledPayload.targetId).toBe('p_erotica:iker_aguirre_instance');
    
    // Check comprehensive targets object
    expect(calledPayload.targets).toBeDefined();
    expect(calledPayload.targets.primary).toEqual({
      entityId: 'p_erotica:iker_aguirre_instance',
      placeholder: 'primary',
      description: 'p_erotica:iker_aguirre_instance', // Would be actual name in full implementation
      resolvedFromContext: false
    });
    expect(calledPayload.targets.secondary).toEqual({
      entityId: 'fd6a1e00-36b7-47cc-bdb2-4b65473614eb',
      placeholder: 'secondary',
      description: 'fd6a1e00-36b7-47cc-bdb2-4b65473614eb', // Would be actual name in full implementation
      resolvedFromContext: true,
      contextSource: 'primary'
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
        targetId: 'item_123'
      },
      commandString: 'examine sword',
    };

    await processor.dispatchAction(actor, turnAction);

    const calledPayload = eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];
    
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

    const calledPayload = eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];
    
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
          tertiary: ['target3']
        }
      },
      commandString: 'cast complex spell',
    };

    await processor.dispatchAction(actor, turnAction);

    const calledPayload = eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];
    
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
        targetIds: 'not-an-object' // This will cause an error in forEach
      },
      commandString: 'test command',
    };

    await processor.dispatchAction(actor, turnAction);

    // Even with error, should still dispatch with valid payload
    expect(eventDispatchService.dispatchWithErrorHandling).toHaveBeenCalled();
    
    const calledPayload = eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];
    
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
          secondary: ['target2']
        }
      },
      commandString: 'test command',
    };

    const startTime = performance.now();
    await processor.dispatchAction(actor, turnAction);
    const duration = performance.now() - startTime;

    // Should complete within reasonable time (allowing for test overhead)
    expect(duration).toBeLessThan(50); // 50ms is generous for tests
    
    // Should not log performance warning for fast execution
    const perfWarningCalls = logger.warn.mock.calls.filter(call => 
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
        targetIds: { primary: ['t1'], secondary: ['t2'] }
      },
      commandString: 'multi',
    };

    // Create enough payloads to trigger metric logging (100)
    for (let i = 0; i < 100; i++) {
      await processor.dispatchAction(actor, multiTargetAction);
    }

    // Check if metrics were logged
    const metricsLogCalls = logger.info.mock.calls.filter(call =>
      call[0] === 'Payload creation metrics update'
    );
    expect(metricsLogCalls).toHaveLength(1);
    
    const stats = processor.getPayloadCreationStatistics();
    expect(stats.totalPayloadsCreated).toBe(100);
    expect(stats.multiTargetPayloads).toBe(100);
    expect(stats.averageCreationTime).toBeGreaterThan(0);
  });
});
