# LLM Prompting and Communication Workflow Analysis

## Executive Summary

This report provides a comprehensive analysis of how the Living Narrative Engine builds prompts and communicates with Large Language Models (LLMs) through a proxy server architecture. The system uses a sophisticated pipeline that transforms game state into structured prompts, sends them to various LLM providers, and processes the responses for AI-driven character actions.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prompt Generation Pipeline](#prompt-generation-pipeline)
3. [LLM Adapter Architecture](#llm-adapter-architecture)
4. [Proxy Server Communication](#proxy-server-communication)
5. [Tool Calling and Schema System](#tool-calling-and-schema-system)
6. [Configuration Management](#configuration-management)
7. [Implementation Examples](#implementation-examples)
8. [Key Workflows](#key-workflows)
9. [Extension Points](#extension-points)

## Architecture Overview

The LLM integration system consists of several key components:

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  AIPromptPipeline   │────▶│ ConfigurableLLMAdapter│────▶│ LLM Proxy Server    │
│                     │     │                     │     │ (Node.js Service)   │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
         │                           │                            │
         ▼                           ▼                            ▼
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│ Game State Provider │     │ Strategy Factory    │     │ OpenRouter/OpenAI   │
│ Content Provider    │     │ Request Executor    │     │ Anthropic APIs      │
│ Prompt Builder      │     │ Error Mapper        │     └─────────────────────┘
└─────────────────────┘     └─────────────────────┘
```

## Prompt Generation Pipeline

### 1. Pipeline Entry Point

The prompt generation begins in `AIPromptPipeline` (src/prompting/AIPromptPipeline.js):

```javascript
async generatePrompt(actor, context, availableActions) {
    // 1. Get current LLM configuration
    const currentLlmId = await this.#llmAdapter.getCurrentActiveLlmId();

    // 2. Build game state (without actions)
    const gameStateDto = await this.#gameStateProvider.buildGameState(
        actor,
        context,
        this.#logger
    );

    // 3. Add indexed actions to the DTO
    const promptDto = { ...gameStateDto, availableActions };

    // 4. Get prompt content
    const promptData = await this.#promptContentProvider.getPromptData(
        promptDto,
        this.#logger
    );

    // 5. Build final prompt string
    const finalPromptString = await this.#promptBuilder.build(
        currentLlmId,
        promptData
    );

    return finalPromptString;
}
```

### 2. Game State Building

The `AIGameStateProvider` collects all relevant game information:

- Actor details (name, personality, memories)
- Current location and environment
- Perception log entries
- Short-term memory/thoughts
- Notes and goals
- Relationships and closeness values

### 3. Content Assembly

The `AIPromptContentProvider` transforms game state into prompt sections:

- Task definition text
- Character persona (formatted with markdown)
- World context
- Indexed action choices
- Final instructions

### 4. Template Processing

The `PromptBuilder` uses a fixed template structure:

```xml
<task_definition>
{task definition content}
</task_definition>

<character_persona>
{character details}
</character_persona>

<world_context>
{environment description}
</world_context>

<perception_log>
{recent observations}
</perception_log>

<thoughts>
{character thoughts}
</thoughts>

<notes>
{character notes}
</notes>

<available_actions_info>
{indexed action list}
</available_actions_info>

<final_instructions>
{instructions for response format}
</final_instructions>

<content_policy>
{content guidelines}
</content_policy>
```

### 5. Action Indexing

Actions are presented in a numbered format:

```
index: 1 --> wait (Wait and observe your surroundings)
index: 2 --> go north (Move to Market Square)
index: 3 --> say (Say something out loud)
```

## LLM Adapter Architecture

### 1. ConfigurableLLMAdapter

The main adapter (src/turns/adapters/configurableLLMAdapter.js) coordinates:

- Configuration management
- API key retrieval
- Token validation
- Strategy selection
- Request execution

### 2. Modular Services

```javascript
constructor({
  logger,
  environmentContext,
  apiKeyProvider,
  llmStrategyFactory,
  configurationManager,
  requestExecutor,
  errorMapper,
  tokenEstimator,
});
```

### 3. Request Flow

```javascript
async getAIDecision(gameSummary, abortSignal) {
    // 1. Get active configuration
    const activeConfig = await this.#configurationManager.getActiveConfiguration();

    // 2. Validate configuration
    const validationErrors = this.#configurationManager.validateConfiguration(activeConfig);

    // 3. Check token limits
    await this.#validateTokenLimit(gameSummary, activeConfig);

    // 4. Get API key
    const apiKey = await this.#getApiKeyForConfig(activeConfig);

    // 5. Create strategy
    const strategy = this.#createStrategy(activeConfig);

    // 6. Execute request
    const result = await this.#requestExecutor.executeRequest({
        strategy,
        gameSummary,
        llmConfig: activeConfig,
        apiKey,
        environmentContext: this.#environmentContext,
        abortSignal
    });

    return result;
}
```

## Proxy Server Communication

### 1. Environment Detection

The system detects execution environment:

- **Client-side (Browser)**: Routes through proxy server
- **Server-side (Node.js)**: Direct API calls

### 2. Client-Side Proxy Flow

```javascript
// In BaseOpenRouterStrategy
if (environmentContext.isClient()) {
  targetUrl = environmentContext.getProxyServerUrl(); // http://localhost:3001/api/llm-request
  finalPayload = {
    llmId: llmConfig.configId,
    targetPayload: providerRequestPayload,
    targetHeaders: llmConfig.providerSpecificHeaders || {},
  };
}
```

### 3. Server-Side Direct Flow

```javascript
if (!environmentContext.isClient()) {
  targetUrl = llmConfig.endpointUrl; // https://openrouter.ai/api/v1/chat/completions
  headers['Authorization'] = `Bearer ${apiKey}`;
}
```

### 4. HTTP Request Execution

```javascript
const responseData = await this.#httpClient.request(targetUrl, {
  method: 'POST',
  headers,
  body: JSON.stringify(finalPayload),
  abortSignal,
});
```

## Tool Calling and Schema System

### 1. Schema Definition

The system uses a structured schema for LLM responses (src/turns/schemas/llmOutputSchemas.js):

```javascript
export const LLM_TURN_ACTION_RESPONSE_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
        chosenIndex: {
            type: 'integer',
            minimum: 1
        },
        speech: {
            type: 'string'
        },
        thoughts: {
            type: 'string'
        },
        notes: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    text: { type: 'string', minLength: 1 },
                    subject: { type: 'string', minLength: 1 },
                    subjectType: { type: 'string', enum: [...] },
                    context: { type: 'string' },
                    tags: { type: 'array', items: { type: 'string' } }
                },
                required: ['text', 'subject', 'subjectType']
            }
        }
    },
    required: ['chosenIndex', 'speech', 'thoughts']
};
```

### 2. Tool Calling Strategy

For OpenRouter tool calling (src/llms/strategies/openRouterToolCallingStrategy.js):

```javascript
_buildProviderRequestPayloadAdditions(baseMessagesPayload, llmConfig) {
    const configuredToolName = llmConfig.jsonOutputStrategy?.toolName;

    const tool = {
        type: 'function',
        function: {
            name: configuredToolName, // Dynamic from config
            description: OPENROUTER_DEFAULT_TOOL_DESCRIPTION,
            parameters: toolParametersSchema
        }
    };

    return {
        tools: [tool],
        tool_choice: { type: 'function', function: { name: tool.function.name } }
    };
}
```

### 3. Response Extraction

```javascript
async _extractJsonOutput(responseData, llmConfig) {
    const message = responseData?.choices?.[0]?.message;
    const expectedToolName = llmConfig.jsonOutputStrategy?.toolName;

    if (message.tool_calls && Array.isArray(message.tool_calls)) {
        const toolCall = message.tool_calls[0];
        const extractedJsonString = toolCall.function.arguments.trim();
        return extractedJsonString;
    }
}
```

## Configuration Management

### 1. LLM Configuration Structure

Example from config/llm-configs.json:

```json
{
  "defaultConfigId": "openrouter-claude-sonnet-4-toolcalling",
  "configs": {
    "openrouter-claude-sonnet-4-toolcalling": {
      "configId": "openrouter-claude-sonnet-4-toolcalling",
      "displayName": "Claude Sonnet 4 (OpenRouter - Tool Calling)",
      "apiKeyEnvVar": "OPENROUTER_API_KEY_ENV_VAR",
      "apiKeyFileName": "openrouter_api_key.txt",
      "endpointUrl": "https://openrouter.ai/api/v1/chat/completions",
      "modelIdentifier": "anthropic/claude-sonnet-4",
      "apiType": "openrouter",
      "jsonOutputStrategy": {
        "method": "openrouter_tool_calling",
        "toolName": "function_call"
      },
      "defaultParameters": {
        "temperature": 1.0
      },
      "providerSpecificHeaders": {
        "HTTP-Referer": "https://my-text-adventure-game.com",
        "X-Title": "Living Narrative Engine"
      },
      "contextTokenLimit": 200000
    }
  }
}
```

### 2. JSON Output Strategies

The system supports two main strategies:

- **Tool Calling**: Uses OpenAI-style function calling
- **JSON Schema**: Direct JSON schema validation

### 3. Dynamic Configuration

```javascript
// Switch LLM at runtime
await llmAdapter.setActiveLlm('openrouter-claude-sonnet-4');

// Get available options
const options = await llmAdapter.getAvailableLlmOptions();
```

## Implementation Examples

### Example 1: Adding a New Prompt Section

To add a new section to prompts:

1. Modify the prompt content provider to include the new data
2. Update the prompt template in PromptBuilder
3. Add the section to the assembly order

### Example 2: Creating a Custom LLM Strategy

```javascript
class CustomLLMStrategy extends BaseLLMStrategy {
  async execute(params) {
    const { gameSummary, llmConfig, apiKey } = params;

    // Build custom payload
    const payload = {
      prompt: gameSummary,
      model: llmConfig.modelIdentifier,
      // Custom parameters
    };

    // Make API call
    const response = await this.httpClient.request(llmConfig.endpointUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
    });

    // Extract and return JSON
    return this.extractCustomResponse(response);
  }
}
```

### Example 3: Implementing an Agentic System

For agentic systems, you can:

1. **Multi-turn Conversations**: Store conversation history in the prompt
2. **Tool Use**: Extend the schema to include tool invocations
3. **Planning**: Add a planning phase before action selection
4. **Memory Management**: Implement long-term memory storage

```javascript
// Extended schema for agentic response
const AGENTIC_RESPONSE_SCHEMA = {
  ...LLM_TURN_ACTION_RESPONSE_SCHEMA,
  properties: {
    ...LLM_TURN_ACTION_RESPONSE_SCHEMA.properties,
    plan: {
      type: 'array',
      items: { type: 'string' },
    },
    toolInvocations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tool: { type: 'string' },
          parameters: { type: 'object' },
        },
      },
    },
  },
};
```

## Key Workflows

### 1. Complete Decision Flow

```
User Input → Turn System → AIPromptPipeline → PromptBuilder
    ↓                                              ↓
Available Actions ← Action Resolver         Final Prompt
    ↓                                              ↓
LLM Response ← LLM Adapter ← Proxy Server ← LLM Provider
    ↓
Action Execution ← Response Processor
```

### 2. Error Handling Chain

The system includes comprehensive error handling:

- **PromptTooLongError**: When tokens exceed limits
- **ConfigurationError**: Invalid LLM configurations
- **LLMStrategyError**: Strategy execution failures
- **ApiKeyError**: Missing or invalid API keys
- **MalformedResponseError**: Invalid JSON responses

### 3. Token Management

```javascript
// Token budget calculation
const tokenBudget = this.#tokenEstimator.getTokenBudget(
  activeConfig.contextTokenLimit,
  maxTokensForOutput
);

// Validation
const validationResult = await this.#tokenEstimator.validateTokenLimit(
  gameSummary,
  tokenBudget.availableForPrompt,
  activeConfig.modelIdentifier
);
```

## Extension Points

### 1. Adding New LLM Providers

1. Create a new strategy extending `BaseLLMStrategy`
2. Register in `LLMStrategyFactory`
3. Add configuration in llm-configs.json
4. Implement provider-specific request/response handling

### 2. Custom Prompt Templates

1. Extend `PromptBuilder` with new template logic
2. Add configuration for template selection
3. Implement placeholder resolution

### 3. Enhanced Response Processing

1. Extend `LLMResponseProcessor` for custom validation
2. Add new schema definitions
3. Implement custom extraction logic

### 4. Agentic Capabilities

1. **Planning Module**: Add pre-action planning phase
2. **Tool Integration**: Define tools and invocation schemas
3. **Memory Systems**: Implement episodic/semantic memory
4. **Multi-Agent**: Support multiple AI actors coordinating

## Conclusion

The Living Narrative Engine's LLM integration provides a robust, extensible framework for AI-driven narrative experiences. The modular architecture allows for easy extension while maintaining clean separation of concerns. The proxy server pattern enables secure client-side execution, and the strategy pattern supports multiple LLM providers.

Key strengths:

- Clean architecture with dependency injection
- Flexible configuration system
- Robust error handling
- Token management
- Schema-based validation
- Multi-provider support

This foundation can be extended to support more sophisticated agentic behaviors, multi-turn planning, and complex narrative generation systems.
