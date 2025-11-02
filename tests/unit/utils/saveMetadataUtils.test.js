import {
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import { validateSaveMetadataFields } from '../../../src/utils/saveMetadataUtils.js';
import { extractSaveName } from '../../../src/utils/savePathUtils.js';

jest.mock('../../../src/utils/savePathUtils.js', () => ({
  extractSaveName: jest.fn(),
}));

describe('validateSaveMetadataFields', () => {
  const logger = { warn: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    logger.warn.mockClear();
  });

  test('returns original metadata when all fields are valid', () => {
    const metadata = {
      identifier: 'save-1',
      saveName: 'Manual Save 1',
      timestamp: '2024-01-01T00:00:00Z',
      playtimeSeconds: 120,
    };

    const result = validateSaveMetadataFields(
      metadata,
      'manual_save_save-1.sav',
      logger
    );

    expect(result).toBe(metadata);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(extractSaveName).not.toHaveBeenCalled();
  });

  test('marks metadata corrupted when required text fields are missing', () => {
    extractSaveName.mockReturnValue('Recovered Save');
    const metadata = {
      identifier: 'save-2',
      saveName: '',
      timestamp: '',
      playtimeSeconds: 45,
    };

    const result = validateSaveMetadataFields(
      metadata,
      'manual_save_save-2.sav',
      logger
    );

    expect(extractSaveName).toHaveBeenCalledWith('manual_save_save-2.sav');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "Essential metadata missing or malformed in save-2"
      )
    );
    expect(logger.warn.mock.calls[0][0]).toContain('"playtimeSeconds":45');
    expect(result).toEqual({
      identifier: 'save-2',
      saveName: 'Recovered Save (Bad Metadata)',
      timestamp: 'N/A',
      playtimeSeconds: 45,
      isCorrupted: true,
    });
  });

  test('applies safe defaults when numeric metadata is not a number', () => {
    extractSaveName.mockReturnValue('Fallback Save');
    const metadata = {
      identifier: 'save-3',
      saveName: undefined,
      timestamp: '2024-02-02T00:00:00Z',
      playtimeSeconds: 'invalid',
    };

    const result = validateSaveMetadataFields(
      metadata,
      'manual_save_save-3.sav',
      logger
    );

    expect(extractSaveName).toHaveBeenCalledWith('manual_save_save-3.sav');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('save-3')
    );
    expect(result).toEqual({
      identifier: 'save-3',
      saveName: 'Fallback Save (Bad Metadata)',
      timestamp: '2024-02-02T00:00:00Z',
      playtimeSeconds: 0,
      isCorrupted: true,
    });
  });

  test('normalizes playtimeSeconds when metadata provides NaN', () => {
    extractSaveName.mockReturnValue('Mystery Save');
    const metadata = {
      identifier: 'save-4',
      saveName: 'Unknown Duration',
      timestamp: '2024-03-03T00:00:00Z',
      playtimeSeconds: Number.NaN,
    };

    const result = validateSaveMetadataFields(
      metadata,
      'manual_save_save-4.sav',
      logger
    );

    expect(extractSaveName).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('save-4')
    );
    expect(result).toEqual({
      identifier: 'save-4',
      saveName: 'Unknown Duration',
      timestamp: '2024-03-03T00:00:00Z',
      playtimeSeconds: 0,
      isCorrupted: true,
    });
  });

  test('flags infinite playtime as corrupted metadata', () => {
    const metadata = {
      identifier: 'save-5',
      saveName: 'Endless Adventure',
      timestamp: '2024-04-04T00:00:00Z',
      playtimeSeconds: Number.POSITIVE_INFINITY,
    };

    const result = validateSaveMetadataFields(
      metadata,
      'manual_save_save-5.sav',
      logger
    );

    expect(extractSaveName).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('save-5')
    );
    expect(result).toEqual({
      identifier: 'save-5',
      saveName: 'Endless Adventure',
      timestamp: '2024-04-04T00:00:00Z',
      playtimeSeconds: 0,
      isCorrupted: true,
    });
  });

  test('normalizes negative playtime values and flags metadata as corrupted', () => {
    const metadata = {
      identifier: 'save-6',
      saveName: 'Broken Clock',
      timestamp: '2024-05-05T00:00:00Z',
      playtimeSeconds: -120,
    };

    const result = validateSaveMetadataFields(
      metadata,
      'manual_save_save-6.sav',
      logger
    );

    expect(extractSaveName).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('save-6')
    );
    expect(result).toEqual({
      identifier: 'save-6',
      saveName: 'Broken Clock',
      timestamp: '2024-05-05T00:00:00Z',
      playtimeSeconds: 0,
      isCorrupted: true,
    });
  });

  test('gracefully handles null metadata objects', () => {
    extractSaveName.mockReturnValue('Null Metadata Save');

    const result = validateSaveMetadataFields(
      null,
      'manual_save_null.sav',
      logger
    );

    expect(extractSaveName).toHaveBeenCalledWith('manual_save_null.sav');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('manual_save_null.sav')
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Contents: null')
    );
    expect(result).toEqual({
      identifier: 'manual_save_null.sav',
      saveName: 'Null Metadata Save (Bad Metadata)',
      timestamp: 'N/A',
      playtimeSeconds: 0,
      isCorrupted: true,
    });
  });

  test('falls back to unknown identifier when both metadata and file name are missing', () => {
    const metadata = {
      identifier: '',
      saveName: '',
      timestamp: '',
      playtimeSeconds: undefined,
    };

    const result = validateSaveMetadataFields(metadata, '   ', logger);

    expect(extractSaveName).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('unknown-manual-save')
    );
    expect(result).toEqual({
      identifier: 'unknown-manual-save',
      saveName: 'Unknown Save (Bad Metadata)',
      timestamp: 'N/A',
      playtimeSeconds: 0,
      isCorrupted: true,
    });
  });

  test('treats non-object metadata as corrupted without throwing', () => {
    extractSaveName.mockReturnValue('Primitive Metadata Save');

    const result = validateSaveMetadataFields(
      'corrupted',
      'manual_save_string.sav',
      logger
    );

    expect(extractSaveName).toHaveBeenCalledWith('manual_save_string.sav');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('manual_save_string.sav')
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Contents: "corrupted"')
    );
    expect(result).toEqual({
      identifier: 'manual_save_string.sav',
      saveName: 'Primitive Metadata Save (Bad Metadata)',
      timestamp: 'N/A',
      playtimeSeconds: 0,
      isCorrupted: true,
    });
  });

  test('handles missing file names for non-object metadata with unknown identifier', () => {
    const result = validateSaveMetadataFields(undefined, undefined, logger);

    expect(extractSaveName).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('unknown-manual-save')
    );
    expect(result).toEqual({
      identifier: 'unknown-manual-save',
      saveName: 'Unknown Save (Bad Metadata)',
      timestamp: 'N/A',
      playtimeSeconds: 0,
      isCorrupted: true,
    });
  });
});
