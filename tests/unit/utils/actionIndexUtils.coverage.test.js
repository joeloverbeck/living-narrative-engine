import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { assertValidActionIndex } from '../../../src/utils/actionIndexUtils.js';
import { safeDispatchError } from '../../../src/utils/safeDispatchErrorUtils.js';

jest.mock('../../../src/utils/safeDispatchErrorUtils.js', () => ({
  __esModule: true,
  safeDispatchError: jest.fn(),
}));

function createLogger() {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}

describe('assertValidActionIndex', () => {
  let dispatcher;
  let logger;

  beforeEach(() => {
    dispatcher = { dispatch: jest.fn() };
    logger = createLogger();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('dispatches and throws when chosen index is not an integer', async () => {
    await expect(
      assertValidActionIndex(1.2, 4, 'provider', 'actor-1', dispatcher, logger)
    ).rejects.toThrow('Could not resolve the chosen action to a valid index.');

    expect(safeDispatchError).toHaveBeenCalledTimes(1);
    expect(safeDispatchError).toHaveBeenCalledWith(
      dispatcher,
      "provider: Did not receive a valid integer 'chosenIndex' for actor actor-1.",
      {},
      logger
    );
  });

  it('dispatches with merged debug data when index is outside bounds', async () => {
    const debugData = { reason: 'too-high' };

    await expect(
      assertValidActionIndex(5, 3, 'provider', 'actor-2', dispatcher, logger, debugData)
    ).rejects.toThrow('Player chose an index that does not exist for this turn.');

    expect(safeDispatchError).toHaveBeenCalledTimes(1);
    const [, , details] = safeDispatchError.mock.calls[0];
    expect(details).toEqual({ reason: 'too-high', actionsCount: 3 });
    expect(details).not.toBe(debugData);
    expect(debugData).toEqual({ reason: 'too-high' });
  });

  it('returns silently when the index is valid', async () => {
    await expect(
      assertValidActionIndex(2, 5, 'provider', 'actor-3', dispatcher, logger)
    ).resolves.not.toThrow();

    expect(safeDispatchError).not.toHaveBeenCalled();
  });
});
