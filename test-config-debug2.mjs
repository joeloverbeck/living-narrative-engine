import { TestConfigurationFactory } from './tests/common/testConfigurationFactory.js';

// Simulate what the test bed does
const mockLlmConfig = {
  defaultConfigId: 'test-llm-toolcalling',
  configs: {
    'test-llm-toolcalling': TestConfigurationFactory.createLLMConfig('tool-calling'),
    'test-llm-jsonschema': TestConfigurationFactory.createLLMConfig('json-schema', {
      jsonOutputStrategy: {
        method: 'openrouter_json_schema',
        jsonSchema: {
          name: 'turn_action_response',
          schema: {
            type: 'object',
            properties: {
              chosenIndex: { type: 'number' },
              speech: { type: 'string' },
              thoughts: { type: 'string' },
            },
            required: ['chosenIndex', 'speech', 'thoughts'],
          },
        },
      },
    }),
    'test-llm-limited': TestConfigurationFactory.createLLMConfig('limited-context'),
  },
};

console.log('Tool calling config modelIdentifier:', mockLlmConfig.configs['test-llm-toolcalling'].modelIdentifier);
console.log('Limited config modelIdentifier:', mockLlmConfig.configs['test-llm-limited'].modelIdentifier);
console.log('Are they different configs?', mockLlmConfig.configs['test-llm-toolcalling'] !== mockLlmConfig.configs['test-llm-limited']);
