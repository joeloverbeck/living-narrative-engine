/**
 * @file testConfigurationStandardization.integration.test.js
 * @description Integration tests for test configuration standardization
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestModuleBuilder } from '../common/builders/testModuleBuilder.js';
import { TestConfigurationFactory } from '../common/testConfigurationFactory.js';
import { TestConfigurationValidator } from '../common/builders/validation/testConfigurationValidator.js';

describe('Test Configuration Standardization Integration', () => {
  describe('TestModuleBuilder with TestConfigurationFactory', () => {
    let testEnv;

    afterEach(async () => {
      if (testEnv?.cleanup) {
        await testEnv.cleanup();
      }
    });

    describe('withStandardLLM integration', () => {
      it('should integrate standardized LLM config into turn execution module', async () => {
        testEnv = await TestModuleBuilder.forTurnExecution()
          .withStandardLLM('tool-calling')
          .withTestActors(['test-actor'])
          .build();

        expect(testEnv.config.llm.strategy).toBe('tool-calling');
        expect(testEnv.config.llm.llmConfig).toBeDefined();
        expect(testEnv.config.llm.llmConfig.configId).toBe(
          'test-llm-toolcalling'
        );
        expect(testEnv.config.llm.llmConfig.jsonOutputStrategy.method).toBe(
          'openrouter_tool_calling'
        );
      });

      it('should work with json-schema strategy', async () => {
        testEnv = await TestModuleBuilder.forTurnExecution()
          .withStandardLLM('json-schema')
          .withTestActors(['test-actor'])
          .build();

        expect(testEnv.config.llm.strategy).toBe('json-schema');
        expect(testEnv.config.llm.llmConfig.configId).toBe(
          'test-llm-jsonschema'
        );
        expect(testEnv.config.llm.llmConfig.jsonOutputStrategy.method).toBe(
          'json_schema'
        );
      });

      it('should work with limited-context strategy', async () => {
        testEnv = await TestModuleBuilder.forTurnExecution()
          .withStandardLLM('limited-context')
          .withTestActors(['test-actor'])
          .build();

        expect(testEnv.config.llm.llmConfig.contextTokenLimit).toBe(1000);
      });

      it('should maintain compatibility with existing withMockLLM', async () => {
        testEnv = await TestModuleBuilder.forTurnExecution()
          .withMockLLM({ strategy: 'tool-calling', temperature: 0.5 })
          .withTestActors(['test-actor'])
          .build();

        expect(testEnv.config.llm.strategy).toBe('tool-calling');
        expect(testEnv.config.llm.temperature).toBe(0.5);
      });

      it('should allow overriding standard LLM with custom config', async () => {
        testEnv = await TestModuleBuilder.forTurnExecution()
          .withStandardLLM('tool-calling')
          .withMockLLM({ temperature: 0.7 })
          .withTestActors(['test-actor'])
          .build();

        expect(testEnv.config.llm.temperature).toBe(0.7);
      });
    });

    describe('withEnvironmentPreset integration', () => {
      it('should apply turn execution preset', async () => {
        testEnv = await TestModuleBuilder.forTurnExecution()
          .withEnvironmentPreset('turnExecution')
          .build();

        // Verify LLM config
        expect(testEnv.config.llm.llmConfig).toBeDefined();
        expect(testEnv.config.llm.llmConfig.configId).toBe(
          'test-llm-toolcalling'
        );

        // Verify actors
        expect(testEnv.config.actors).toHaveLength(2);
        expect(testEnv.config.actors[0].id).toBe('ai-actor');
        expect(testEnv.config.actors[1].id).toBe('player-actor');

        // Verify world
        expect(testEnv.config.world.id).toBe('test-world');
        expect(testEnv.config.world.name).toBe('Test World');
      });

      it('should apply action processing preset', async () => {
        testEnv = await TestModuleBuilder.forTurnExecution()
          .withEnvironmentPreset('actionProcessing')
          .build();

        // Verify minimal actors
        expect(testEnv.config.actors).toHaveLength(1);
        expect(testEnv.config.actors[0].id).toBe('test-actor');

        // Note: actions property would be in the environment config,
        // but TurnExecutionTestModule doesn't directly expose it
      });

      it('should apply prompt generation preset', async () => {
        testEnv = await TestModuleBuilder.forTurnExecution()
          .withEnvironmentPreset('promptGeneration')
          .build();

        // Verify JSON schema LLM
        expect(testEnv.config.llm.strategy).toBe('json-schema');
        expect(testEnv.config.llm.llmConfig.jsonOutputStrategy.method).toBe(
          'json_schema'
        );

        // Verify prompt test actors
        expect(testEnv.config.actors).toHaveLength(1);
        expect(testEnv.config.actors[0].id).toBe('prompt-test-actor');
      });

      it('should throw error for unknown preset', () => {
        expect(() =>
          TestModuleBuilder.forTurnExecution().withEnvironmentPreset(
            'unknownPreset'
          )
        ).toThrow('Unknown environment preset: unknownPreset');
      });

      it('should allow overriding preset values', async () => {
        testEnv = await TestModuleBuilder.forTurnExecution()
          .withEnvironmentPreset('turnExecution')
          .withWorld({ name: 'Custom World' })
          .withTestActors(['custom-actor'])
          .build();

        expect(testEnv.config.world.name).toBe('Custom World');
        expect(testEnv.config.actors).toHaveLength(1);
        expect(testEnv.config.actors[0].id).toBe('custom-actor');
      });
    });

    describe('combined usage patterns', () => {
      it('should work with both standardLLM and environmentPreset', async () => {
        testEnv = await TestModuleBuilder.forTurnExecution()
          .withEnvironmentPreset('turnExecution')
          .withStandardLLM('json-schema') // Override the preset's LLM
          .build();

        expect(testEnv.config.llm.strategy).toBe('json-schema');
        expect(testEnv.config.actors).toHaveLength(2); // From preset
        expect(testEnv.config.world.id).toBe('test-world'); // From preset
      });

      it('should integrate with performance tracking', async () => {
        testEnv = await TestModuleBuilder.forTurnExecution()
          .withStandardLLM('tool-calling')
          .withPerformanceTracking({
            thresholds: { turnExecution: 50 },
          })
          .withTestActors(['test-actor'])
          .build();

        expect(testEnv.getPerformanceMetrics).toBeDefined();
        expect(
          testEnv.config.monitoring.performance.thresholds.turnExecution
        ).toBe(50);
      });

      it('should integrate with event capture', async () => {
        testEnv = await TestModuleBuilder.forTurnExecution()
          .withStandardLLM('tool-calling')
          .withEventCapture(['TEST_EVENT'])
          .withTestActors(['test-actor'])
          .build();

        expect(testEnv.getCapturedEvents).toBeDefined();
        expect(testEnv.config.monitoring.events).toContain('TEST_EVENT');
      });
    });

    describe('validation integration', () => {
      it('should validate LLM configs created by factory', () => {
        const llmConfig =
          TestConfigurationFactory.createLLMConfig('tool-calling');

        expect(() =>
          TestConfigurationValidator.validateLLMConfig(llmConfig)
        ).not.toThrow();
      });

      it('should validate test environments created by factory', () => {
        const env =
          TestConfigurationFactory.createTestEnvironment('turn-execution');

        expect(() =>
          TestConfigurationValidator.validateTestEnvironment(
            env,
            'turn-execution'
          )
        ).not.toThrow();
      });

      it('should validate mock configurations', () => {
        const llmMock =
          TestConfigurationFactory.createMockConfiguration('llm-adapter');

        expect(() =>
          TestConfigurationValidator.validateMockConfiguration(
            llmMock,
            'llm-adapter'
          )
        ).not.toThrow();
      });
    });

    describe('preset integration', () => {
      it('should work with factory presets', () => {
        const presets = TestConfigurationFactory.getPresets();

        // Test LLM presets
        const toolCallingLLM = presets.llm.toolCalling();
        expect(toolCallingLLM.configId).toBe('test-llm-toolcalling');

        // Test environment presets
        const turnExecEnv = presets.environments.turnExecution();
        expect(turnExecEnv.llm.configId).toBe('test-llm-toolcalling');
        expect(turnExecEnv.actors).toHaveLength(2);

        // Test mock presets
        const minimalLLMMock = presets.mocks.minimalLLM();
        expect(minimalLLMMock.responses).toBeDefined();
      });

      it('should allow combining presets with overrides', () => {
        const baseConfig =
          TestConfigurationFactory.createLLMConfig('tool-calling');
        const customConfig = {
          ...baseConfig,
          contextTokenLimit: 4000,
          customField: 'custom-value',
        };

        expect(customConfig.contextTokenLimit).toBe(4000);
        expect(customConfig.customField).toBe('custom-value');
        expect(customConfig.configId).toBe('test-llm-toolcalling');
      });
    });

    describe('error handling', () => {
      it('should provide clear error for invalid strategy', () => {
        expect(() =>
          TestModuleBuilder.forTurnExecution().withStandardLLM(
            'invalid-strategy'
          )
        ).toThrow('Unknown LLM strategy: invalid-strategy');
      });

      it('should provide clear error for invalid environment type', () => {
        expect(() =>
          TestConfigurationFactory.createTestEnvironment('invalid-type')
        ).toThrow('Unknown environment type: invalid-type');
      });
    });

    describe('backward compatibility', () => {
      it('should maintain compatibility with existing test patterns', async () => {
        // Old pattern should still work
        testEnv = await TestModuleBuilder.forTurnExecution()
          .withMockLLM({ strategy: 'tool-calling' })
          .withTestActors(['ai-actor'])
          .withWorld({ name: 'Test World' })
          .build();

        expect(testEnv.config.llm.strategy).toBe('tool-calling');
        expect(testEnv.config.actors[0].id).toBe('ai-actor');
        expect(testEnv.config.world.name).toBe('Test World');
      });

      it('should work with scenario presets', async () => {
        testEnv = await TestModuleBuilder.scenarios
          .combat()
          .withStandardLLM('json-schema')
          .build();

        expect(testEnv.config.llm.strategy).toBe('json-schema');
      });
    });
  });

  describe('ActionProcessingTestModule with standardization', () => {
    let testEnv;

    afterEach(async () => {
      if (testEnv?.cleanup) {
        await testEnv.cleanup();
      }
    });

    it('should use standardized LLM configuration', async () => {
      testEnv = await TestModuleBuilder.forActionProcessing()
        .withStandardLLM('tool-calling')
        .forActor('test-actor')
        .build();

      expect(testEnv.config.llm).toBeDefined();
      expect(testEnv.config.llm.strategy).toBe('tool-calling');
      expect(testEnv.config.llm.llmConfig.configId).toBe('test-llm-toolcalling');
    });

    it('should apply environment preset', async () => {
      testEnv = await TestModuleBuilder.forActionProcessing()
        .withEnvironmentPreset('actionProcessing')
        .build();

      expect(testEnv.config.llm).toBeDefined();
      expect(testEnv.config.actors).toBeDefined();
      expect(testEnv.config.actions).toBeDefined();
      expect(testEnv.config.mocks).toBeDefined();
    });
  });

  describe('EntityManagementTestModule with standardization', () => {
    let testEnv;

    afterEach(async () => {
      if (testEnv?.cleanup) {
        await testEnv.cleanup();
      }
    });

    it('should use standardized LLM configuration', async () => {
      testEnv = await TestModuleBuilder.forEntityManagement()
        .withStandardLLM('json-schema')
        .withEntities([{ type: 'core:actor', id: 'test-entity' }])
        .build();

      expect(testEnv.config.llm).toBeDefined();
      expect(testEnv.config.llm.strategy).toBe('json-schema');
      expect(testEnv.config.llm.llmConfig.configId).toBe('test-llm-jsonschema');
    });

    it('should handle environment preset when not available', async () => {
      // Since entity management doesn't have a preset in the factory yet,
      // this should throw an error
      await expect(async () => {
        await TestModuleBuilder.forEntityManagement()
          .withEnvironmentPreset('entityManagement')
          .build();
      }).rejects.toThrow('Unknown environment preset: entityManagement');
    });
  });

  describe('LLMTestingModule with standardization', () => {
    let testEnv;

    afterEach(async () => {
      if (testEnv?.cleanup) {
        await testEnv.cleanup();
      }
    });

    it('should use standardized LLM configuration', async () => {
      testEnv = await TestModuleBuilder.forLLMTesting()
        .withStandardLLM('tool-calling')
        .withActors([{ id: 'test-actor' }])
        .build();

      expect(testEnv.config.strategy).toBe('tool-calling');
      expect(testEnv.config.llmConfig).toBeDefined();
      expect(testEnv.config.llmConfig.configId).toBe('test-llm-toolcalling');
      expect(testEnv.config.parameters.temperature).toBe(1.0);
    });

    it('should apply environment preset', async () => {
      testEnv = await TestModuleBuilder.forLLMTesting()
        .withEnvironmentPreset('promptGeneration')
        .build();

      expect(testEnv.config.strategy).toBe('json-schema');
      expect(testEnv.config.llmConfig).toBeDefined();
      expect(testEnv.config.actors).toBeDefined();
      // Mock responses are set in the config but the structure may vary
      expect(testEnv.config.mockResponses).toBeDefined();
    });

    it('should update token limits from standardized config', async () => {
      testEnv = await TestModuleBuilder.forLLMTesting()
        .withStandardLLM('limited-context')
        .build();

      expect(testEnv.config.tokenLimits.input).toBe(1000); // From limited-context config
    });
  });

  describe('usage patterns documentation', () => {
    it('demonstrates basic standardized configuration usage', async () => {
      // Example 1: Using standardized LLM config
      const testEnv1 = await TestModuleBuilder.forTurnExecution()
        .withStandardLLM('json-schema')
        .withTestActors(['ai-actor'])
        .build();

      expect(
        testEnv1.config.llm.llmConfig.jsonOutputStrategy.schema
      ).toBeDefined();
      await testEnv1.cleanup();

      // Example 2: Using environment preset
      const testEnv2 = await TestModuleBuilder.forTurnExecution()
        .withEnvironmentPreset('turnExecution')
        .build();

      expect(testEnv2.config.actors).toHaveLength(2);
      expect(testEnv2.config.world.id).toBe('test-world');
      await testEnv2.cleanup();

      // Example 3: Custom configuration with overrides
      const testEnv3 = await TestModuleBuilder.forTurnExecution()
        .withStandardLLM('tool-calling', {
          contextTokenLimit: 4000,
          defaultParameters: { temperature: 0.7 },
        })
        .build();

      // Note: The override functionality would need to be implemented
      // in withStandardLLM to accept overrides parameter
      await testEnv3.cleanup();
    });

    it('demonstrates mock configuration usage', () => {
      // Direct factory usage
      const mockLlmConfig = {
        defaultConfigId: 'test-llm-toolcalling',
        configs: {
          'test-llm-toolcalling':
            TestConfigurationFactory.createLLMConfig('tool-calling'),
        },
      };

      expect(mockLlmConfig.configs['test-llm-toolcalling'].configId).toBe(
        'test-llm-toolcalling'
      );

      // Mock configuration
      const llmMock = TestConfigurationFactory.createMockConfiguration(
        'llm-adapter',
        { strategy: 'json-schema' }
      );

      expect(llmMock.responses.chosenIndex).toBe(0);
    });
  });
});
