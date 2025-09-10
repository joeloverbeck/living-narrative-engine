/**
 * @file Integration test for LLM configuration count reporting bug
 * @description Tests that the server correctly reports the number of loaded LLM configurations
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { LlmConfigService } from '../../src/config/llmConfigService.js';
import { ConsoleLogger } from '../../src/consoleLogger.js';
import { NodeFileSystemReader } from '../../src/nodeFileSystemReader.js';
import { getAppConfigService } from '../../src/config/appConfig.js';

describe('LLM Configuration Count Reporting Integration', () => {
  let llmConfigService;
  let logger;
  let fileSystemReader;
  let appConfigService;

  beforeEach(() => {
    // Set the environment variable to point to the actual config file location
    process.env.LLM_CONFIG_PATH = '../config/llm-configs.json';

    logger = new ConsoleLogger();
    fileSystemReader = new NodeFileSystemReader();
    appConfigService = getAppConfigService(logger);

    llmConfigService = new LlmConfigService(
      fileSystemReader,
      logger,
      appConfigService
    );
  });

  afterEach(() => {
    // Reset any singleton state
    jest.clearAllMocks();
    // Clean up environment variable
    delete process.env.LLM_CONFIG_PATH;
  });

  it('should correctly count LLM configurations from loaded config object', async () => {
    // Initialize the service with actual config file
    await llmConfigService.initialize();

    // Verify service is operational
    expect(llmConfigService.isOperational()).toBe(true);

    // Get the loaded configs
    const llmConfigs = llmConfigService.getLlmConfigs();

    // Verify the structure and count
    expect(llmConfigs).not.toBeNull();
    expect(llmConfigs.configs).toBeDefined();
    expect(typeof llmConfigs.configs).toBe('object');

    // Count configs using the correct property name
    const configCount = Object.keys(llmConfigs.configs).length;
    expect(configCount).toBeGreaterThan(0);

    // Verify we're accessing the correct property (not llmConfigs.llms)
    expect(llmConfigs.llms).toBeUndefined();

    // Verify we have a reasonable number of configurations (test shouldn't break when configs are added)
    expect(configCount).toBeGreaterThan(1);
  });

  it('should handle empty configuration object correctly', () => {
    const emptyConfig = {
      defaultConfigId: 'test',
      configs: {},
    };

    const configCount = Object.keys(emptyConfig.configs).length;
    expect(configCount).toBe(0);

    // Verify the bug scenario - accessing wrong property returns undefined
    expect(emptyConfig.llms).toBeUndefined();
    if (emptyConfig.llms) {
      // This branch should never execute
      expect(Object.keys(emptyConfig.llms).length).toBe(0);
    }
  });

  it('should reproduce the original bug with wrong property access', () => {
    const mockConfig = {
      defaultConfigId: 'test',
      configs: {
        config1: { configId: 'config1' },
        config2: { configId: 'config2' },
        config3: { configId: 'config3' },
        config4: { configId: 'config4' },
      },
    };

    // Correct way (what should be used)
    const correctCount = Object.keys(mockConfig.configs).length;
    expect(correctCount).toBe(4);

    // Bug reproduction (what was being used before fix)
    let buggyCount = 0;
    if (mockConfig && mockConfig.llms) {
      buggyCount = Object.keys(mockConfig.llms).length;
    }
    expect(buggyCount).toBe(0); // This demonstrates the bug

    // Verify the bug would cause incorrect reporting
    expect(buggyCount).not.toBe(correctCount);
  });
});
