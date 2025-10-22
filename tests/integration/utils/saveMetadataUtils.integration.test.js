import { describe, expect, it, jest } from '@jest/globals';

import { validateSaveMetadataFields } from '../../../src/utils/saveMetadataUtils.js';
import {
  buildManualFileName,
  extractSaveName,
} from '../../../src/utils/savePathUtils.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('validateSaveMetadataFields integration', () => {
  it('marks incomplete metadata as corrupted and derives a fallback name from the manual save path', () => {
    const logger = createLogger();
    const fileName = buildManualFileName('Layla & Co? Save 01');
    const metadata = {
      identifier: 'manual-save/2025-03-18T10:00:00.000Z',
      saveName: '',
      timestamp: '',
      playtimeSeconds: undefined,
    };

    const result = validateSaveMetadataFields(metadata, fileName, logger);

    expect(result.identifier).toBe(metadata.identifier);
    expect(result.saveName).toBe(`${extractSaveName(fileName)} (Bad Metadata)`);
    expect(result.timestamp).toBe('N/A');
    expect(result.isCorrupted).toBe(true);
    expect(result.playtimeSeconds).toBe(0);

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0][0]).toContain('Essential metadata missing or malformed');
    expect(logger.warn.mock.calls[0][0]).toContain(metadata.identifier);
  });

  it('retains provided timing data while flagging metadata that only lacks the save name', () => {
    const logger = createLogger();
    const fileName = buildManualFileName('Evening Session');
    const metadata = {
      identifier: 'manual-save/2025-03-19T18:45:00.000Z',
      saveName: null,
      timestamp: '2025-03-19T18:45:00.000Z',
      playtimeSeconds: 3720,
    };

    const result = validateSaveMetadataFields(metadata, fileName, logger);

    expect(result).toEqual({
      identifier: metadata.identifier,
      saveName: `${extractSaveName(fileName)} (Bad Metadata)`,
      timestamp: metadata.timestamp,
      playtimeSeconds: metadata.playtimeSeconds,
      isCorrupted: true,
    });
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('returns the original metadata object untouched when all required fields are valid', () => {
    const logger = createLogger();
    const metadata = {
      identifier: 'manual-save/2025-03-20T12:00:00.000Z',
      saveName: 'Afternoon Patrol',
      timestamp: '2025-03-20T12:00:00.000Z',
      playtimeSeconds: 5400,
    };

    const result = validateSaveMetadataFields(metadata, buildManualFileName('Afternoon Patrol'), logger);

    expect(result).toBe(metadata);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
