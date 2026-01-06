import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { EmotionDisplayConfigLoader } from '../../../src/configuration/emotionDisplayConfigLoader.js';
import { fetchWithRetry } from '../../../src/utils/index.js';

jest.mock('../../../src/utils/index.js', () => ({
  fetchWithRetry: jest.fn(),
}));

const mockLogger = () => ({
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
});

describe('EmotionDisplayConfigLoader', () => {
  /** @type {EmotionDisplayConfigLoader} */
  let loader;
  /** @type {ReturnType<typeof mockLogger>} */
  let logger;
  let dispatcherMock;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = mockLogger();
    dispatcherMock = { dispatch: jest.fn().mockResolvedValue(true) };
  });

  describe('constructor', () => {
    it('throws when safeEventDispatcher is missing', () => {
      expect(
        () =>
          new EmotionDisplayConfigLoader({
            logger,
          })
      ).toThrow(
        'EmotionDisplayConfigLoader requires a valid ISafeEventDispatcher'
      );
    });

    it('creates loader with required dependencies', () => {
      loader = new EmotionDisplayConfigLoader({
        logger,
        safeEventDispatcher: dispatcherMock,
      });

      expect(loader).toBeDefined();
    });
  });

  describe('loadConfig', () => {
    beforeEach(() => {
      loader = new EmotionDisplayConfigLoader({
        logger,
        safeEventDispatcher: dispatcherMock,
      });
    });

    it('returns parsed values for valid config', async () => {
      const mockConfig = {
        maxEmotionalStates: 8,
        maxSexualStates: 6,
      };

      fetchWithRetry.mockResolvedValueOnce(mockConfig);

      const result = await loader.loadConfig();

      expect(result).toEqual(mockConfig);
      expect(fetchWithRetry).toHaveBeenCalledWith(
        'config/emotion-display-config.json',
        { method: 'GET', headers: { Accept: 'application/json' } },
        2,
        300,
        1000,
        dispatcherMock,
        logger
      );
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('logs warning and returns defaults when file is missing', async () => {
      fetchWithRetry.mockRejectedValueOnce(new Error('Not found'));

      const result = await loader.loadConfig();

      expect(result).toEqual({
        maxEmotionalStates: 7,
        maxSexualStates: 5,
      });
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load configuration')
      );
    });

    it('logs warning and returns defaults for malformed config', async () => {
      fetchWithRetry.mockResolvedValueOnce('not-an-object');

      const result = await loader.loadConfig();

      expect(result).toEqual({
        maxEmotionalStates: 7,
        maxSexualStates: 5,
      });
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('malformed')
      );
    });

    it('logs warning and falls back to defaults for invalid values', async () => {
      fetchWithRetry.mockResolvedValueOnce({
        maxEmotionalStates: 'seven',
        maxSexualStates: 0,
      });

      const result = await loader.loadConfig();

      expect(result).toEqual({
        maxEmotionalStates: 7,
        maxSexualStates: 5,
      });
      expect(logger.warn).toHaveBeenCalledTimes(2);
    });

    it('uses defaults for missing fields without warnings', async () => {
      fetchWithRetry.mockResolvedValueOnce({
        maxEmotionalStates: 9,
      });

      const result = await loader.loadConfig();

      expect(result).toEqual({
        maxEmotionalStates: 9,
        maxSexualStates: 5,
      });
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });
});
