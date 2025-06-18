import { describe, it, expect, jest } from '@jest/globals';
import { wrapPersistenceOperation } from '../../src/utils/persistenceErrorUtils.js';
import { PersistenceErrorCodes } from '../../src/persistence/persistenceErrors.js';

describe('wrapPersistenceOperation', () => {
  it('returns operation result on success', async () => {
    const logger = { error: jest.fn() };
    const result = await wrapPersistenceOperation(logger, async () => 42);
    expect(result).toBe(42);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs and wraps errors', async () => {
    const logger = { error: jest.fn() };
    const res = await wrapPersistenceOperation(logger, async () => {
      throw new Error('boom');
    });
    expect(logger.error).toHaveBeenCalled();
    expect(res.success).toBe(false);
    expect(res.error.code).toBe(PersistenceErrorCodes.UNEXPECTED_ERROR);
    expect(res.error.message).toBe('boom');
  });
});
