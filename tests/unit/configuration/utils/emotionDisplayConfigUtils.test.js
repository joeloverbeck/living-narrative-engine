import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { loadAndApplyEmotionDisplayConfig } from '../../../../src/configuration/utils/emotionDisplayConfigUtils.js';
import { EmotionDisplayConfigLoader } from '../../../../src/configuration/emotionDisplayConfigLoader.js';

jest.mock(
  '../../../../src/configuration/emotionDisplayConfigLoader.js',
  () => ({
    EmotionDisplayConfigLoader: jest.fn(),
  })
);

describe('loadAndApplyEmotionDisplayConfig', () => {
  let container;
  let logger;
  let tokens;
  let mockLoader;

  beforeEach(() => {
    jest.clearAllMocks();

    container = {
      register: jest.fn(),
      resolve: jest.fn().mockReturnValue({ dispatch: jest.fn() }),
    };

    logger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    tokens = {
      ISafeEventDispatcher: 'ISafeEventDispatcher',
      IEmotionDisplayConfiguration: 'IEmotionDisplayConfiguration',
    };

    mockLoader = {
      loadConfig: jest.fn(),
    };

    EmotionDisplayConfigLoader.mockImplementation(() => mockLoader);
  });

  it('registers resolved config when loader succeeds', async () => {
    const config = { maxEmotionalStates: 9, maxSexualStates: 4 };
    mockLoader.loadConfig.mockResolvedValue(config);

    await loadAndApplyEmotionDisplayConfig(container, logger, tokens);

    expect(container.register).toHaveBeenCalledWith(
      tokens.IEmotionDisplayConfiguration,
      config
    );
  });

  it('registers defaults and warns on invalid config result', async () => {
    mockLoader.loadConfig.mockResolvedValue(null);

    await loadAndApplyEmotionDisplayConfig(container, logger, tokens);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Using defaults')
    );
    expect(container.register).toHaveBeenCalledWith(
      tokens.IEmotionDisplayConfiguration,
      {
        maxEmotionalStates: 7,
        maxSexualStates: 5,
      }
    );
  });

  it('registers defaults and logs error when loader throws', async () => {
    mockLoader.loadConfig.mockRejectedValue(new Error('network'));

    await loadAndApplyEmotionDisplayConfig(container, logger, tokens);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Unexpected error'),
      expect.any(Error)
    );
    expect(container.register).toHaveBeenCalledWith(
      tokens.IEmotionDisplayConfiguration,
      {
        maxEmotionalStates: 7,
        maxSexualStates: 5,
      }
    );
  });
});
