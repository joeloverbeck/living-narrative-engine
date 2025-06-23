import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import SaveFileRepository from '../../../src/persistence/saveFileRepository.js';
import SaveFileParser from '../../../src/persistence/saveFileParser.js';
import { PersistenceErrorCodes } from '../../../src/persistence/persistenceErrors.js';
import { StorageErrorCodes } from '../../../src/storage/storageErrors.js';
import { createMockLogger } from '../testUtils.js';

/**
 *
 */
function makeDeps() {
  const logger = createMockLogger();
  const storageProvider = {
    writeFileAtomically: jest.fn(),
    listFiles: jest.fn(),
    readFile: jest.fn(),
    deleteFile: jest.fn(),
    fileExists: jest.fn(),
    ensureDirectoryExists: jest.fn(),
  };
  const serializer = {};
  const parser = new SaveFileParser({ logger, storageProvider, serializer });
  const repo = new SaveFileRepository({
    logger,
    storageProvider,
    parser,
  });
  return { repo, logger, storageProvider };
}

describe('SaveFileRepository.deleteSaveFile', () => {
  let repo;
  let logger;
  let storageProvider;

  beforeEach(() => {
    ({ repo, logger, storageProvider } = makeDeps());
  });

  it('returns success when deletion succeeds', async () => {
    storageProvider.fileExists.mockResolvedValue(true);
    storageProvider.deleteFile.mockResolvedValue({ success: true });

    const result = await repo.deleteSaveFile('path.sav');

    expect(result.success).toBe(true);
    expect(storageProvider.fileExists).toHaveBeenCalledWith('path.sav');
    expect(storageProvider.deleteFile).toHaveBeenCalledWith('path.sav');
    expect(logger.debug).toHaveBeenCalled();
  });

  it('returns DELETE_FILE_NOT_FOUND when file is missing', async () => {
    storageProvider.fileExists.mockResolvedValue(false);

    const result = await repo.deleteSaveFile('missing.sav');

    expect(result.success).toBe(false);
    expect(result.error.code).toBe(PersistenceErrorCodes.DELETE_FILE_NOT_FOUND);
    expect(storageProvider.fileExists).toHaveBeenCalledWith('missing.sav');
    expect(storageProvider.deleteFile).not.toHaveBeenCalled();
  });

  it('returns DELETE_FAILED when deleteFile fails', async () => {
    storageProvider.fileExists.mockResolvedValue(true);
    storageProvider.deleteFile.mockResolvedValue({
      success: false,
      error: 'bad',
    });

    const result = await repo.deleteSaveFile('bad.sav');

    expect(result.success).toBe(false);
    expect(result.error.code).toBe(PersistenceErrorCodes.DELETE_FAILED);
    expect(storageProvider.fileExists).toHaveBeenCalledWith('bad.sav');
    expect(logger.error).toHaveBeenCalled();
  });

  it('maps FILE_NOT_FOUND code to DELETE_FILE_NOT_FOUND', async () => {
    storageProvider.fileExists.mockResolvedValue(true);
    storageProvider.deleteFile.mockResolvedValue({
      success: false,
      error: 'missing',
      code: StorageErrorCodes.FILE_NOT_FOUND,
    });

    const result = await repo.deleteSaveFile('missing.sav');

    expect(result.success).toBe(false);
    expect(result.error.code).toBe(PersistenceErrorCodes.DELETE_FILE_NOT_FOUND);
    expect(logger.error).toHaveBeenCalled();
  });

  it('returns UNEXPECTED_ERROR when an exception occurs', async () => {
    storageProvider.fileExists.mockResolvedValue(true);
    storageProvider.deleteFile.mockRejectedValue(new Error('boom'));

    const result = await repo.deleteSaveFile('boom.sav');

    expect(result.success).toBe(false);
    expect(result.error.code).toBe(PersistenceErrorCodes.UNEXPECTED_ERROR);
    expect(storageProvider.fileExists).toHaveBeenCalledWith('boom.sav');
    expect(logger.error).toHaveBeenCalled();
  });
});
