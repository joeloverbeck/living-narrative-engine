# Test Configuration Standardization

## Overview

The test configuration standardization system (implemented in [`tests/common/testConfigurationFactory.js`](../../tests/common/testConfigurationFactory.js) and mirrored for builder utilities in [`tests/common/testing/builders/testConfigurationFactory.js`](../../tests/common/testing/builders/testConfigurationFactory.js)) provides centralized management of test configurations, eliminating duplication and reducing configuration-related errors across test suites.

## Key Features

- **Centralized LLM Configurations**: Single source of truth for all LLM test configurations
- **Test Environment Presets**: Pre-configured environments for common testing scenarios
- **Configuration Validation**: Built-in validation to catch configuration errors early
- **Mock Configuration Builders**: Standardized mock creation for consistent testing
- **Backward Compatibility**: Works seamlessly with existing test patterns

## Quick Start

### Using Standardized LLM Configurations

```javascript
// Old way: Inline configuration (50+ lines)
const mockLlmConfig = {
  defaultConfigId: 'test-llm-toolcalling',
  configs: {
    'test-llm-toolcalling': {
      // ... 50+ lines of configuration
    },
  },
};

// New way: Using factory (1 line)
const mockLlmConfig = {
  defaultConfigId: 'test-llm-toolcalling',
  configs: {
    'test-llm-toolcalling':
      TestConfigurationFactory.createLLMConfig('tool-calling'),
  },
};
```

### Using with TestModuleBuilder

```javascript
// Use standardized LLM configuration
const testEnv = await TestModuleBuilder.forTurnExecution()
  .withStandardLLM('json-schema')
  .withTestActors(['ai-actor'])
  .build();

// Use complete environment preset
const testEnv = await TestModuleBuilder.forTurnExecution()
  .withEnvironmentPreset('turnExecution')
  .build();
```

> **Note:** TestModuleBuilder presets inline the factory defaults to avoid circular dependencies. They configure LLM, actor, and world defaults but omit the mock objects that `TestConfigurationFactory.createTestEnvironment()` supplies. Use the factory method directly when you need the fully hydrated preset including mocks.

## API Reference

### TestConfigurationFactory

#### createLLMConfig(strategy = 'tool-calling', overrides = {})

Creates a standardized LLM configuration.

**Parameters:**

- `strategy` (string): LLM strategy - 'tool-calling', 'json-schema', or 'limited-context'
- `overrides` (object, optional): Configuration overrides

**Returns:** Complete LLM configuration object

**Example:**

```javascript
const llmConfig = TestConfigurationFactory.createLLMConfig('tool-calling', {
  contextTokenLimit: 4000,
  defaultParameters: { temperature: 0.7 },
});
```

#### createTestEnvironment(type, overrides = {})

Creates a complete test environment configuration.

**Parameters:**

- `type` (string): Environment type - 'turn-execution', 'action-processing', or 'prompt-generation'
- `overrides` (object, optional): Configuration overrides

**Returns:** Complete test environment configuration. Each environment includes a standardized LLM configuration plus contextual defaults:

- **turn-execution** – tool-calling LLM config, default AI (`ai-actor`) and player (`player-actor`) actors, a `Test World` definition, and turn execution mocks (LLM adapter + event bus).
- **action-processing** – tool-calling LLM config, a minimal actor list, reusable action definitions, and action service + validation mocks.
- **prompt-generation** – JSON schema LLM config, prompt-focused actor defaults, and prompt builder/token counter mocks.

**Example:**

```javascript
const env = TestConfigurationFactory.createTestEnvironment(
  'action-processing',
  {
    actors: [{ id: 'custom-actor' }],
  }
);
```

#### createMockConfiguration(mockType, options = {})

Creates mock configurations for different services.

**Parameters:**

- `mockType` (string): Type of mock - 'llm-adapter', 'event-bus', or 'entity-manager'
- `options` (object, optional): Mock configuration options

**Returns:** Mock configuration object. Supported mock types map to predefined shapes:

- `'llm-adapter'` – canned responses keyed by strategy (default `tool-calling`), a fake API key, and optional response delay.
- `'event-bus'` – `captureAll` flag (default `false`) and configurable `eventTypes` allow list.
- `'entity-manager'` – default entity definitions that can be overridden with `options.entities`.

Unsupported mock types return an empty object; pair the result with `TestConfigurationValidator.validateMockConfiguration()` to ensure the configuration matches expectations.

**Example:**

```javascript
const llmMock = TestConfigurationFactory.createMockConfiguration(
  'llm-adapter',
  {
    strategy: 'json-schema',
    delay: 100,
  }
);
```

#### getPresets()

Returns all available configuration presets.

**Returns:** Object containing categorized preset functions grouped under `llm`, `environments`, and `mocks` for quick reuse.

**Example:**

```javascript
const presets = TestConfigurationFactory.getPresets();
const llmConfig = presets.llm.toolCalling();
const env = presets.environments.turnExecution();
```

#### Additional Factory Utilities

- `createTestConfiguration()` – Generates an isolated temp directory plus `TestPathConfiguration`, returning `{ pathConfiguration, tempDir, cleanup }`.
- `createTestFiles(pathConfiguration)` – Seeds standardized config and prompt files inside a `TestPathConfiguration` instance.
- `createTestModule(moduleType)` – Shortcut for `TestModuleBuilder` factories (`turnExecution`, `actionProcessing`, `entityManagement`, `llmTesting`).
- `createScenario(scenario)` – Instantiates pre-configured builder scenarios (e.g., `'combat'`, `'socialInteraction'`).
- `migrateToTestModule(legacyConfig)` – Applies legacy configuration data to a new `TestModuleBuilder` instance for gradual migrations.

### TestConfigurationValidator

#### validateLLMConfig(config)

Validates an LLM configuration structure.

**Parameters:**

- `config` (object): LLM configuration to validate

**Returns:** true if valid

**Throws:** Error with detailed validation message if invalid

#### validateTestEnvironment(env, type)

Validates a test environment configuration.

**Parameters:**

- `env` (object): Environment configuration to validate
- `type` (string): Environment type

**Returns:** true if valid

**Throws:** Error with detailed validation message if invalid

#### validateMockConfiguration(mockConfig, mockType)

Validates a mock configuration.

**Parameters:**

- `mockConfig` (object): Mock configuration to validate
- `mockType` (string): Type of mock

**Returns:** true if valid

**Throws:** Error with detailed validation message if invalid

### TestModuleBuilder Integration

#### withStandardLLM(strategy)

Uses a standardized LLM configuration from TestConfigurationFactory.

**Parameters:**

- `strategy` (string): LLM strategy to use

**Returns:** TestModule instance for chaining

**Example:**

```javascript
const testEnv = await TestModuleBuilder.forTurnExecution()
  .withStandardLLM('json-schema')
  .withTestActors(['ai-actor'])
  .build();
```

#### withEnvironmentPreset(presetName)

Applies a complete environment preset.

**Parameters:**

- `presetName` (string): Preset name - 'turnExecution', 'actionProcessing', or 'promptGeneration'. Hyphenated variants (e.g., 'turn-execution') remain supported for backward compatibility.

**Returns:** TestModule instance for chaining

**Example:**

```javascript
const testEnv = await TestModuleBuilder.forTurnExecution()
  .withEnvironmentPreset('turnExecution')
  .build();
```

## Configuration Strategies

### Tool-Calling Strategy

Used for LLMs that support function/tool calling:

```javascript
{
  configId: 'test-llm-toolcalling',
  jsonOutputStrategy: {
    method: 'openrouter_tool_calling',
    toolName: 'function_call'
  },
  contextTokenLimit: 8000,
  // XML-style prompt elements
}
```

### JSON Schema Strategy

Used for LLMs that support structured JSON output:

```javascript
{
  configId: 'test-llm-jsonschema',
  jsonOutputStrategy: {
    method: 'json_schema',
    schema: { /* turn action response schema */ }
  },
  contextTokenLimit: 8000,
  // Markdown-style prompt elements
}
```

### Limited Context Strategy

Used for testing token limit handling:

```javascript
{
  configId: 'test-llm-limited',
  contextTokenLimit: 1000, // Very low limit
  // Same as tool-calling otherwise
}
```

## Environment Types

### Turn Execution

Complete turn execution testing environment:

- Tool-calling LLM configuration with XML-style prompt elements
- AI (`ai-actor`) and player (`player-actor`) actors
- Test world (`Test World`) with multiple locations
- Turn execution mocks (LLM adapter default response + event bus settings)

### Action Processing

Action discovery and processing environment:

- Tool-calling LLM configuration
- Minimal test actor list
- Available actions (`core:move`, `core:look`, `core:wait`)
- Action processing mocks (action service defaults + validation service)

### Prompt Generation

Prompt generation and formatting environment:

- JSON schema LLM configuration
- Prompt-specific test actor (`prompt-test-actor`)
- Prompt generation mocks (prompt builder defaults + token counter helpers)

## Usage Patterns

### Basic Test Setup

```javascript
describe('My Feature Test', () => {
  let testEnv;

  beforeEach(async () => {
    testEnv = await TestModuleBuilder.forTurnExecution()
      .withStandardLLM('tool-calling')
      .withTestActors(['test-actor'])
      .build();
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  test('should execute turn', async () => {
    const result = await testEnv.executeAITurn('test-actor');
    expect(result.success).toBe(true);
  });
});
```

### Using Environment Presets

```javascript
// Quick setup with all defaults
const testEnv = await TestModuleBuilder.forTurnExecution()
  .withEnvironmentPreset('turnExecution')
  .build();

// Override specific parts of the preset
const testEnv = await TestModuleBuilder.forTurnExecution()
  .withEnvironmentPreset('turnExecution')
  .withWorld({ name: 'Custom World' })
  .build();
```

### Custom Configuration with Validation

```javascript
// Create custom LLM config
const customLLM = TestConfigurationFactory.createLLMConfig('tool-calling', {
  contextTokenLimit: 4000,
  customField: 'custom-value',
});

// Validate before use
TestConfigurationValidator.validateLLMConfig(customLLM);

// Use in test
const testEnv = await TestModuleBuilder.forTurnExecution()
  .withMockLLM({ llmConfig: customLLM })
  .build();
```

### Direct Factory Usage

```javascript
// For test beds that need direct configuration
const llmConfig = TestConfigurationFactory.createLLMConfig('json-schema');
const mockConfig = TestConfigurationFactory.createMockConfiguration(
  'llm-adapter',
  {
    strategy: 'json-schema',
  }
);

// Use in custom test bed
const testBed = new CustomTestBed({
  llmConfig,
  mockResponses: mockConfig.responses,
});
```

## Migration Guide

### From Inline Configurations

Before:

```javascript
const mockLlmConfig = {
  defaultConfigId: 'test-llm-toolcalling',
  configs: {
    'test-llm-toolcalling': {
      configId: 'test-llm-toolcalling',
      displayName: 'Test LLM (Tool Calling)',
      // ... 50+ more lines
    },
  },
};
```

After:

```javascript
const mockLlmConfig = {
  defaultConfigId: 'test-llm-toolcalling',
  configs: {
    'test-llm-toolcalling':
      TestConfigurationFactory.createLLMConfig('tool-calling'),
  },
};
```

### From Custom Test Modules

Before:

```javascript
const testEnv = await TestModuleBuilder.forTurnExecution()
  .withMockLLM({ strategy: 'tool-calling' })
  .withTestActors([
    { id: 'ai-actor', name: 'Test Actor' },
    { id: 'player', name: 'Player' },
  ])
  .withWorld({ name: 'Test World' })
  .build();
```

After:

```javascript
const testEnv = await TestModuleBuilder.forTurnExecution()
  .withEnvironmentPreset('turnExecution')
  .build();
```

## Best Practices

1. **Use Presets When Possible**: Start with environment presets and override only what's needed
2. **Validate Custom Configurations**: Always validate custom configurations before use
3. **Prefer Factory Methods**: Use factory methods over inline configurations
4. **Document Overrides**: When overriding defaults, document why the override is necessary
5. **Test with Multiple Strategies**: Test your code with different LLM strategies to ensure compatibility

## Performance Benefits

- **Reduced Test Setup Time**: 40-60% reduction in test setup code
- **Faster Test Execution**: Reusable configurations reduce initialization overhead
- **Better Caching**: Centralized configurations enable better caching strategies
- **Reduced Memory Usage**: Shared configuration objects reduce memory duplication

## Troubleshooting

### Common Issues

**Issue**: "Unknown LLM strategy"
**Solution**: Check that you're using one of: 'tool-calling', 'json-schema', 'limited-context'

**Issue**: "Missing required LLM config fields"
**Solution**: Ensure your custom configuration includes all required fields or use factory methods

**Issue**: "Unknown environment preset"
**Solution**: Check available presets: 'turnExecution', 'actionProcessing', 'promptGeneration'

**Issue**: "Empty mock configuration"
**Solution**: `createMockConfiguration` returns `{}` for unsupported mock types. Double-check the `mockType` spelling and run `TestConfigurationValidator.validateMockConfiguration()` to receive descriptive errors.

### Debugging Tips

1. Use validation methods to check configurations before use
2. Check test output for configuration details in the frozen `config` property
3. Use `console.log(TestConfigurationFactory.getPresets())` to see available presets
4. Ensure you're importing from the correct paths

## Future Enhancements

- Additional LLM strategies (e.g., 'streaming', 'multi-modal')
- More environment presets for specialized testing scenarios
- Configuration versioning for backward compatibility
- Performance profiling and optimization tools
- Configuration inheritance and composition patterns
