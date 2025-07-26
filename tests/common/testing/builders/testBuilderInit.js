/**
 * @file testBuilderInit.js
 * @description Initializes the test builder system by registering presets and modules
 */

// Import the presets to trigger static initialization
import './presets/testScenarioPresets.js';

// Re-export main components for convenience
export { TestModuleBuilder } from './testModuleBuilder.js';
export { TestModuleRegistry } from './testModuleRegistry.js';
export { TestScenarioPresets } from './presets/testScenarioPresets.js';
export { TestConfigurationFactory } from './testConfigurationFactory.js';

// Ensure initialization is complete
TestModuleRegistry.initialize();
