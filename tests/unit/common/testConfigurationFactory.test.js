/**
 * @file testConfigurationFactory.test.js
 * @description Unit tests for TestConfigurationFactory
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestConfigurationFactory } from '../../common/testConfigurationFactory.js';
import fs from 'fs/promises';

describe('TestConfigurationFactory', () => {
  describe('LLM Configuration Methods', () => {
    describe('createLLMConfig', () => {
      it('should create tool-calling configuration with correct defaults', () => {
        const config = TestConfigurationFactory.createLLMConfig('tool-calling');

        expect(config).toMatchObject({
          configId: 'test-llm-toolcalling',
          displayName: 'Test LLM (Tool Calling)',
          apiKeyEnvVar: 'TEST_API_KEY',
          apiKeyFileName: 'test_api_key.txt',
          endpointUrl: 'https://test-api.com/v1/chat/completions',
          modelIdentifier: 'test-model-toolcalling',
          apiType: 'openrouter',
          jsonOutputStrategy: {
            method: 'openrouter_tool_calling',
            toolName: 'function_call',
          },
          defaultParameters: { temperature: 1.0 },
          contextTokenLimit: 8000,
        });

        // Verify prompt elements
        expect(config.promptElements).toHaveLength(6);
        expect(config.promptElements[0]).toMatchObject({
          key: 'task_definition',
          prefix: '<task_definition>\n',
          suffix: '\n</task_definition>\n',
        });

        // Verify prompt assembly order
        expect(config.promptAssemblyOrder).toEqual([
          'task_definition',
          'character_persona',
          'perception_log_wrapper',
          'thoughts_wrapper',
          'indexed_choices',
          'final_instructions',
        ]);
      });

      it('should create json-schema configuration with correct defaults', () => {
        const config = TestConfigurationFactory.createLLMConfig('json-schema');

        expect(config).toMatchObject({
          configId: 'test-llm-jsonschema',
          displayName: 'Test LLM (JSON Schema)',
          apiType: 'openrouter',
          jsonOutputStrategy: {
            method: 'json_schema',
            schema: expect.objectContaining({
              name: 'turn_action_response',
            }),
          },
          contextTokenLimit: 8000,
        });

        // Verify different prompt format
        expect(config.promptElements[0]).toMatchObject({
          key: 'task_definition',
          prefix: '## Task\n',
          suffix: '\n\n',
        });
      });

      it('should create limited-context configuration with low token limit', () => {
        const config =
          TestConfigurationFactory.createLLMConfig('limited-context');

        expect(config).toMatchObject({
          configId: 'test-llm-limited',
          displayName: 'Test LLM (Limited Context)',
          contextTokenLimit: 1000,
        });
      });

      it('should throw error for unknown strategy', () => {
        expect(() =>
          TestConfigurationFactory.createLLMConfig('invalid-strategy')
        ).toThrow('Unknown LLM strategy: invalid-strategy');
      });

      it('should apply overrides to configuration', () => {
        const overrides = {
          contextTokenLimit: 4000,
          defaultParameters: { temperature: 0.7 },
          customField: 'custom-value',
        };

        const config = TestConfigurationFactory.createLLMConfig(
          'tool-calling',
          overrides
        );

        expect(config.contextTokenLimit).toBe(4000);
        expect(config.defaultParameters.temperature).toBe(0.7);
        expect(config.customField).toBe('custom-value');
      });

      it('should deep merge nested overrides', () => {
        const overrides = {
          jsonOutputStrategy: {
            toolName: 'custom_function',
          },
        };

        const config = TestConfigurationFactory.createLLMConfig(
          'tool-calling',
          overrides
        );

        expect(config.jsonOutputStrategy).toMatchObject({
          method: 'openrouter_tool_calling',
          toolName: 'custom_function',
        });
      });
    });

    describe('createTestEnvironment', () => {
      it('should create turn-execution environment', () => {
        const env =
          TestConfigurationFactory.createTestEnvironment('turn-execution');

        expect(env).toHaveProperty('llm');
        expect(env).toHaveProperty('actors');
        expect(env).toHaveProperty('world');
        expect(env).toHaveProperty('mocks');

        // Verify LLM is tool-calling by default
        expect(env.llm.jsonOutputStrategy.method).toBe(
          'openrouter_tool_calling'
        );

        // Verify actors include AI and player
        expect(env.actors).toHaveLength(2);
        expect(env.actors[0].id).toBe('ai-actor');
        expect(env.actors[1].id).toBe('player-actor');

        // Verify world configuration
        expect(env.world).toMatchObject({
          id: 'test-world',
          name: 'Test World',
        });
      });

      it('should create action-processing environment', () => {
        const env =
          TestConfigurationFactory.createTestEnvironment('action-processing');

        expect(env).toHaveProperty('llm');
        expect(env).toHaveProperty('actors');
        expect(env).toHaveProperty('actions');
        expect(env).toHaveProperty('mocks');

        // Verify minimal actors
        expect(env.actors).toHaveLength(1);
        expect(env.actors[0].id).toBe('test-actor');

        // Verify actions
        expect(env.actions).toHaveLength(3);
        expect(env.actions.map((a) => a.id)).toContain('core:move');
      });

      it('should create prompt-generation environment', () => {
        const env =
          TestConfigurationFactory.createTestEnvironment('prompt-generation');

        // Verify JSON schema LLM is used
        expect(env.llm.jsonOutputStrategy.method).toBe('json_schema');

        // Verify prompt test actor
        expect(env.actors).toHaveLength(1);
        expect(env.actors[0].id).toBe('prompt-test-actor');
      });

      it('should throw error for unknown environment type', () => {
        expect(() =>
          TestConfigurationFactory.createTestEnvironment('invalid-type')
        ).toThrow('Unknown environment type: invalid-type');
      });

      it('should apply overrides to environment', () => {
        const overrides = {
          actors: [{ id: 'custom-actor' }],
          world: { name: 'Custom World' },
        };

        const env = TestConfigurationFactory.createTestEnvironment(
          'turn-execution',
          overrides
        );

        expect(env.actors).toEqual([{ id: 'custom-actor' }]);
        expect(env.world.name).toBe('Custom World');
      });
    });

    describe('createMockConfiguration', () => {
      it('should create llm-adapter mock configuration', () => {
        const mock =
          TestConfigurationFactory.createMockConfiguration('llm-adapter');

        expect(mock).toMatchObject({
          apiKey: 'test-api-key-12345',
          delay: 0,
        });

        expect(mock.responses).toBeDefined();
        expect(mock.responses.function_call).toBeDefined();
      });

      it('should create event-bus mock configuration', () => {
        const mock = TestConfigurationFactory.createMockConfiguration(
          'event-bus',
          {
            captureAll: true,
            eventTypes: ['TEST_EVENT'],
          }
        );

        expect(mock).toMatchObject({
          captureAll: true,
          eventTypes: ['TEST_EVENT'],
        });
      });

      it('should create entity-manager mock configuration', () => {
        const mock =
          TestConfigurationFactory.createMockConfiguration('entity-manager');

        expect(mock.entities).toBeDefined();
        expect(Array.isArray(mock.entities)).toBe(true);
        expect(mock.entities).toHaveLength(2);
      });

      it('should return empty object for unknown mock type', () => {
        const mock =
          TestConfigurationFactory.createMockConfiguration('unknown-type');
        expect(mock).toEqual({});
      });

      it('should use strategy option for llm-adapter', () => {
        const mock = TestConfigurationFactory.createMockConfiguration(
          'llm-adapter',
          {
            strategy: 'json-schema',
          }
        );

        expect(mock.responses).toMatchObject({
          chosenIndex: 0,
          speech: expect.any(String),
          thoughts: expect.any(String),
        });
      });
    });

    describe('getPresets', () => {
      it('should return all preset categories', () => {
        const presets = TestConfigurationFactory.getPresets();

        expect(presets).toHaveProperty('llm');
        expect(presets).toHaveProperty('environments');
        expect(presets).toHaveProperty('mocks');
      });

      it('should have functional LLM presets', () => {
        const presets = TestConfigurationFactory.getPresets();

        const toolCallingConfig = presets.llm.toolCalling();
        expect(toolCallingConfig.configId).toBe('test-llm-toolcalling');

        const jsonSchemaConfig = presets.llm.jsonSchema();
        expect(jsonSchemaConfig.configId).toBe('test-llm-jsonschema');

        const limitedConfig = presets.llm.limited();
        expect(limitedConfig.configId).toBe('test-llm-limited');
      });

      it('should have functional environment presets', () => {
        const presets = TestConfigurationFactory.getPresets();

        const turnExecEnv = presets.environments.turnExecution();
        expect(turnExecEnv).toHaveProperty('llm');
        expect(turnExecEnv).toHaveProperty('actors');
        expect(turnExecEnv).toHaveProperty('world');

        const actionProcEnv = presets.environments.actionProcessing();
        expect(actionProcEnv).toHaveProperty('actions');

        const promptGenEnv = presets.environments.promptGeneration();
        expect(promptGenEnv.llm.jsonOutputStrategy.method).toBe('json_schema');
      });

      it('should have functional mock presets', () => {
        const presets = TestConfigurationFactory.getPresets();

        const minimalLLM = presets.mocks.minimalLLM();
        expect(minimalLLM).toHaveProperty('responses');

        const fullEventCapture = presets.mocks.fullEventCapture();
        expect(fullEventCapture.captureAll).toBe(true);
      });
    });

    describe('integration with createTestFiles', () => {
      let tempDir;
      let pathConfiguration;

      beforeEach(async () => {
        const config = await TestConfigurationFactory.createTestConfiguration();
        tempDir = config.tempDir;
        pathConfiguration = config.pathConfiguration;
      });

      afterEach(async () => {
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
        } catch (error) {
          // Ignore cleanup errors
        }
      });

      it('should use centralized LLM configurations in createTestFiles', async () => {
        await TestConfigurationFactory.createTestFiles(pathConfiguration);

        // Read the created LLM config file
        const llmConfigPath = pathConfiguration.getLLMConfigPath();
        const llmConfigContent = await fs.readFile(llmConfigPath, 'utf-8');
        const llmConfig = JSON.parse(llmConfigContent);

        // Verify it uses the centralized configurations
        expect(llmConfig.configs['test-llm-toolcalling']).toMatchObject({
          configId: 'test-llm-toolcalling',
          jsonOutputStrategy: {
            method: 'openrouter_tool_calling',
            toolName: 'function_call',
          },
        });

        expect(llmConfig.configs['test-llm-jsonschema']).toMatchObject({
          configId: 'test-llm-jsonschema',
          jsonOutputStrategy: {
            method: 'json_schema',
          },
        });
      });
    });
  });

  describe('private helper methods (tested via public methods)', () => {
    it('should deep merge objects correctly', () => {
      // Test deep merge with nested override
      const config = TestConfigurationFactory.createLLMConfig('tool-calling', {
        defaultParameters: { temperature: 0.5, maxTokens: 1000 },
        jsonOutputStrategy: { customField: 'custom' },
      });

      // Should preserve original fields while adding new ones
      expect(config.defaultParameters).toEqual({
        temperature: 0.5,
        maxTokens: 1000,
      });
      expect(config.jsonOutputStrategy).toMatchObject({
        method: 'openrouter_tool_calling',
        toolName: 'function_call',
        customField: 'custom',
      });
    });

    it('should create correct mock responses for different strategies', () => {
      const toolCallingMock = TestConfigurationFactory.createMockConfiguration(
        'llm-adapter',
        { strategy: 'tool-calling' }
      );

      expect(toolCallingMock.responses.function_call).toBeDefined();
      expect(
        JSON.parse(toolCallingMock.responses.function_call.arguments)
      ).toMatchObject({
        chosenIndex: 0,
        speech: expect.any(String),
        thoughts: expect.any(String),
      });

      const jsonSchemaMock = TestConfigurationFactory.createMockConfiguration(
        'llm-adapter',
        { strategy: 'json-schema' }
      );

      expect(jsonSchemaMock.responses).toMatchObject({
        chosenIndex: 0,
        speech: expect.any(String),
        thoughts: expect.any(String),
      });
    });
  });
});
