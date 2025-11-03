import { describe, it, expect, jest } from '@jest/globals';
import {
  executePersistenceOp,
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

  it('handles non-Error rejections', async () => {
    const logger = { error: jest.fn() };
    const res = await wrapPersistenceOperation(logger, async () => {
      throw 'string err';
    });
    expect(logger.error).toHaveBeenCalled();
    expect(res.success).toBe(false);
    expect(res.error.code).toBe(PersistenceErrorCodes.UNEXPECTED_ERROR);
    expect(res.error.message).toBe('string err');
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

describe('executePersistenceOp', () => {
  it('throws when no operation is provided', () => {
    const logger = { error: jest.fn(), debug: jest.fn() };

    expect(() => executePersistenceOp({ logger })).toThrow(
      'executePersistenceOp: No operation provided.'
    );
  });

  it('returns raw result when async operation succeeds', async () => {
    const logger = { error: jest.fn(), debug: jest.fn() };
    const result = await executePersistenceOp({
      asyncOperation: async () => 'async-ok',
      logger,
      context: 'AsyncOp',
    });

    expect(result).toBe('async-ok');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('wraps sync operation success using persistence success helper', () => {
    const logger = { error: jest.fn(), debug: jest.fn() };
    const result = executePersistenceOp({
      syncOperation: () => 'sync-ok',
      logger,
      context: 'SyncOp',
    });

    expect(result).toEqual({ success: true, data: 'sync-ok' });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('attaches user-friendly message when async operation fails', async () => {
    const logger = { error: jest.fn(), debug: jest.fn() };
    const result = await executePersistenceOp({
      asyncOperation: async () => {
        throw new Error('nope');
      },
      logger,
      errorCode: PersistenceErrorCodes.FILE_READ_ERROR,
      userMessage: 'Unable to read save file',
      context: 'TestOp',
    });

    expect(result.success).toBe(false);
    expect(result.error.code).toBe(PersistenceErrorCodes.FILE_READ_ERROR);
    expect(result.userFriendlyError).toBe('Unable to read save file');
  });

  it('converts thrown values to strings when user message is missing (async)', async () => {
    const thrown = { message: 'structured failure' };
    const logger = { error: jest.fn(), debug: jest.fn() };
    const result = await executePersistenceOp({
      asyncOperation: async () => {
        throw thrown.message;
      },
      logger,
      context: 'AsyncString',
      errorCode: PersistenceErrorCodes.WRITE_ERROR,
    });

    expect(logger.error).toHaveBeenCalledWith('AsyncString', thrown.message);
    expect(result).toMatchObject({
      success: false,
      error: {
        code: PersistenceErrorCodes.WRITE_ERROR,
        message: thrown.message,
      },
      userFriendlyError: undefined,
    });
  });

  it('converts thrown values to strings when user message is missing (sync)', () => {
    const logger = { error: jest.fn(), debug: jest.fn() };
    const result = executePersistenceOp({
      syncOperation: () => {
        throw 404;
      },
      logger,
      context: 'SyncNumber',
      errorCode: PersistenceErrorCodes.DELETE_FAILED,
    });

    expect(logger.error).toHaveBeenCalledWith('SyncNumber', 404);
    expect(result).toMatchObject({
      success: false,
      error: {
        code: PersistenceErrorCodes.DELETE_FAILED,
        message: '404',
      },
      userFriendlyError: undefined,
    });
  });
});
