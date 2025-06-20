import { describe, it, expect, jest } from '@jest/globals';
import {
  wrapPersistenceOperation,
  wrapSyncPersistenceOperation,
} from '../../../src/utils/persistenceErrorUtils.js';
import { PersistenceErrorCodes } from '../../../src/persistence/persistenceErrors.js';

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

describe('wrapSyncPersistenceOperation', () => {
  it('returns operation result on success', () => {
    const logger = { error: jest.fn() };
    const res = wrapSyncPersistenceOperation(
      logger,
      () => 7,
      'CODE',
      'msg',
      'ctx'
    );
    expect(res.success).toBe(true);
    expect(res.data).toBe(7);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs and wraps errors', () => {
    const logger = { error: jest.fn() };
    const result = wrapSyncPersistenceOperation(
      logger,
      () => {
        throw new Error('oops');
      },
      'ERR',
      'Nice',
      'context'
    );
    expect(logger.error).toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('ERR');
    expect(result.userFriendlyError).toBe('Nice');
  });
});
