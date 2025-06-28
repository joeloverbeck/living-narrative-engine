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

    expect(result).toEqual({ success: true, commandResult: null });
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
  });

  it('AC2: returns failure and dispatches system error when actionDefinitionId is missing', async () => {
    const actor = { id: 'actor2' };
    const turnAction = { resolvedParameters: {}, commandString: 'noop' };

    const result = await processor.dispatchAction(actor, turnAction);

    expect(result.success).toBe(false);
    expect(result.commandResult).toEqual(
      expect.objectContaining({
        success: false,
        turnEnded: true,
        error: 'Internal error: Malformed action prevented execution.',
        internalError: expect.stringContaining('missing actionDefinitionId'),
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
