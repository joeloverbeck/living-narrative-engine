# Configurable LLM Adapter Tool Schema Flexibility Specification

## 1. Executive Summary

This specification outlines the necessary changes to make the Configurable LLM Adapter support multiple tool calling schemas instead of being hardcoded to use only the game AI action schema. This enhancement will enable the LLM system to be used for various purposes beyond game turn actions, such as character builder thematic directions, world generation, and other structured outputs.

## 2. Problem Statement

### Current Limitations

The `OpenRouterToolCallingStrategy` is currently hardcoded to use `OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA` for all tool calling operations. This creates several issues:

1. **Single Schema Limitation**: The strategy can only handle game turn actions with fields like `chosenIndex`, `speech`, and `thoughts`
2. **Incompatible Use Cases**: Other features like thematic direction generation fail because they expect different response structures
3. **Lack of Flexibility**: No way to specify custom schemas for different use cases
4. **Configuration Coupling**: Any solution that modifies llm-configs.json would couple generic LLM configurations to specific use cases

### Impact

- Character builder thematic direction generation fails with schema mismatch errors
- Future features requiring structured outputs cannot use the reliable tool calling approach
- Developers are forced to use less reliable JSON schema methods as workarounds

## 3. Proposed Solution

### 3.1 High-Level Architecture

The solution involves implementing request-time schema injection, where custom tool schemas are passed as part of the request options rather than being stored in LLM configurations. This keeps llm-configs.json completely agnostic to specific use cases.

```
Service Layer (e.g., ThematicDirectionGenerator)
    ↓
getAIDecision(prompt, signal, requestOptions)
    ↓
requestOptions: {
    toolSchema: { /* custom schema */ },
    toolName: "custom_function",
    toolDescription: "Custom description"
}
    ↓
ConfigurableLLMAdapter
    ↓
OpenRouterToolCallingStrategy
    ↓
Uses request schema or falls back to default
```

### 3.2 Design Principles

1. **Configuration Agnosticism**: llm-configs.json remains purely about LLM connection details
2. **Request-Time Flexibility**: Schemas are specified at the point of use, not in configuration
3. **Backward Compatibility**: Existing code without request options continues to work
4. **Clear Separation**: LLM configuration layer is unaware of specific use case schemas

## 4. Implementation Details

### 4.1 Interface Changes

#### 4.1.1 ILLMAdapter Interface Update

Update the `getAIDecision` method signature to accept optional request options:

```javascript
/**
 * @param {string} prompt - The prompt to send to the LLM
 * @param {AbortSignal} [abortSignal] - Optional abort signal
 * @param {object} [requestOptions] - Optional request-specific options
 * @param {object} [requestOptions.toolSchema] - Custom tool schema for this request
 * @param {string} [requestOptions.toolName] - Custom tool name for this request
 * @param {string} [requestOptions.toolDescription] - Custom tool description for this request
 * @returns {Promise<string>} The AI's response
 */
async getAIDecision(prompt, abortSignal, requestOptions)
```

#### 4.1.2 No Changes to LLM Configuration Schema

The llm-configs.schema.json remains unchanged. The `jsonOutputStrategy` continues to only specify the method and default tool name:

```json
{
  "jsonOutputStrategy": {
    "type": "object",
    "description": "Defines the strategy for ensuring JSON output from the LLM.",
    "properties": {
      "method": {
        "type": "string",
        "description": "The method to use for enforcing JSON output."
      },
      "toolName": {
        "type": "string",
        "description": "Required if 'method' is 'tool_calling' or 'openrouter_tool_calling'. The name of the tool the LLM should call."
      }
    },
    "required": ["method"],
    "allOf": [
      {
        "if": {
          "properties": {
            "method": {
              "enum": ["tool_calling", "openrouter_tool_calling"]
            }
          }
        },
        "then": {
          "required": ["toolName"]
        }
      }
    ]
  }
}
```

### 4.2 Code Changes

#### 4.2.1 ConfigurableLLMAdapter Modifications

Update the `getAIDecision` method to accept and pass request options:

```javascript
async getAIDecision(gameSummary, abortSignal = undefined, requestOptions = {}) {
  this.#ensureInitialized();
  this.#logger.debug('ConfigurableLLMAdapter.getAIDecision → called', {
    promptChars: gameSummary ? gameSummary.length : 0,
    abortSignalProvided: !!abortSignal,
    hasRequestOptions: Object.keys(requestOptions).length > 0,
  });

  // Get active configuration
  const activeConfig = await this.#configurationManager.getActiveConfiguration();
  if (!activeConfig) {
    const msg = 'No active LLM configuration is set. Use setActiveLlm() or ensure a valid defaultConfigId is in the dependencyInjection file.';
    this.#logger.error(`ConfigurableLLMAdapter.getAIDecision: ${msg}`);
    throw new ConfigurationError(msg, { llmId: null });
  }

  // Browser-side prompt logging (existing code)
  try {
    if (this.#environmentContext.isClient()) {
      const modelName = activeConfig.modelIdentifier || activeConfig.configId || 'unknown';
      this.#logger.info(`[PromptLog][Model: ${modelName}] Final prompt sent to proxy:\n${gameSummary}`);
    }
  } catch {
    /* never block on logging */
  }

  // Pass request options to the request executor
  const response = await this.#requestExecutor.execute(
    gameSummary,
    activeConfig,
    abortSignal,
    requestOptions // NEW: Pass request options through
  );

  return response;
}
```

#### 4.2.2 LLMRequestExecutor Modifications

Update to pass request options to the strategy:

```javascript
async execute(prompt, llmConfig, abortSignal, requestOptions = {}) {
  // ... existing validation code ...

  // Get the appropriate strategy
  const strategy = this.#strategyFactory.getStrategy(llmConfig);

  // Build provider request payload with request options
  const payload = await strategy.buildProviderRequestPayload(
    prompt,
    llmConfig,
    requestOptions // NEW: Pass request options to strategy
  );

  // ... rest of existing code ...
}
```

#### 4.2.3 OpenRouterToolCallingStrategy Modifications

Update to accept request options and use them when building the payload:

```javascript
async buildProviderRequestPayload(prompt, llmConfig, requestOptions = {}) {
  const basePayload = await super.buildProviderRequestPayload(prompt, llmConfig, requestOptions);
  const additions = this._buildProviderRequestPayloadAdditions(
    basePayload,
    llmConfig,
    requestOptions // NEW: Pass request options
  );
  return { ...basePayload, ...additions };
}

_buildProviderRequestPayloadAdditions(baseMessagesPayload, llmConfig, requestOptions = {}) {
  const llmId = getLlmId(llmConfig);

  // Determine tool name: request option overrides config
  const toolName = requestOptions.toolName || llmConfig.jsonOutputStrategy?.toolName;

  // Validation for toolName
  if (!toolName || typeof toolName !== 'string' || toolName.trim() === '') {
    const errorMsg = `${this.constructor.name} (${llmId}): Missing or invalid 'toolName'. Must be provided in either request options or llmConfig.jsonOutputStrategy.`;
    this.logger.error(errorMsg, { llmId });
    throw new LLMStrategyError(errorMsg, llmId);
  }

  // Determine tool schema: request option overrides default
  let toolParametersSchema;
  if (requestOptions.toolSchema) {
    // Use request-specific schema
    toolParametersSchema = requestOptions.toolSchema;
    this.logger.debug(
      `${this.constructor.name} (${llmId}): Using custom tool schema from request options.`,
      { llmId, schemaProperties: Object.keys(toolParametersSchema.properties || {}) }
    );
  } else {
    // Fall back to default game AI schema
    toolParametersSchema =
      OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA.schema ||
      OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA;
    this.logger.debug(
      `${this.constructor.name} (${llmId}): No custom tool schema provided, using default game AI schema.`,
      { llmId }
    );
  }

  // Determine tool description: request option overrides default
  const toolDescription = requestOptions.toolDescription || OPENROUTER_DEFAULT_TOOL_DESCRIPTION;

  // Validate schema structure
  if (!toolParametersSchema || typeof toolParametersSchema !== 'object') {
    this.logger.error(
      `${this.constructor.name} (${llmId}): Invalid tool parameters schema. Expected an object.`,
      { llmId, toolParametersSchema }
    );
    throw new LLMStrategyError(`Invalid tool parameters schema.`, llmId);
  }

  const tool = {
    type: 'function',
    function: {
      name: toolName,
      description: toolDescription,
      parameters: toolParametersSchema,
    },
  };

  this.logger.debug(
    `${this.constructor.name} (${llmId}): Defined tool for use with name '${toolName}'.`,
    {
      llmId,
      toolName: tool.function.name,
      isCustomSchema: !!requestOptions.toolSchema,
    }
  );

  return {
    tools: [tool],
    tool_choice: { type: 'function', function: { name: tool.function.name } },
  };
}
```

### 4.3 Usage Examples

#### 4.3.1 ThematicDirectionGenerator Usage

The ThematicDirectionGenerator passes custom schema at request time:

```javascript
async #callLLM(prompt, llmConfigId) {
  try {
    // Set active LLM configuration if specified
    if (llmConfigId) {
      const success = await this.#llmConfigManager.setActiveConfiguration(llmConfigId);
      if (!success) {
        const config = await this.#llmConfigManager.loadConfiguration(llmConfigId);
        if (!config) {
          throw new Error(`LLM configuration not found: ${llmConfigId}`);
        }
      }
    }

    // Get the current active configuration
    const activeConfig = await this.#llmConfigManager.getActiveConfiguration();
    if (!activeConfig) {
      throw new Error('No active LLM configuration found.');
    }

    // Prepare request options with custom schema
    const requestOptions = {
      toolSchema: THEMATIC_DIRECTIONS_RESPONSE_SCHEMA,
      toolName: 'generate_thematic_directions',
      toolDescription: 'Generate thematic directions for character development based on the provided concept'
    };

    // Use the ConfigurableLLMAdapter with request options
    const response = await this.#llmStrategyFactory.getAIDecision(
      prompt,
      null, // no abort signal
      requestOptions
    );

    this.#logger.debug('ThematicDirectionGenerator: Received LLM response', {
      responseLength: response.length,
      modelId: activeConfig.configId,
    });

    return response;
  } catch (error) {
    throw new ThematicDirectionGenerationError(
      `LLM request failed: ${error.message}`,
      error
    );
  }
}
```

#### 4.3.2 Generic LLM Configuration (No Changes)

The llm-configs.json remains completely agnostic to specific use cases:

```json
{
  "openrouter-claude-sonnet-4-toolcalling": {
    "configId": "openrouter-claude-sonnet-4-toolcalling",
    "displayName": "Claude Sonnet 4 (OpenRouter - Tool Calling)",
    "apiKeyEnvVar": "OPENROUTER_API_KEY_ENV_VAR",
    "endpointUrl": "https://openrouter.ai/api/v1/chat/completions",
    "modelIdentifier": "anthropic/claude-sonnet-4",
    "apiType": "openrouter",
    "jsonOutputStrategy": {
      "method": "openrouter_tool_calling",
      "toolName": "function_call"
    },
    "defaultParameters": {
      "temperature": 1.0
    }
  }
}
```

#### 4.3.3 Game AI Usage (Backward Compatible)

Existing game AI code continues to work without changes, using the default schema:

```javascript
// No request options = uses default game AI schema
const response = await llmAdapter.getAIDecision(prompt, abortSignal);
```

## 5. Testing Strategy

### 5.1 Unit Tests

1. **ConfigurableLLMAdapter Tests**
   - Test with request options containing custom schema
   - Test without request options (backward compatibility)
   - Test request options propagation to executor

2. **OpenRouterToolCallingStrategy Tests**
   - Test with custom schema in request options
   - Test without custom schema (backward compatibility)
   - Test with invalid custom schema
   - Test with custom description in request options
   - Test precedence of request options over config

3. **LLMRequestExecutor Tests**
   - Test request options propagation to strategy
   - Test with and without request options

### 5.2 Integration Tests

1. **Character Builder Integration**
   - Test thematic direction generation with request-time schema
   - Verify correct schema is used in API requests
   - Validate response parsing with custom schema

2. **Game AI Integration**
   - Ensure existing game AI continues to work without changes
   - Verify default schema is used when no request options provided

### 5.3 Test File Locations

```
tests/unit/turns/adapters/configurableLLMAdapter.test.js
tests/unit/llms/strategies/openRouterToolCallingStrategy.test.js
tests/unit/llms/services/llmRequestExecutor.test.js
tests/integration/characterBuilder/thematicDirectionGeneration.integration.test.js
tests/integration/llms/requestTimeSchemaInjection.integration.test.js
```

## 6. Migration Path

### 6.1 Phase 1: Implementation (No Breaking Changes)

1. Update ConfigurableLLMAdapter to accept request options
2. Update LLMRequestExecutor to propagate request options
3. Update OpenRouterToolCallingStrategy to use request options
4. All existing code continues to work unchanged

### 6.2 Phase 2: Adoption

1. Update ThematicDirectionGenerator to use request options
2. Remove any schema-related logic from prompt configuration
3. Document the new capability for other features
4. Monitor for any issues

### 6.3 Phase 3: Expansion

1. Identify other features that could benefit from tool calling
2. Implement request-time schema injection for each use case
3. Gradually migrate from JSON schema to tool calling where beneficial

## 7. Benefits

1. **Configuration Agnosticism**: llm-configs.json remains purely about connections
2. **Request-Time Flexibility**: Each request can specify its own schema
3. **No Configuration Coupling**: LLM configs are not tied to specific use cases
4. **Backward Compatibility**: No disruption to existing functionality
5. **Clear Separation of Concerns**: Schema definition happens at the point of use

## 8. Potential Future Enhancements

1. **Schema Registry**: Central registry of common schemas (without coupling to configs)
2. **Schema Versioning**: Support for schema evolution at the request level
3. **Request Options Builder**: Helper utilities for building request options
4. **Schema Validation**: Pre-flight validation of request schemas
5. **Response Transformation**: Transform tool responses to match expected formats

## 9. Key Design Decisions

### Why Request-Time Schema Injection?

1. **Separation of Concerns**: LLM configuration should only concern itself with how to connect to an LLM service, not what schemas different features might need
2. **Flexibility**: Different features can use the same LLM configuration with different schemas
3. **No Configuration Proliferation**: Avoids creating multiple LLM configs for the same model just to use different schemas
4. **Runtime Control**: Services have full control over their schema requirements without touching configuration files

### Alternative Approaches Considered and Rejected

1. **Inline Schemas in llm-configs.json**: Would couple configurations to specific use cases
2. **Schema References in llm-configs.json**: Still couples configurations to schemas
3. **Multiple Configurations per Use Case**: Would lead to configuration proliferation and maintenance issues

## 10. Conclusion

This specification provides a clean solution for supporting multiple tool schemas while keeping LLM configurations completely agnostic to specific use cases. The request-time schema injection approach maintains clear separation of concerns, provides maximum flexibility, and ensures backward compatibility with existing code.
