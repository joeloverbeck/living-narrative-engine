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
  let processor;

  beforeEach(() => {
    logger = mkLogger();
    safeEventDispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    processor = new CommandProcessor({ logger, safeEventDispatcher });
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
    expect(safeEventDispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
      ATTEMPT_ACTION_ID,
      expect.objectContaining({
        eventName: ATTEMPT_ACTION_ID,
        actorId: 'actor1',
        actionId: 'look',
        targetId: 't1',
        originalInput: 'look north',
      })
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'dispatchWithErrorHandling: Dispatch successful for ATTEMPT_ACTION_ID dispatch for pre-resolved action look.'
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
    expect(result.actionResult).toBeUndefined();
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

  it('AC3: returns failure when dispatcher reports failure', async () => {
    safeEventDispatcher.dispatch.mockResolvedValueOnce(false);

    const actor = { id: 'actor3' };
    const turnAction = {
      actionDefinitionId: 'take',
      commandString: 'take',
      resolvedParameters: {},
    };

    const result = await processor.dispatchAction(actor, turnAction);

    expect(result.success).toBe(false);
    expect(safeEventDispatcher.dispatch).toHaveBeenNthCalledWith(
      1,
      ATTEMPT_ACTION_ID,
      expect.any(Object)
    );
    expect(safeDispatchError).toHaveBeenCalledWith(
      safeEventDispatcher,
      'Internal error: Failed to initiate action.',
      expect.any(Object),
      logger
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'dispatchWithErrorHandling: SafeEventDispatcher reported failure for ATTEMPT_ACTION_ID dispatch for pre-resolved action take'
      )
    );
  });

  it('constructs expected failure result when dispatcher reports failure', async () => {
    safeEventDispatcher.dispatch.mockResolvedValueOnce(false);

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
    safeEventDispatcher.dispatch.mockRejectedValueOnce(new Error('boom'));
    safeEventDispatcher.dispatch.mockResolvedValue(true);

    const actor = { id: 'actor4' };
    const turnAction = {
      actionDefinitionId: 'jump',
      commandString: 'jump',
      resolvedParameters: {},
    };

    const result = await processor.dispatchAction(actor, turnAction);

    expect(result.success).toBe(false);
    expect(safeEventDispatcher.dispatch).toHaveBeenNthCalledWith(
      1,
      ATTEMPT_ACTION_ID,
      expect.any(Object)
    );
    expect(safeDispatchError).toHaveBeenCalledWith(
      safeEventDispatcher,
      'System error during event dispatch.',
      expect.any(Object),
      logger
    );
    expect(safeDispatchError).toHaveBeenCalledWith(
      safeEventDispatcher,
      'Internal error: Failed to initiate action.',
      expect.any(Object),
      logger
    );
    expect(logger.error).toHaveBeenCalledWith(
      'dispatchWithErrorHandling: CRITICAL - Error during dispatch for ATTEMPT_ACTION_ID dispatch for pre-resolved action jump. Error: boom',
      expect.any(Error)
    );
  });
});

describe('CommandProcessor.dispatchAction payload specifics', () => {
  let logger;
  let safeEventDispatcher;
  let processor;

  beforeEach(() => {
    logger = mkLogger();
    safeEventDispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    processor = new CommandProcessor({ logger, safeEventDispatcher });
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

    expect(safeEventDispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
      ATTEMPT_ACTION_ID,
      expect.objectContaining({
        eventName: ATTEMPT_ACTION_ID,
        actorId: 'actorTest',
        actionId: 'testAction',
        targetId: 'target1',
        originalInput: 'testAction target1',
      })
    );

    // Specifically check that 'direction' is not in the payload
    const dispatchedPayload = safeEventDispatcher.dispatch.mock.calls[0][1];
    expect(dispatchedPayload).not.toHaveProperty('direction');
  });
});
