import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { readSaveFile } from '../../../src/utils/saveFileReadUtils.js';
import { PersistenceErrorCodes } from '../../../src/persistence/persistenceErrors.js';
import {
  MSG_FILE_READ_ERROR,
  MSG_EMPTY_FILE,
} from '../../../src/persistence/persistenceMessages.js';

/** @typedef {import('../../../src/persistence/persistenceTypes.js').PersistenceResult<any>} PersistenceResult */

describe('readSaveFile', () => {
  let storageProvider;
  let logger;

  beforeEach(() => {
    logger = { error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
    storageProvider = { readFile: jest.fn() };
  });

  it('returns success when file content is present', async () => {
    const buf = new Uint8Array([1, 2, 3]);
    storageProvider.readFile.mockResolvedValue(buf);

    /** @type {PersistenceResult<Uint8Array>} */
    const result = await readSaveFile(storageProvider, logger, 'path.sav');

    expect(result).toEqual({ success: true, data: buf });
  });

  it('includes error.message in PersistenceError when provided', async () => {
    storageProvider.readFile.mockRejectedValue(new Error('boom'));

    /** @type {PersistenceResult<Uint8Array>} */
    const result = await readSaveFile(storageProvider, logger, 'bad.sav');

    expect(result.success).toBe(false);
    expect(result.error.code).toBe(PersistenceErrorCodes.FILE_READ_ERROR);
    expect(result.error.message).toContain('boom');
    expect(result.userFriendlyError).toBe(MSG_FILE_READ_ERROR);
  });

  it('includes error.code in PersistenceError when message absent', async () => {
    storageProvider.readFile.mockRejectedValue({ code: 'ENOENT' });

    /** @type {PersistenceResult<Uint8Array>} */
    const result = await readSaveFile(storageProvider, logger, 'missing.sav');

    expect(result.success).toBe(false);
    expect(result.error.code).toBe(PersistenceErrorCodes.FILE_READ_ERROR);
    expect(result.error.message).toContain('ENOENT');
    expect(result.userFriendlyError).toBe(MSG_FILE_READ_ERROR);
  });

  it('returns EMPTY_FILE error when file is empty', async () => {
    storageProvider.readFile.mockResolvedValue(new Uint8Array());

    /** @type {PersistenceResult<Uint8Array>} */
    const result = await readSaveFile(storageProvider, logger, 'empty.sav');

    expect(result.success).toBe(false);
    expect(result.error.code).toBe(PersistenceErrorCodes.EMPTY_FILE);
    expect(result.error.message).toBe(MSG_EMPTY_FILE);
  });
});
