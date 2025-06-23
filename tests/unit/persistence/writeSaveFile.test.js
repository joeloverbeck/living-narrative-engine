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
  const repo = new SaveFileRepository({ logger, storageProvider, parser });
  return { repo, logger, storageProvider };
}

describe('SaveFileRepository.writeSaveFile', () => {
  let repo;
  let logger;
  let storageProvider;

  beforeEach(() => {
    ({ repo, logger, storageProvider } = makeDeps());
  });

  it('maps disk full error code to WRITE_ERROR', async () => {
    storageProvider.writeFileAtomically.mockResolvedValue({
      success: false,
      error: 'disk full',
      code: StorageErrorCodes.DISK_FULL,
    });

    const res = await repo.writeSaveFile('path.sav', new Uint8Array());

    expect(res.success).toBe(false);
    expect(res.error.code).toBe(PersistenceErrorCodes.WRITE_ERROR);
    expect(res.error.message).toMatch(/Not enough disk space/);
    expect(logger.error).toHaveBeenCalled();
  });

  it('passes path and data to the storage provider on disk full', async () => {
    const data = new Uint8Array([1, 2]);
    storageProvider.writeFileAtomically.mockResolvedValue({
      success: false,
      error: 'disk full',
      code: StorageErrorCodes.DISK_FULL,
    });

    await repo.writeSaveFile('save.sav', data);

    expect(storageProvider.writeFileAtomically).toHaveBeenCalledWith(
      'save.sav',
      data
    );
  });
});
