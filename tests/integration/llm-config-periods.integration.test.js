// tests/integration/llm-config-periods.integration.test.js
import { describe, it, expect, beforeEach } from '@jest/globals';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

describe('LLM Config Periods - Integration Test', () => {
  let tempDir;
  let configPath;

  beforeEach(async () => {
    // Create temp directory for test files
    tempDir = path.join(process.cwd(), 'temp', `test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    configPath = path.join(tempDir, 'llm-configs.json');
  });

  afterEach(async () => {
    // Clean up temp directory
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  describe('Config file with periods in IDs', () => {
    it('should correctly write and read config file with period-containing IDs', async () => {
      // Arrange - Create config with periods in IDs
      const configWithPeriods = {
        defaultConfigId: 'claude-sonnet-4.5',
        configs: {
          'claude-sonnet-4.5': {
            configId: 'claude-sonnet-4.5',
            displayName: 'Claude Sonnet 4.5 (OpenRouter - Tool Calling)',
            apiKeyEnvVar: 'OPENROUTER_API_KEY_ENV_VAR',
            apiKeyFileName: 'openrouter_api_key.txt',
            endpointUrl: 'https://openrouter.ai/api/v1/chat/completions',
            modelIdentifier: 'anthropic/claude-sonnet-4.5',
            apiType: 'openrouter',
            jsonOutputStrategy: {
              method: 'openrouter_tool_calling',
              toolName: 'function_call',
            },
            defaultParameters: {
              temperature: 1.0,
            },
            providerSpecificHeaders: {
              'HTTP-Referer': 'https://my-text-adventure-game.com',
              'X-Title': 'Living Narrative Engine',
            },
            contextTokenLimit: 1000000,
          },
        },
      };

      // Act - Write config to file
      await fs.writeFile(
        configPath,
        JSON.stringify(configWithPeriods, null, 2)
      );

      // Read it back
      const fileContent = await fs.readFile(configPath, 'utf-8');
      const parsedConfig = JSON.parse(fileContent);

      // Assert - Config should be preserved exactly including periods
      expect(parsedConfig.defaultConfigId).toBe('claude-sonnet-4.5');
      expect(parsedConfig.configs['claude-sonnet-4.5']).toBeDefined();
      expect(parsedConfig.configs['claude-sonnet-4.5'].configId).toBe(
        'claude-sonnet-4.5'
      );
      expect(parsedConfig.configs['claude-sonnet-4.5'].modelIdentifier).toBe(
        'anthropic/claude-sonnet-4.5'
      );
    });

    it('should handle config key lookups with periods correctly', async () => {
      // Arrange - Multiple configs with periods
      const multiConfig = {
        defaultConfigId: 'model-v1.0',
        configs: {
          'model-v1.0': {
            configId: 'model-v1.0',
            displayName: 'Model v1.0',
            modelIdentifier: 'model/v1.0',
            endpointUrl: 'https://api.example.com/v1',
            apiType: 'custom',
            jsonOutputStrategy: { method: 'manual_prompting' },
          },
          'model-v2.0': {
            configId: 'model-v2.0',
            displayName: 'Model v2.0',
            modelIdentifier: 'model/v2.0',
            endpointUrl: 'https://api.example.com/v2',
            apiType: 'custom',
            jsonOutputStrategy: { method: 'manual_prompting' },
          },
          'model-v3.0-beta': {
            configId: 'model-v3.0-beta',
            displayName: 'Model v3.0 Beta',
            modelIdentifier: 'model/v3.0-beta',
            endpointUrl: 'https://api.example.com/v3',
            apiType: 'custom',
            jsonOutputStrategy: { method: 'manual_prompting' },
          },
        },
      };

      // Act
      await fs.writeFile(configPath, JSON.stringify(multiConfig, null, 2));
      const fileContent = await fs.readFile(configPath, 'utf-8');
      const parsedConfig = JSON.parse(fileContent);

      // Assert - All configs should be accessible by their period-containing IDs
      expect(parsedConfig.configs['model-v1.0']).toBeDefined();
      expect(parsedConfig.configs['model-v2.0']).toBeDefined();
      expect(parsedConfig.configs['model-v3.0-beta']).toBeDefined();

      // Verify lookups work
      const v1Config = parsedConfig.configs['model-v1.0'];
      expect(v1Config.configId).toBe('model-v1.0');
      expect(v1Config.displayName).toBe('Model v1.0');

      const v3BetaConfig = parsedConfig.configs['model-v3.0-beta'];
      expect(v3BetaConfig.configId).toBe('model-v3.0-beta');
      expect(v3BetaConfig.displayName).toBe('Model v3.0 Beta');
    });

    it('should preserve multiple periods in config IDs', async () => {
      // Arrange - Config with multiple periods
      const multiPeriodConfig = {
        defaultConfigId: 'api.v2.3.4.stable',
        configs: {
          'api.v2.3.4.stable': {
            configId: 'api.v2.3.4.stable',
            displayName: 'API v2.3.4 Stable',
            apiKeyEnvVar: 'API_KEY',
            apiKeyFileName: 'api_key.txt',
            endpointUrl: 'https://api.example.com/v2',
            modelIdentifier: 'api.v2.3.4.stable',
            apiType: 'custom',
            jsonOutputStrategy: {
              method: 'manual_prompting',
            },
          },
          'test.1.2.3': {
            configId: 'test.1.2.3',
            displayName: 'Test 1.2.3',
            apiKeyEnvVar: 'API_KEY',
            apiKeyFileName: 'api_key.txt',
            endpointUrl: 'https://api.example.com/test',
            modelIdentifier: 'test.1.2.3',
            apiType: 'custom',
            jsonOutputStrategy: {
              method: 'manual_prompting',
            },
          },
        },
      };

      // Act
      await fs.writeFile(
        configPath,
        JSON.stringify(multiPeriodConfig, null, 2)
      );
      const fileContent = await fs.readFile(configPath, 'utf-8');
      const parsedConfig = JSON.parse(fileContent);

      // Assert
      expect(parsedConfig.defaultConfigId).toBe('api.v2.3.4.stable');
      expect(parsedConfig.configs['api.v2.3.4.stable']).toBeDefined();
      expect(parsedConfig.configs['api.v2.3.4.stable'].configId).toBe(
        'api.v2.3.4.stable'
      );
      expect(parsedConfig.configs['test.1.2.3']).toBeDefined();
      expect(parsedConfig.configs['test.1.2.3'].configId).toBe('test.1.2.3');
    });
  });

  describe('JSON parsing with periods', () => {
    it('should correctly parse JSON object keys with periods', async () => {
      // This test verifies that JavaScript/JSON itself has no issues with periods in keys
      const testObj = {
        'key.with.periods': 'value1',
        'another.key.1.2.3': 'value2',
        'claude-3.5-sonnet': 'value3',
      };

      // Act
      const jsonString = JSON.stringify(testObj);
      const parsed = JSON.parse(jsonString);

      // Assert
      expect(parsed['key.with.periods']).toBe('value1');
      expect(parsed['another.key.1.2.3']).toBe('value2');
      expect(parsed['claude-3.5-sonnet']).toBe('value3');
    });

    it('should handle defaultConfigId references with periods', async () => {
      const config = {
        defaultConfigId: 'llm-2.0.1-beta',
        configs: {
          'llm-2.0.1-beta': {
            configId: 'llm-2.0.1-beta',
            displayName: 'LLM 2.0.1 Beta',
          },
          'llm-1.0.0': {
            configId: 'llm-1.0.0',
            displayName: 'LLM 1.0.0',
          },
        },
      };

      // Act - Write and read
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
      const fileContent = await fs.readFile(configPath, 'utf-8');
      const parsedConfig = JSON.parse(fileContent);

      // Assert - defaultConfigId should correctly reference config with periods
      const defaultConfig = parsedConfig.configs[parsedConfig.defaultConfigId];
      expect(defaultConfig).toBeDefined();
      expect(defaultConfig.configId).toBe('llm-2.0.1-beta');
      expect(defaultConfig.displayName).toBe('LLM 2.0.1 Beta');
    });
  });
});
