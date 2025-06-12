import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import CommandProcessor from '../../src/commands/commandProcessor.js';
import {
  ATTEMPT_ACTION_ID,
  SYSTEM_ERROR_OCCURRED_ID,
} from '../../src/constants/eventIds.js';

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

    expect(result).toEqual({ success: true, errorResult: null });
    expect(safeEventDispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
      ATTEMPT_ACTION_ID,
      expect.objectContaining({
        eventName: ATTEMPT_ACTION_ID,
        actorId: 'actor1',
        actionId: 'look',
        targetId: 't1',
        direction: 'north',
        originalInput: 'look north',
      })
    );
  });

  it('AC2: returns failure and dispatches system error when actionDefinitionId is missing', async () => {
    const actor = { id: 'actor2' };
    const turnAction = { resolvedParameters: {}, commandString: 'noop' };

    const result = await processor.dispatchAction(actor, turnAction);

    expect(result.success).toBe(false);
    expect(result.errorResult).toEqual(
      expect.objectContaining({
        success: false,
        turnEnded: true,
        error: 'Internal error: Malformed action prevented execution.',
        internalError: expect.stringContaining('missing actionDefinitionId'),
      })
    );
    expect(safeEventDispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: 'Internal error: Malformed action prevented execution.',
      })
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
    expect(safeEventDispatcher.dispatch).toHaveBeenNthCalledWith(
      2,
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: 'Internal error: Failed to initiate action.',
      })
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
    expect(safeEventDispatcher.dispatch).toHaveBeenNthCalledWith(
      2,
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: 'System error during event dispatch.',
      })
    );
    expect(safeEventDispatcher.dispatch).toHaveBeenNthCalledWith(
      3,
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: 'Internal error: Failed to initiate action.',
      })
    );
  });
});
