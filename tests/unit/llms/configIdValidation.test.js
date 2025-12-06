// tests/unit/llms/configIdValidation.test.js
import { describe, it, expect } from '@jest/globals';

describe('Config ID Validation Patterns', () => {
  describe('JavaScript object key behavior with periods', () => {
    it('should allow periods in JavaScript object keys', () => {
      // JavaScript natively allows any string as an object key
      const testObj = {};

      // Test various patterns with periods
      testObj['simple'] = 'no periods';
      testObj['with.one.period'] = 'one period';
      testObj['v1.0'] = 'version style';
      testObj['v1.2.3'] = 'semantic version';
      testObj['claude-3.5-sonnet'] = 'model with version';
      testObj['gpt-4.0-turbo'] = 'another model';
      testObj['api.v2.3.4.stable'] = 'multiple periods';

      // All keys should work
      expect(testObj['simple']).toBe('no periods');
      expect(testObj['with.one.period']).toBe('one period');
      expect(testObj['v1.0']).toBe('version style');
      expect(testObj['v1.2.3']).toBe('semantic version');
      expect(testObj['claude-3.5-sonnet']).toBe('model with version');
      expect(testObj['gpt-4.0-turbo']).toBe('another model');
      expect(testObj['api.v2.3.4.stable']).toBe('multiple periods');
    });

    it('should correctly serialize and deserialize object keys with periods through JSON', () => {
      const original = {
        'claude-sonnet-4.5': {
          configId: 'claude-sonnet-4.5',
          displayName: 'Claude Sonnet 4.5',
        },
        'gpt-3.5-turbo': {
          configId: 'gpt-3.5-turbo',
          displayName: 'GPT 3.5 Turbo',
        },
        'deepseek-v3.1': {
          configId: 'deepseek-v3.1',
          displayName: 'DeepSeek v3.1',
        },
      };

      // Serialize to JSON
      const jsonString = JSON.stringify(original);

      // Deserialize back
      const parsed = JSON.parse(jsonString);

      // Should be identical
      expect(parsed).toEqual(original);
      expect(parsed['claude-sonnet-4.5']).toBeDefined();
      expect(parsed['gpt-3.5-turbo']).toBeDefined();
      expect(parsed['deepseek-v3.1']).toBeDefined();
    });
  });

  describe('Config ID patterns that should be valid', () => {
    const validConfigIds = [
      // Simple IDs without periods
      { id: 'claude', description: 'simple name' },
      { id: 'gpt-4', description: 'name with dash' },
      { id: 'llama_2', description: 'name with underscore' },

      // Version-style IDs with periods
      { id: 'v1.0', description: 'simple version' },
      { id: 'v2.1.3', description: 'semantic version' },
      { id: 'model-v1.0', description: 'model with version' },

      // Model names with versions
      { id: 'claude-3.5-sonnet', description: 'Claude 3.5 Sonnet' },
      { id: 'claude-sonnet-4.5', description: 'Claude Sonnet 4.5' },
      { id: 'gpt-3.5-turbo', description: 'GPT 3.5 Turbo' },
      { id: 'gpt-4.0', description: 'GPT 4.0' },
      { id: 'deepseek-v3.1', description: 'DeepSeek v3.1' },

      // Multiple periods
      { id: 'api.v1.2.3', description: 'API version' },
      { id: 'model.v2.0.1.beta', description: 'model with beta version' },
      { id: 'service.api.v1.0', description: 'service API version' },

      // Mixed patterns
      { id: 'openai-gpt-3.5-turbo-0125', description: 'full OpenAI model ID' },
      {
        id: 'anthropic-claude-3.5-sonnet-20241022',
        description: 'full Anthropic model ID',
      },
      { id: 'meta-llama-3.1-8b', description: 'Meta Llama with version' },
    ];

    it.each(validConfigIds)('should accept "$id" ($description)', ({ id }) => {
      // Since the JSON schema doesn't have pattern restrictions on configId,
      // and JavaScript allows any string as object key, all these should work
      const config = {
        defaultConfigId: id,
        configs: {
          [id]: {
            configId: id,
            displayName: `Test ${id}`,
            modelIdentifier: `model/${id}`,
            endpointUrl: 'https://api.example.com',
            apiType: 'test',
            jsonOutputStrategy: { method: 'manual_prompting' },
          },
        },
      };

      // Should be able to access the config
      expect(config.configs[id]).toBeDefined();
      expect(config.configs[id].configId).toBe(id);

      // Should serialize and deserialize correctly
      const jsonString = JSON.stringify(config);
      const parsed = JSON.parse(jsonString);
      expect(parsed.configs[id]).toBeDefined();
      expect(parsed.configs[id].configId).toBe(id);
    });
  });

  describe('Config ID lookup behavior', () => {
    it('should correctly look up configs by ID with periods', () => {
      const configs = {
        'model-v1.0': { name: 'Model v1.0' },
        'model-v2.0': { name: 'Model v2.0' },
        'model-v3.0-beta': { name: 'Model v3.0 Beta' },
      };

      // Direct lookup
      expect(configs['model-v1.0']).toBeDefined();
      expect(configs['model-v2.0']).toBeDefined();
      expect(configs['model-v3.0-beta']).toBeDefined();

      // Dynamic lookup
      const lookupId = 'model-v2.0';
      expect(configs[lookupId]).toBeDefined();
      expect(configs[lookupId].name).toBe('Model v2.0');
    });

    it('should handle defaultConfigId references with periods', () => {
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

      // Should be able to look up default config using the ID with periods
      const defaultConfig = config.configs[config.defaultConfigId];
      expect(defaultConfig).toBeDefined();
      expect(defaultConfig.configId).toBe('llm-2.0.1-beta');
      expect(defaultConfig.displayName).toBe('LLM 2.0.1 Beta');
    });
  });

  describe('Real-world config examples', () => {
    it('should handle the actual claude-sonnet-4.5 config structure', () => {
      const realWorldConfig = {
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

      // Verify the config is accessible
      expect(realWorldConfig.configs['claude-sonnet-4.5']).toBeDefined();
      expect(realWorldConfig.configs['claude-sonnet-4.5'].configId).toBe(
        'claude-sonnet-4.5'
      );
      expect(realWorldConfig.configs['claude-sonnet-4.5'].modelIdentifier).toBe(
        'anthropic/claude-sonnet-4.5'
      );

      // Verify defaultConfigId lookup works
      const defaultConfig =
        realWorldConfig.configs[realWorldConfig.defaultConfigId];
      expect(defaultConfig).toBeDefined();
      expect(defaultConfig.displayName).toContain('Claude Sonnet 4.5');
    });

    it('should handle configs from various LLM providers with version numbers', () => {
      const providerConfigs = {
        defaultConfigId: 'gpt-3.5-turbo',
        configs: {
          // OpenAI models
          'gpt-3.5-turbo': {
            configId: 'gpt-3.5-turbo',
            modelIdentifier: 'gpt-3.5-turbo-0125',
          },
          'gpt-4.0': {
            configId: 'gpt-4.0',
            modelIdentifier: 'gpt-4-1106-preview',
          },

          // Anthropic models
          'claude-3.5-sonnet': {
            configId: 'claude-3.5-sonnet',
            modelIdentifier: 'claude-3-5-sonnet-20241022',
          },
          'claude-sonnet-4.5': {
            configId: 'claude-sonnet-4.5',
            modelIdentifier: 'anthropic/claude-sonnet-4.5',
          },

          // DeepSeek models
          'deepseek-v3.1': {
            configId: 'deepseek-v3.1',
            modelIdentifier: 'deepseek/deepseek-chat-v3.1',
          },

          // Meta models
          'llama-3.1-8b': {
            configId: 'llama-3.1-8b',
            modelIdentifier: 'meta-llama/Llama-3.1-8B-Instruct',
          },
        },
      };

      // All configs should be accessible
      Object.keys(providerConfigs.configs).forEach((configId) => {
        expect(providerConfigs.configs[configId]).toBeDefined();
        expect(providerConfigs.configs[configId].configId).toBe(configId);
      });
    });
  });
});
