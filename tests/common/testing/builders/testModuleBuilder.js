/**
 * @file TestModuleBuilder - Primary entry point for test module creation
 * @description Provides static factory methods for creating test modules and accessing presets
 */

import { TestModuleRegistry } from './testModuleRegistry.js';
import { TestModuleValidator } from './validation/testModuleValidator.js';
import { TurnExecutionTestModule } from './modules/turnExecutionTestModule.js';
import { ActionProcessingTestModule } from './modules/actionProcessingTestModule.js';
import { EntityManagementTestModule } from './modules/entityManagementTestModule.js';
import { LLMTestingModule } from './modules/llmTestingModule.js';
// Import presets to trigger registration
import './presets/testScenarioPresets.js';

/**
 * Primary entry point for all test module creation.
 * Provides static factory methods and preset scenarios for rapid test setup.
 *
 * @example
 * // Basic usage
 * const testEnv = await TestModuleBuilder.forTurnExecution()
 *   .withMockLLM({ strategy: 'tool-calling' })
 *   .withTestActors(['ai-actor'])
 *   .build();
 * @example
 * // Using presets
 * const testEnv = await TestModuleBuilder.scenarios.combat()
 *   .withCustomFacades({ overrides: {} })
 *   .build();
 */
export class TestModuleBuilder {
  /**
   * Creates a new TurnExecutionTestModule for complete turn execution testing
   *
   * @returns {TurnExecutionTestModule} A new turn execution test module
   */
  static forTurnExecution() {
    return new TurnExecutionTestModule();
  }

  /**
   * Creates a new ActionProcessingTestModule for action discovery and processing
   *
   * @returns {ActionProcessingTestModule} A new action processing test module
   */
  static forActionProcessing() {
    return new ActionProcessingTestModule();
  }

  /**
   * Creates a new EntityManagementTestModule for entity lifecycle testing
   *
   * @returns {EntityManagementTestModule} A new entity management test module
   */
  static forEntityManagement() {
    return new EntityManagementTestModule();
  }

  /**
   * Creates a new LLMTestingModule for AI decision-making and prompt testing
   *
   * @returns {LLMTestingModule} A new LLM testing module
   */
  static forLLMTesting() {
    return new LLMTestingModule();
  }

  /**
   * Preset scenarios for rapid test creation.
   * Each scenario returns a pre-configured test module ready for customization.
   *
   * @namespace
   */
  static scenarios = new Proxy({}, {
    get(target, prop) {
      // Handle symbol properties (like Symbol.toStringTag)
      if (typeof prop === 'symbol') {
        return target[prop];
      }
      
      // Try to get the preset from the registry
      try {
        const presetFactory = TestModuleRegistry.getPreset(prop);
        return presetFactory;
      } catch (error) {
        // If preset not found, return undefined (standard JS behavior)
        return undefined;
      }
    },
    
    // List available presets when Object.keys() is called
    ownKeys() {
      return TestModuleRegistry.getPresetNames();
    },
    
    // Make properties enumerable
    getOwnPropertyDescriptor(target, prop) {
      if (TestModuleRegistry.getPresetNames().includes(prop)) {
        return {
          enumerable: true,
          configurable: true,
          value: TestModuleRegistry.getPreset(prop)
        };
      }
      return undefined;
    }
  });

  /**
   * Advanced builders for specific testing needs
   *
   * @namespace
   */
  static advanced = {
    /**
     * Create a custom scenario builder with specific requirements
     *
     * @param {object} config - Base configuration for the scenario
     * @returns {TurnExecutionTestModule} Customized test module
     */
    custom: (config) => {
      // Temporarily return a placeholder until implemented
      throw new Error('Custom scenario builder not yet implemented');
      // return new TurnExecutionTestModule().withConfig(config);
    },

    /**
     * Create a multi-actor scenario for complex interactions
     *
     * @param {number} actorCount - Number of actors to create
     * @returns {TurnExecutionTestModule} Multi-actor test module
     */
    multiActor: (actorCount) => {
      // Temporarily return a placeholder until implemented
      throw new Error('Multi-actor scenario builder not yet implemented');
      // const actors = Array.from({ length: actorCount }, (_, i) => `actor-${i}`);
      // return TestModuleBuilder.forTurnExecution().withTestActors(actors);
    },
  };

  /**
   * Utility methods for test module management
   *
   * @namespace
   */
  static utils = {
    /**
     * Validates a test module configuration without building
     *
     * @param {object} config - Configuration to validate
     * @param {string} moduleType - Type of module to validate against
     * @returns {import('./validation/testModuleValidator.js').ValidationResult} Validation result
     */
    validateConfig: (config, moduleType) => {
      return TestModuleValidator.validateConfiguration(config, moduleType);
    },

    /**
     * Creates a test module from a JSON configuration
     *
     * @param {object} json - JSON configuration
     * @returns {ITestModule} Appropriate test module instance
     */
    fromJSON: (json) => {
      // Temporarily return a placeholder until implemented
      throw new Error('JSON deserialization not yet implemented');
    },
  };

  /**
   * Private constructor to prevent instantiation
   *
   * @private
   */
  constructor() {
    throw new Error(
      'TestModuleBuilder is a static class and cannot be instantiated'
    );
  }
}
