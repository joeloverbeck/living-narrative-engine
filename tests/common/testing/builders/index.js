/**
 * @file Test Module Builder System - Main Export
 * @description Provides a unified export point for the test module builder system.
 * This is the recommended way to access test modules in your tests.
 * @example
 * // Import everything
 * import { TestModuleBuilder, TurnExecutionTestModule, createTestModules } from './tests/common/builders/index.js';
 * @example
 * // Import specific items
 * import { TestModuleBuilder } from './tests/common/builders/index.js';
 * @example
 * // Use the fluent API
 * const testEnv = await TestModuleBuilder.forTurnExecution()
 *   .withMockLLM({ strategy: 'tool-calling' })
 *   .withTestActors(['ai-actor'])
 *   .build();
 */

// Main builder entry point
export { TestModuleBuilder } from './testModuleBuilder.js';

// Individual test modules
import { TurnExecutionTestModule } from './modules/turnExecutionTestModule.js';
import { ActionProcessingTestModule } from './modules/actionProcessingTestModule.js';
import { EntityManagementTestModule } from './modules/entityManagementTestModule.js';
import { LLMTestingModule } from './modules/llmTestingModule.js';
import { TestScenarioPresets } from './presets/testScenarioPresets.js';

export { TurnExecutionTestModule } from './modules/turnExecutionTestModule.js';
export { ActionProcessingTestModule } from './modules/actionProcessingTestModule.js';
export { EntityManagementTestModule } from './modules/entityManagementTestModule.js';
export { LLMTestingModule } from './modules/llmTestingModule.js';

// Presets
export { TestScenarioPresets } from './presets/testScenarioPresets.js';

// Validation
export { TestModuleValidator } from './validation/testModuleValidator.js';
export { TestModuleValidationError } from './errors/testModuleValidationError.js';

// Interfaces
export { ITestModule } from './interfaces/ITestModule.js';

// Factory function for creating test modules with jest mocks
/**
 * Creates test module builders with jest mock function support
 * 
 * @param {Function} mockFn - Mock function creator (typically jest.fn)
 * @returns {object} Object containing test module builder functions
 */
export function createTestModules(mockFn) {
  return {
    forTurnExecution: () => new TurnExecutionTestModule(mockFn),
    forActionProcessing: () => new ActionProcessingTestModule(mockFn),
    forEntityManagement: () => new EntityManagementTestModule(mockFn),
    forLLMTesting: () => new LLMTestingModule(mockFn),
    scenarios: {
      combat: () => TestScenarioPresets.combat(mockFn),
      socialInteraction: () => TestScenarioPresets.socialInteraction(mockFn),
      exploration: () => TestScenarioPresets.exploration(mockFn),
      performance: () => TestScenarioPresets.performance(mockFn),
    },
  };
}

/**
 * Quick start guide for test modules:
 *
 * 1. Using TestModuleBuilder (recommended):
 *    const testEnv = await TestModuleBuilder.forTurnExecution()
 *      .withMockLLM({ strategy: 'tool-calling' })
 *      .withTestActors(['ai-actor'])
 *      .build();
 *
 * 2. Using preset scenarios:
 *    const testEnv = await TestModuleBuilder.scenarios.combat()
 *      .withCustomFacades({ overrides: {} })
 *      .build();
 *
 * 3. Using createTestModules (with jest):
 *    const { forTurnExecution } = createTestModules(jest.fn);
 *    const testEnv = await forTurnExecution()
 *      .withMockLLM({ strategy: 'tool-calling' })
 *      .build();
 *
 * 4. Direct module instantiation:
 *    const module = new TurnExecutionTestModule(jest.fn);
 *    const testEnv = await module
 *      .withMockLLM({ strategy: 'tool-calling' })
 *      .build();
 */
