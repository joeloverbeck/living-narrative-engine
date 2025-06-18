import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import SaveFileRepository from '../../src/persistence/saveFileRepository.js';
import { parseManualSaveFile } from '../../src/persistence/saveFileIO.js';
import { createMockLogger } from '../testUtils.js';

jest.mock('../../src/persistence/saveFileIO.js', () => ({
  parseManualSaveFile: jest.fn(),
}));

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
  const repo = new SaveFileRepository({ logger, storageProvider, serializer });
  return { repo, logger, storageProvider, serializer };
}

describe('SaveFileRepository.parseManualSaveMetadata', () => {
  let repo;
  let logger;
  let storageProvider;
  let serializer;

  beforeEach(() => {
    ({ repo, logger, storageProvider, serializer } = makeDeps());
    parseManualSaveFile.mockReset();
    logger.debug.mockReset();
  });

  it('returns metadata from parseManualSaveFile unchanged and logs once', async () => {
    const metadata = {
      identifier: 'path',
      saveName: 'Name',
      timestamp: 'now',
      playtimeSeconds: 42,
    };
    parseManualSaveFile.mockResolvedValue({ success: true, data: metadata });

    const result = await repo.parseManualSaveMetadata('manual_save_Name.sav');

    expect(result).toBe(metadata);
    expect(parseManualSaveFile).toHaveBeenCalledWith(
      'manual_save_Name.sav',
      storageProvider,
      serializer,
      expect.any(Object)
    );
    expect(logger.debug).toHaveBeenCalledTimes(1);
  });
});
