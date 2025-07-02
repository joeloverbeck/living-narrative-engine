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
  let eventDispatchService;
  let processor;

  beforeEach(() => {
    logger = mkLogger();
    dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    eventDispatchService = {
      dispatchWithErrorHandling: jest.fn().mockResolvedValue(true),
      dispatchWithLogging: jest.fn().mockResolvedValue(undefined),
      safeDispatchEvent: jest.fn().mockResolvedValue(undefined),
    };
    processor = new CommandProcessor({
      logger,
      safeEventDispatcher: dispatcher,
      eventDispatchService,
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
    expect(eventDispatchService.dispatchWithErrorHandling).toHaveBeenCalledWith(
      ATTEMPT_ACTION_ID,
      expect.objectContaining({
        actorId: 'a1',
        actionId: 'look',
      }),
      'ATTEMPT_ACTION_ID dispatch for pre-resolved action look'
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
    // When inputs are invalid, safeDispatchError is called to dispatch the error
  });

  it('returns failure when dispatcher reports failure', async () => {
    eventDispatchService.dispatchWithErrorHandling.mockResolvedValueOnce(false);

    const actor = { id: 'p1' };
    const action = { actionDefinitionId: 'jump', commandString: 'jump' };

    const result = await processor.dispatchAction(actor, action);

    expect(result.success).toBe(false);
    expect(result.internalError).toMatch('Dispatcher reported failure');
    expect(eventDispatchService.dispatchWithErrorHandling).toHaveBeenCalledWith(
      ATTEMPT_ACTION_ID,
      expect.any(Object),
      'ATTEMPT_ACTION_ID dispatch for pre-resolved action jump'
    );
  });
});
