import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import CommandProcessor from '../../../src/commands/commandProcessor.js';
import { ATTEMPT_ACTION_ID } from '../../../src/constants/eventIds.js';

const mkLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('CommandProcessor.dispatchAction basic flows', () => {
  let logger;
  let dispatcher;
  let processor;

  beforeEach(() => {
    logger = mkLogger();
    dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    processor = new CommandProcessor({
      logger,
      safeEventDispatcher: dispatcher,
    });
    jest.clearAllMocks();
  });

  it('returns success when dispatcher resolves true', async () => {
    const actor = { id: 'a1' };
    const action = {
      actionDefinitionId: 'look',
      commandString: 'look around',
      resolvedParameters: { targetId: 'room1' },
    };

    const result = await processor.dispatchAction(actor, action);

    expect(result).toEqual({
      success: true,
      turnEnded: false,
      originalInput: 'look around',
      actionResult: { actionId: 'look' },
    });
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      ATTEMPT_ACTION_ID,
      expect.objectContaining({
        actorId: 'a1',
        actionId: 'look',
      })
    );
  });

  it('returns failure when inputs are invalid', async () => {
    const result = await processor.dispatchAction(
      {},
      { actionDefinitionId: 'id' }
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      'Internal error: Malformed action prevented execution.'
    );
    expect(dispatcher.dispatch).toHaveBeenCalled();
  });

  it('returns failure when dispatcher reports failure', async () => {
    dispatcher.dispatch.mockResolvedValueOnce(false);

    const actor = { id: 'p1' };
    const action = { actionDefinitionId: 'jump', commandString: 'jump' };

    const result = await processor.dispatchAction(actor, action);

    expect(result.success).toBe(false);
    expect(result.internalError).toMatch('Dispatcher reported failure');
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      ATTEMPT_ACTION_ID,
      expect.any(Object)
    );
  });
});
