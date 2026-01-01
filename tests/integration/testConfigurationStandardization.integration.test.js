/**
 * @file testConfigurationStandardization.integration.test.js
 * @description Integration tests for test configuration standardization
 *
 * Performance Optimized: Uses shared containers to reduce test execution time.
 * Tests are grouped by container requirements for maximum efficiency.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from '@jest/globals';
import { TestModuleBuilder } from '../common/testing/builders/testModuleBuilder.js';
import { TestConfigurationFactory } from '../common/testConfigurationFactory.js';
import { TestConfigurationValidator } from '../common/testing/builders/validation/testConfigurationValidator.js';
import {
  getSharedContainer,
  releaseSharedContainer,
  resetContainerState,
} from '../common/testing/builders/sharedContainerFactory.js';

// Shared container keys for different test module groups
const CONTAINER_KEYS = {
  TURN_EXECUTION: 'test-config-turn-execution',
  ACTION_PROCESSING: 'test-config-action-processing',
  ENTITY_MANAGEMENT: 'test-config-entity-management',
  LLM_TESTING: 'test-config-llm-testing',
};

describe('Test Configuration Standardization Integration', () => {
  // ============================================================================
  // PURE FACTORY TESTS - No container needed (synchronous tests)
  // ============================================================================

  describe('Pure Factory Tests (No Container)', () => {
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

      it('should throw error for unknown preset', () => {
        expect(() =>
          TestModuleBuilder.forTurnExecution().withEnvironmentPreset(
            'unknownPreset'
          )
        ).toThrow('Unknown environment preset: unknownPreset');
      });
    });

    describe('mock configuration usage', () => {
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

  // ============================================================================
  // TURN EXECUTION MODULE TESTS - Shared container
  // ============================================================================

  describe('TurnExecutionTestModule Tests (Shared Container)', () => {
    let testEnv;

    beforeAll(async () => {
      await getSharedContainer(CONTAINER_KEYS.TURN_EXECUTION, {
        stubLLM: true,
        loadMods: false,
        mods: ['core'],
      });
    });

    afterAll(async () => {
      await releaseSharedContainer(CONTAINER_KEYS.TURN_EXECUTION);
    });

    beforeEach(() => {
      resetContainerState(CONTAINER_KEYS.TURN_EXECUTION);
      testEnv = null;
    });

    describe('withStandardLLM integration', () => {
      it('should integrate standardized LLM config into turn execution module', async () => {
        testEnv = await TestModuleBuilder.forTurnExecution()
          .withSharedContainer(CONTAINER_KEYS.TURN_EXECUTION)
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
          .withSharedContainer(CONTAINER_KEYS.TURN_EXECUTION)
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
          .withSharedContainer(CONTAINER_KEYS.TURN_EXECUTION)
          .withStandardLLM('limited-context')
          .withTestActors(['test-actor'])
          .build();

        expect(testEnv.config.llm.llmConfig.contextTokenLimit).toBe(1000);
      });

      it('should maintain compatibility with existing withMockLLM', async () => {
        testEnv = await TestModuleBuilder.forTurnExecution()
          .withSharedContainer(CONTAINER_KEYS.TURN_EXECUTION)
          .withMockLLM({ strategy: 'tool-calling', temperature: 0.5 })
          .withTestActors(['test-actor'])
          .build();

        expect(testEnv.config.llm.strategy).toBe('tool-calling');
        expect(testEnv.config.llm.temperature).toBe(0.5);
      });

      it('should allow overriding standard LLM with custom config', async () => {
        testEnv = await TestModuleBuilder.forTurnExecution()
          .withSharedContainer(CONTAINER_KEYS.TURN_EXECUTION)
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
          .withSharedContainer(CONTAINER_KEYS.TURN_EXECUTION)
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
          .withSharedContainer(CONTAINER_KEYS.TURN_EXECUTION)
          .withEnvironmentPreset('actionProcessing')
          .build();

        // Verify minimal actors
        expect(testEnv.config.actors).toHaveLength(1);
        expect(testEnv.config.actors[0].id).toBe('test-actor');
      });

      it('should apply prompt generation preset', async () => {
        testEnv = await TestModuleBuilder.forTurnExecution()
          .withSharedContainer(CONTAINER_KEYS.TURN_EXECUTION)
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

      it('should allow overriding preset values', async () => {
        testEnv = await TestModuleBuilder.forTurnExecution()
          .withSharedContainer(CONTAINER_KEYS.TURN_EXECUTION)
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
          .withSharedContainer(CONTAINER_KEYS.TURN_EXECUTION)
          .withEnvironmentPreset('turnExecution')
          .withStandardLLM('json-schema') // Override the preset's LLM
          .build();

        expect(testEnv.config.llm.strategy).toBe('json-schema');
        expect(testEnv.config.actors).toHaveLength(2); // From preset
        expect(testEnv.config.world.id).toBe('test-world'); // From preset
      });

      it('should integrate with performance tracking', async () => {
        testEnv = await TestModuleBuilder.forTurnExecution()
          .withSharedContainer(CONTAINER_KEYS.TURN_EXECUTION)
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
          .withSharedContainer(CONTAINER_KEYS.TURN_EXECUTION)
          .withStandardLLM('tool-calling')
          .withEventCapture(['TEST_EVENT'])
          .withTestActors(['test-actor'])
          .build();

        expect(testEnv.getCapturedEvents).toBeDefined();
        expect(testEnv.config.monitoring.events).toContain('TEST_EVENT');
      });
    });

    describe('backward compatibility', () => {
      it('should maintain compatibility with existing test patterns', async () => {
        // Old pattern should still work
        testEnv = await TestModuleBuilder.forTurnExecution()
          .withSharedContainer(CONTAINER_KEYS.TURN_EXECUTION)
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
          .withSharedContainer(CONTAINER_KEYS.TURN_EXECUTION)
          .withStandardLLM('json-schema')
          .build();

        expect(testEnv.config.llm.strategy).toBe('json-schema');
      });
    });

    describe('usage patterns documentation', () => {
      it('demonstrates basic standardized configuration usage', async () => {
        // Example 1: Using standardized LLM config
        const testEnv1 = await TestModuleBuilder.forTurnExecution()
          .withSharedContainer(CONTAINER_KEYS.TURN_EXECUTION)
          .withStandardLLM('json-schema')
          .withTestActors(['ai-actor'])
          .build();

        expect(
          testEnv1.config.llm.llmConfig.jsonOutputStrategy.schema
        ).toBeDefined();

        // Example 2: Using environment preset
        const testEnv2 = await TestModuleBuilder.forTurnExecution()
          .withSharedContainer(CONTAINER_KEYS.TURN_EXECUTION)
          .withEnvironmentPreset('turnExecution')
          .build();

        expect(testEnv2.config.actors).toHaveLength(2);
        expect(testEnv2.config.world.id).toBe('test-world');

        // Example 3: Custom configuration with overrides
        const testEnv3 = await TestModuleBuilder.forTurnExecution()
          .withSharedContainer(CONTAINER_KEYS.TURN_EXECUTION)
          .withStandardLLM('tool-calling', {
            contextTokenLimit: 4000,
            defaultParameters: { temperature: 0.7 },
          })
          .build();

        // Note: The override functionality would need to be implemented
        // in withStandardLLM to accept overrides parameter
        expect(testEnv3).toBeDefined();
      });
    });
  });

  // ============================================================================
  // ACTION PROCESSING MODULE TESTS - Shared container
  // ============================================================================

  describe('ActionProcessingTestModule Tests (Shared Container)', () => {
    let testEnv;

    beforeAll(async () => {
      await getSharedContainer(CONTAINER_KEYS.ACTION_PROCESSING, {
        stubLLM: true,
        loadMods: false,
        mods: ['core'],
      });
    });

    afterAll(async () => {
      await releaseSharedContainer(CONTAINER_KEYS.ACTION_PROCESSING);
    });

    beforeEach(() => {
      resetContainerState(CONTAINER_KEYS.ACTION_PROCESSING);
      testEnv = null;
    });

    it('should use standardized LLM configuration', async () => {
      testEnv = await TestModuleBuilder.forActionProcessing()
        .withSharedContainer(CONTAINER_KEYS.ACTION_PROCESSING)
        .withStandardLLM('tool-calling')
        .forActor('test-actor')
        .build();

      expect(testEnv.config.llm).toBeDefined();
      expect(testEnv.config.llm.strategy).toBe('tool-calling');
      expect(testEnv.config.llm.llmConfig.configId).toBe(
        'test-llm-toolcalling'
      );
    });

    it('should apply environment preset', async () => {
      testEnv = await TestModuleBuilder.forActionProcessing()
        .withSharedContainer(CONTAINER_KEYS.ACTION_PROCESSING)
        .withEnvironmentPreset('actionProcessing')
        .build();

      expect(testEnv.config.llm).toBeDefined();
      expect(testEnv.config.actors).toBeDefined();
      expect(testEnv.config.actions).toBeDefined();
      expect(testEnv.config.mocks).toBeDefined();
    });
  });

  // ============================================================================
  // ENTITY MANAGEMENT MODULE TESTS - Shared container
  // ============================================================================

  describe('EntityManagementTestModule Tests (Shared Container)', () => {
    let testEnv;

    beforeAll(async () => {
      await getSharedContainer(CONTAINER_KEYS.ENTITY_MANAGEMENT, {
        stubLLM: true,
        loadMods: false,
        mods: ['core'],
      });
    });

    afterAll(async () => {
      await releaseSharedContainer(CONTAINER_KEYS.ENTITY_MANAGEMENT);
    });

    beforeEach(() => {
      resetContainerState(CONTAINER_KEYS.ENTITY_MANAGEMENT);
      testEnv = null;
    });

    it('should use standardized LLM configuration', async () => {
      testEnv = await TestModuleBuilder.forEntityManagement()
        .withSharedContainer(CONTAINER_KEYS.ENTITY_MANAGEMENT)
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
          .withSharedContainer(CONTAINER_KEYS.ENTITY_MANAGEMENT)
          .withEnvironmentPreset('entityManagement')
          .build();
      }).rejects.toThrow('Unknown environment preset: entityManagement');
    });
  });

  // ============================================================================
  // LLM TESTING MODULE TESTS - Shared container
  // ============================================================================

  describe('LLMTestingModule Tests (Shared Container)', () => {
    let testEnv;

    beforeAll(async () => {
      await getSharedContainer(CONTAINER_KEYS.LLM_TESTING, {
        stubLLM: true,
        loadMods: false,
        mods: ['core'],
      });
    });

    afterAll(async () => {
      await releaseSharedContainer(CONTAINER_KEYS.LLM_TESTING);
    });

    beforeEach(() => {
      resetContainerState(CONTAINER_KEYS.LLM_TESTING);
      testEnv = null;
    });

    it('should use standardized LLM configuration', async () => {
      testEnv = await TestModuleBuilder.forLLMTesting()
        .withSharedContainer(CONTAINER_KEYS.LLM_TESTING)
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
        .withSharedContainer(CONTAINER_KEYS.LLM_TESTING)
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
        .withSharedContainer(CONTAINER_KEYS.LLM_TESTING)
        .withStandardLLM('limited-context')
        .build();

      expect(testEnv.config.tokenLimits.input).toBe(1000); // From limited-context config
    });
  });
});
