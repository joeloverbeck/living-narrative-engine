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
    processor = new CommandProcessor({ logger, safeEventDispatcher, eventDispatchService });
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
    expect(eventDispatchService.dispatchWithErrorHandling).toHaveBeenCalledTimes(1);
    expect(eventDispatchService.dispatchWithErrorHandling).toHaveBeenCalledWith(
      ATTEMPT_ACTION_ID,
      expect.objectContaining({
        eventName: ATTEMPT_ACTION_ID,
        actorId: 'actor1',
        actionId: 'look',
        targetId: 't1',
        originalInput: 'look north',
      }),
      'ATTEMPT_ACTION_ID dispatch for pre-resolved action look'
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'CommandProcessor.dispatchAction: Successfully dispatched \'look\' for actor actor1.'
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
    expect(eventDispatchService.dispatchWithErrorHandling).toHaveBeenNthCalledWith(
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
    eventDispatchService.dispatchWithErrorHandling.mockImplementationOnce(async () => {
      // Simulate what happens inside dispatchWithErrorHandling when dispatch throws
      await safeDispatchError(
        safeEventDispatcher,
        'System error during event dispatch.',
        {},
        logger
      );
      return false;
    });

    const actor = { id: 'actor4' };
    const turnAction = {
      actionDefinitionId: 'jump',
      commandString: 'jump',
      resolvedParameters: {},
    };

    const result = await processor.dispatchAction(actor, turnAction);

    expect(result.success).toBe(false);
    expect(eventDispatchService.dispatchWithErrorHandling).toHaveBeenNthCalledWith(
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
    processor = new CommandProcessor({ logger, safeEventDispatcher, eventDispatchService });
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

    expect(eventDispatchService.dispatchWithErrorHandling).toHaveBeenCalledTimes(1);
    expect(eventDispatchService.dispatchWithErrorHandling).toHaveBeenCalledWith(
      ATTEMPT_ACTION_ID,
      expect.objectContaining({
        eventName: ATTEMPT_ACTION_ID,
        actorId: 'actorTest',
        actionId: 'testAction',
        targetId: 'target1',
        originalInput: 'testAction target1',
      }),
      'ATTEMPT_ACTION_ID dispatch for pre-resolved action testAction'
    );

    // Specifically check that 'direction' is not in the payload
    const dispatchedPayload = eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];
    expect(dispatchedPayload).not.toHaveProperty('direction');
  });
});
