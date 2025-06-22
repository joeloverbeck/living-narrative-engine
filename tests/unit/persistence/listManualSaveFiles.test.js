import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import SaveFileRepository from '../../../src/persistence/saveFileRepository.js';
import SaveFileParser from '../../../src/persistence/saveFileParser.js';
import { createMockLogger } from '../testUtils.js';
import { FULL_MANUAL_SAVE_DIRECTORY_PATH } from '../../../src/utils/savePathUtils.js';

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
    serializer,
    parser,
  });
  return { repo, logger, storageProvider };
}

describe('SaveFileRepository.listManualSaveFiles', () => {
  let repo;
  let storageProvider;

  beforeEach(() => {
    ({ repo, storageProvider } = makeDeps());
  });

  it('filters filenames using manual save pattern', async () => {
    const allFiles = [
      'manual_save_one.sav',
      'manual_save_two.sav',
      'notes.txt',
      'manual_save_three.tmp',
    ];
    storageProvider.listFiles.mockImplementation(async (_dir, pattern) => {
      const regex = new RegExp(pattern);
      return allFiles.filter((f) => regex.test(f));
    });

    const result = await repo.listManualSaveFiles();

    expect(result.success).toBe(true);
    expect(result.data).toEqual(['manual_save_one.sav', 'manual_save_two.sav']);
    expect(storageProvider.listFiles).toHaveBeenCalledWith(
      FULL_MANUAL_SAVE_DIRECTORY_PATH,
      expect.anything()
    );
  });
});
