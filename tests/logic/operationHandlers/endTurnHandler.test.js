/**
 * @jest-environment node
 */
import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import EndTurnHandler from '../../../src/logic/operationHandlers/endTurnHandler.js';
import { TURN_ENDED_ID } from '../../../src/constants/eventIds.js';

const makeLogger = () => ({
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
});

const makeDispatcher = () => ({ dispatch: jest.fn() });

describe('EndTurnHandler', () => {
  let logger;
  let dispatcher;
  let handler;

  beforeEach(() => {
    logger = makeLogger();
    dispatcher = makeDispatcher();
    handler = new EndTurnHandler({ dispatcher, logger });
  });

  test('constructor throws with invalid dependencies', () => {
    expect(() => new EndTurnHandler({ logger })).toThrow();
    expect(() => new EndTurnHandler({ dispatcher })).toThrow();
  });

  test('execute dispatches core:turn_ended with provided payload', () => {
    const params = { entityId: 'e1', success: true };
    handler.execute(params, {});
    expect(dispatcher.dispatch).toHaveBeenCalledWith(TURN_ENDED_ID, params);
  });

  test('execute includes optional error field when provided', () => {
    const params = { entityId: 'e2', success: false, error: { msg: 'oops' } };
    handler.execute(params, {});
    expect(dispatcher.dispatch).toHaveBeenCalledWith(TURN_ENDED_ID, params);
  });

  test('execute logs error and does not dispatch when entityId is invalid', () => {
    handler.execute({ entityId: '   ', success: true }, {});
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      'END_TURN: Invalid or missing "entityId" parameter.'
    );
  });
});
