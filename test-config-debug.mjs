import { TestConfigurationFactory } from './tests/common/testConfigurationFactory.js';

// Create the configs
const toolCallingConfig =
  TestConfigurationFactory.createLLMConfig('tool-calling');
const limitedConfig =
  TestConfigurationFactory.createLLMConfig('limited-context');

console.log('Tool calling modelIdentifier:', toolCallingConfig.modelIdentifier);
console.log('Limited modelIdentifier:', limitedConfig.modelIdentifier);

// Check if they're the same object
console.log('Are they the same object?', toolCallingConfig === limitedConfig);

// Check individual fields
console.log('Tool calling configId:', toolCallingConfig.configId);
console.log('Limited configId:', limitedConfig.configId);
