import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import * as saveStateUtils from '../../../src/utils/saveStateUtils.js';
import { PersistenceErrorCodes } from '../../../src/persistence/persistenceErrors.js';
import * as cloneUtils from '../../../src/utils/cloneUtils.js';

jest.mock('../../../src/utils/cloneUtils.js', () => ({
  safeDeepClone: jest.fn(),
}));

const { cloneValidatedState, cloneAndValidateSaveState } = saveStateUtils;

describe('saveStateUtils', () => {
  let logger;

  beforeEach(() => {
    logger = { error: jest.fn() };
    jest.clearAllMocks();
  });

  it('returns success when clone is valid with gameState', () => {
    const obj = { gameState: { foo: 'bar' } };
    cloneUtils.safeDeepClone.mockReturnValue({ success: true, data: obj });

    const result = cloneValidatedState(obj, logger);

    expect(cloneUtils.safeDeepClone).toHaveBeenCalledWith(obj, logger);
    expect(result).toEqual({ success: true, data: obj });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('propagates failure from safeDeepClone', () => {
    const obj = { any: 'value' };
    const err = { code: 'ERR', message: 'bad' };
    cloneUtils.safeDeepClone.mockReturnValue({ success: false, error: err });

    const result = cloneValidatedState(obj, logger);

    expect(result.success).toBe(false);
    expect(result.error.code).toBe('ERR');
    expect(result.error.message).toBe('bad');
  });

  it('fails when cloned object lacks gameState', () => {
    const obj = { notGameState: true };
    cloneUtils.safeDeepClone.mockReturnValue({ success: true, data: obj });

    const result = cloneValidatedState(obj, logger);

    expect(logger.error).toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error.code).toBe(PersistenceErrorCodes.INVALID_GAME_STATE);
  });

  it('cloneAndValidateSaveState returns same result as cloneValidatedState', () => {
    const obj = { gameState: {} };
    cloneUtils.safeDeepClone.mockReturnValue({ success: true, data: obj });

    const viaWrapper = cloneAndValidateSaveState(obj, logger);

    expect(viaWrapper).toEqual({ success: true, data: obj });
    expect(cloneUtils.safeDeepClone).toHaveBeenCalledWith(obj, logger);
  });
});
