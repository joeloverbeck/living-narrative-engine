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
});
