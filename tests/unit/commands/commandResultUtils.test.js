import { describe, it, expect, jest } from '@jest/globals';
import {
  createFailureResult,
  dispatchFailure,
} from '../../../src/commands/helpers/commandResultUtils.js';
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

describe('createFailureResult', () => {
  it('builds a failure result with all fields', () => {
    const result = createFailureResult(
      'user',
      'internal',
      'cmd',
      'jump',
      false
    );
    expect(result).toEqual({
      success: false,
      turnEnded: false,
      internalError: 'internal',
      originalInput: 'cmd',
      actionResult: { actionId: 'jump' },
      error: 'user',
    });
  });

  it('omits user error and defaults turnEnded to true', () => {
    const result = createFailureResult(undefined, 'int', 'go', 'move');
    expect(result.success).toBe(false);
    expect(result.turnEnded).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.actionResult).toEqual({ actionId: 'move' });
  });
});

describe('dispatchFailure', () => {
  it('logs and dispatches a system error', () => {
    const logger = mkLogger();
    const dispatcher = { dispatch: jest.fn() };
    dispatchFailure(logger, dispatcher, 'user msg', 'boom');
    expect(logger.error).toHaveBeenCalledWith('boom');
    expect(safeDispatchError).toHaveBeenCalledWith(
      dispatcher,
      'user msg',
      expect.objectContaining({ raw: 'boom' }),
      logger
    );
  });
});
