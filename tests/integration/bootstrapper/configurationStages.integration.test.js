import { describe, it, expect, afterEach, jest } from '@jest/globals';

import { initializeGlobalConfigStage } from '../../../src/bootstrapper/stages/configurationStages.js';
import EntityConfigProvider from '../../../src/entities/config/EntityConfigProvider.js';
import {
  getGlobalConfig,
  getLimits,
  validateEntityCount,
} from '../../../src/entities/utils/configUtils.js';
import StageError from '../../../src/bootstrapper/StageError.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { createEnhancedMockLogger } from '../../common/mockFactories.js';

/**
 *
 */
async function resetGlobalConfig() {
  const resetLogger = createEnhancedMockLogger();
  await initializeGlobalConfigStage(resetLogger);
}

describe('initializeGlobalConfigStage integration', () => {
  afterEach(async () => {
    jest.restoreAllMocks();
    await resetGlobalConfig();
  });

  it('initializes the global configuration provider and exposes merged settings to dependent utilities', async () => {
    const logger = createEnhancedMockLogger();
    const userOverrides = {
      limits: {
        MAX_ENTITIES: 12,
        MAX_BATCH_SIZE: 5,
      },
      cache: {
        ENABLE_DEFINITION_CACHE: false,
      },
    };

    const result = await initializeGlobalConfigStage(logger, userOverrides);

    expect(result.success).toBe(true);

    const provider = getGlobalConfig();
    expect(provider).toBeInstanceOf(EntityConfigProvider);

    const limits = getLimits();
    expect(limits.MAX_ENTITIES).toBe(12);
    expect(limits.MAX_BATCH_SIZE).toBe(5);

    const cacheSettings = provider.getCacheSettings();
    expect(cacheSettings.ENABLE_DEFINITION_CACHE).toBe(false);

    expect(() => validateEntityCount(12)).not.toThrow();
    expect(() => validateEntityCount(13)).toThrow(
      'Entity count 13 exceeds maximum limit of 12'
    );

    expect(logger.debug).toHaveBeenCalledWith(
      'Bootstrap Stage: Initializing Global Configuration...'
    );
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Configuration Stage: Global configuration provider initialized successfully.'
      )
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'Configuration Stage: Configuration system is now available for all services.'
    );
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Configuration Stage: Configuration initialized with the following settings:'
      ),
      expect.objectContaining({
        hasUserConfig: true,
        userConfigKeys: ['limits', 'cache'],
      })
    );
  });

  it('returns a StageError when configuration initialization fails due to invalid logger dependencies', async () => {
    const brokenLogger = {
      debug: jest.fn(),
      error: jest.fn(),
    };

    const result = await initializeGlobalConfigStage(brokenLogger);

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(StageError);
    expect(result.error.phase).toBe('Global Configuration Initialization');
    expect(result.error.message).toContain('Fatal Error during global configuration initialization');
    expect(result.error.cause).toBeInstanceOf(InvalidArgumentError);

    expect(brokenLogger.error).toHaveBeenCalledWith(
      'Configuration Stage: Fatal error during global configuration initialization.',
      expect.any(InvalidArgumentError)
    );
  });
});
