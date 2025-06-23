import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import SaveFileParser from '../../../src/persistence/saveFileParser.js';
import {
  manualSavePath,
  getManualSavePath,
} from '../../../src/utils/savePathUtils.js';
import { createMockLogger } from '../testUtils.js';
import * as readUtils from '../../../src/utils/saveFileReadUtils.js';

jest.mock('../../../src/utils/saveFileReadUtils.js');

/**
 *
 */
function makeParser() {
  const logger = createMockLogger();
  const storageProvider = { readFile: jest.fn() };
  const serializer = {};
  const parser = new SaveFileParser({ logger, storageProvider, serializer });
  return { parser, logger, storageProvider, serializer };
}

describe('SaveFileParser', () => {
  let parser;
  let logger;
  let storageProvider;
  let serializer;

  beforeEach(() => {
    ({ parser, logger, storageProvider, serializer } = makeParser());
    readUtils.readAndDeserialize.mockReset();
    logger.debug.mockReset();
    logger.error.mockReset();
    logger.warn.mockReset();
  });

  describe('readParsedSaveObject', () => {
    it('delegates to readAndDeserialize', async () => {
      readUtils.readAndDeserialize.mockResolvedValue({
        success: true,
        data: {},
      });

      const result = await parser.readParsedSaveObject('path.sav');

      expect(readUtils.readAndDeserialize).toHaveBeenCalledWith(
        storageProvider,
        serializer,
        expect.any(Object),
        'path.sav'
      );
      expect(result).toEqual({ success: true, data: {} });
    });
  });

  describe('parseManualSaveFile', () => {
    it('returns parsed metadata on success', async () => {
      const metadata = {
        identifier: manualSavePath('manual_save_Name.sav'),
        saveName: 'Name',
        timestamp: 'now',
        playtimeSeconds: 1,
      };
      readUtils.readAndDeserialize.mockResolvedValue({
        success: true,
        data: { metadata },
      });

      const result = await parser.parseManualSaveFile('manual_save_Name.sav');

      expect(readUtils.readAndDeserialize).toHaveBeenCalledWith(
        storageProvider,
        serializer,
        expect.any(Object),
        getManualSavePath('Name')
      );
      expect(result).toEqual({ metadata, isCorrupted: false });
      expect(logger.debug).toHaveBeenCalled();
    });

    it('marks invalid file names as corrupted', async () => {
      const result = await parser.parseManualSaveFile('');

      expect(result).toEqual({
        metadata: {
          identifier: manualSavePath(''),
          saveName: ' (Invalid Name)',
          timestamp: 'N/A',
          playtimeSeconds: 0,
        },
        isCorrupted: true,
      });
      expect(logger.error).toHaveBeenCalled();
      expect(readUtils.readAndDeserialize).not.toHaveBeenCalled();
    });

    it('flags corrupted files when deserialization fails', async () => {
      readUtils.readAndDeserialize.mockResolvedValue({
        success: false,
        error: 'bad',
      });

      const result = await parser.parseManualSaveFile('manual_save_Bad.sav');

      expect(result).toEqual({
        metadata: {
          identifier: manualSavePath('manual_save_Bad.sav'),
          saveName: 'Bad (Corrupted)',
          timestamp: 'N/A',
          playtimeSeconds: 0,
        },
        isCorrupted: true,
      });
      expect(logger.warn).toHaveBeenCalled();
    });

    it('flags missing metadata section', async () => {
      readUtils.readAndDeserialize.mockResolvedValue({
        success: true,
        data: {},
      });

      const result = await parser.parseManualSaveFile('manual_save_NoMeta.sav');

      expect(result).toEqual({
        metadata: {
          identifier: manualSavePath('manual_save_NoMeta.sav'),
          saveName: 'NoMeta (No Metadata)',
          timestamp: 'N/A',
          playtimeSeconds: 0,
        },
        isCorrupted: true,
      });
      expect(logger.warn).toHaveBeenCalled();
    });
  });
});
