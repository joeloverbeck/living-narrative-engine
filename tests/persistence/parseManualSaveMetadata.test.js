import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import SaveFileRepository from '../../src/persistence/saveFileRepository.js';
import { manualSavePath } from '../../src/utils/savePathUtils.js';
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
    logger.debug.mockReset();
  });

  it('returns parsed metadata and logs', async () => {
    const metadata = {
      identifier: manualSavePath('manual_save_Name.sav'),
      saveName: 'Name',
      timestamp: 'now',
      playtimeSeconds: 42,
    };

    storageProvider.readFile.mockResolvedValue(new Uint8Array([1]));
    serializer.decompress = jest
      .fn()
      .mockReturnValue({ success: true, data: new Uint8Array([2]) });
    serializer.deserialize = jest
      .fn()
      .mockReturnValue({ success: true, data: { metadata } });

    const result = await repo.parseManualSaveMetadata('manual_save_Name.sav');

    expect(result).toEqual({ metadata, isCorrupted: false });
    expect(storageProvider.readFile).toHaveBeenCalledWith(
      manualSavePath('manual_save_Name.sav')
    );
    expect(logger.debug).toHaveBeenCalled();
  });
});
