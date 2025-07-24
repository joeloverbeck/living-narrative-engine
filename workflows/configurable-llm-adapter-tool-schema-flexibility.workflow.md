# Configurable LLM Adapter Tool Schema Flexibility - Implementation Workflow

## Executive Summary

This workflow implements request-time schema injection for the Configurable LLM Adapter, enabling multiple tool calling schemas instead of the hardcoded game AI action schema. This enhancement allows features like character builder thematic direction generation to use reliable tool calling with custom schemas while maintaining complete backward compatibility.

**Key Benefits:**

- Configuration agnosticism - llm-configs.json remains purely about connections
- Request-time flexibility - each request can specify its own schema
- No configuration coupling - LLM configs are not tied to specific use cases
- Backward compatibility - no disruption to existing functionality
- Clear separation of concerns - schema definition happens at the point of use

## Architecture Overview

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
LLMRequestExecutor
    ↓
OpenRouterToolCallingStrategy
    ↓
Uses request schema or falls back to default
```

## Phase 1: Interface Updates (Days 1-2)

**Focus**: Update core interfaces to support request options

### 1.1 Update ILLMAdapter Interface

**Estimated Time**: 2 hours  
**Priority**: High  
**Dependencies**: None

**Tasks:**

- [ ] Modify `getAIDecision` method signature in `src/turns/interfaces/ILLMAdapter.js`
- [ ] Add optional `requestOptions` parameter with JSDoc types
- [ ] Document request options structure:
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
  ```
- [ ] Ensure backward compatibility by making parameter optional

**Validation Criteria:**

- Interface compiles without errors
- JSDoc types are properly defined
- Method signature maintains backward compatibility

### 1.2 Update LLMRequestExecutor Interface

**Estimated Time**: 1 hour  
**Priority**: High  
**Dependencies**: 1.1

**Tasks:**

- [ ] Modify `executeRequest` method in `src/llms/interfaces/ILLMRequestExecutor.js`
- [ ] Add request options to method signature
- [ ] Update JSDoc types and documentation
- [ ] Define request options validation requirements

**Validation Criteria:**

- Interface properly extends with request options
- Type definitions are accurate and complete

### 1.3 Create Request Options Types

**Estimated Time**: 1 hour  
**Priority**: Medium  
**Dependencies**: 1.1, 1.2

**Tasks:**

- [ ] Create comprehensive JSDoc typedef for request options
- [ ] Add validation helpers for request options structure
- [ ] Document schema validation requirements
- [ ] Create example schemas for reference

**Validation Criteria:**

- Type definitions are comprehensive and accurate
- Validation helpers work correctly
- Documentation is clear and complete

## Phase 2: Core Implementation (Days 2-5)

**Focus**: Implement request options handling in core services

### 2.1 Update ConfigurableLLMAdapter

**Estimated Time**: 4 hours  
**Priority**: Critical  
**Dependencies**: Phase 1

**Tasks:**

- [ ] Modify `getAIDecision` method in `src/turns/adapters/configurableLLMAdapter.js`
- [ ] Accept optional `requestOptions` parameter
- [ ] Add request options validation:
  ```javascript
  #validateRequestOptions(requestOptions) {
    if (!requestOptions) return; // Optional parameter

    if (requestOptions.toolSchema && typeof requestOptions.toolSchema !== 'object') {
      throw new Error('toolSchema must be an object');
    }

    if (requestOptions.toolName && typeof requestOptions.toolName !== 'string') {
      throw new Error('toolName must be a string');
    }

    if (requestOptions.toolDescription && typeof requestOptions.toolDescription !== 'string') {
      throw new Error('toolDescription must be a string');
    }
  }
  ```
- [ ] Pass request options to request executor
- [ ] Add comprehensive logging for request options usage
- [ ] Update method implementation:

  ```javascript
  async getAIDecision(gameSummary, abortSignal = undefined, requestOptions = {}) {
    this.#ensureInitialized();

    // Validate request options
    this.#validateRequestOptions(requestOptions);

    this.#logger.debug('ConfigurableLLMAdapter.getAIDecision → called', {
      promptChars: gameSummary ? gameSummary.length : 0,
      abortSignalProvided: !!abortSignal,
      hasRequestOptions: Object.keys(requestOptions).length > 0,
      hasCustomSchema: !!requestOptions.toolSchema,
    });

    // ... existing code ...

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

**Validation Criteria:**

- Method accepts request options without breaking existing callers
- Request options are properly validated
- Comprehensive logging is implemented
- All existing functionality remains intact

### 2.2 Update LLMRequestExecutor

**Estimated Time**: 2 hours  
**Priority**: High  
**Dependencies**: 2.1

**Tasks:**

- [ ] Modify `executeRequest` method in `src/llms/services/llmRequestExecutor.js`
- [ ] Accept request options parameter
- [ ] Pass request options to strategy during payload building
- [ ] Update validation and error handling:

  ```javascript
  async executeRequest(options) {
    const {
      strategy,
      gameSummary,
      llmConfig,
      apiKey,
      environmentContext,
      abortSignal,
      requestOptions = {} // NEW: Accept request options
    } = options;

    this.#logger.debug('LLMRequestExecutor: Executing request', {
      configId: llmConfig.configId,
      strategyMethod: llmConfig.jsonOutputStrategy?.method,
      hasAbortSignal: !!abortSignal,
      hasRequestOptions: Object.keys(requestOptions).length > 0,
    });

    // ... existing abort signal handling ...

    const result = await strategy.execute({
      gameSummary,
      llmConfig,
      apiKey,
      environmentContext,
      abortSignal,
      requestOptions, // NEW: Pass request options to strategy
    });

    return result;
  }
  ```

**Validation Criteria:**

- Request options are properly passed through to strategies
- Logging includes request options information
- Error handling accounts for request options

### 2.3 Update OpenRouterToolCallingStrategy

**Estimated Time**: 6 hours  
**Priority**: Critical  
**Dependencies**: 2.2

**Tasks:**

- [ ] Update `buildProviderRequestPayload` method in `src/llms/strategies/openRouterToolCallingStrategy.js`
- [ ] Accept request options parameter
- [ ] Modify `_buildProviderRequestPayloadAdditions` to use custom schemas:

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

- [ ] Update `_extractJsonOutput` method to handle dynamic tool names
- [ ] Implement comprehensive validation for custom schemas
- [ ] Add detailed logging for schema precedence and usage
- [ ] Maintain fallback to default game AI schema

**Validation Criteria:**

- Custom schemas are properly used when provided
- Tool name precedence works correctly (request > config)
- Default schema fallback functions properly
- Comprehensive validation prevents invalid schemas
- Detailed logging provides clear troubleshooting information

## Phase 3: Strategy Pattern Enhancement (Days 5-6)

**Focus**: Ensure all strategies support request options

### 3.1 Update Base Strategy Classes

**Estimated Time**: 3 hours  
**Priority**: Medium  
**Dependencies**: Phase 2

**Tasks:**

- [ ] Update `src/llms/strategies/base/baseLLMStrategy.js`
- [ ] Update `src/llms/strategies/base/baseOpenRouterStrategy.js`
- [ ] Update `src/llms/strategies/base/baseChatLLMStrategy.js`
- [ ] Modify method signatures to accept request options
- [ ] Add default parameter handling
- [ ] Update JSDoc documentation

**Validation Criteria:**

- All base classes consistently handle request options
- Method signatures are updated across inheritance hierarchy
- Default parameters work correctly

### 3.2 Update Other Strategy Implementations

**Estimated Time**: 2 hours  
**Priority**: Low  
**Dependencies**: 3.1

**Tasks:**

- [ ] Review `src/llms/strategies/openRouterJsonSchemaStrategy.js`
- [ ] Update if request options support is beneficial
- [ ] Ensure consistent request options handling across all strategies
- [ ] Add logging and validation where appropriate

**Validation Criteria:**

- All strategies have consistent interfaces
- No strategy breaks due to request options addition
- Appropriate logging is implemented

## Phase 4: Service Integration (Days 6-7)

**Focus**: Update consuming services to use new request options

### 4.1 Update ThematicDirectionGenerator

**Estimated Time**: 4 hours  
**Priority**: High  
**Dependencies**: Phase 3

**Tasks:**

- [ ] Modify `#callLLM` method in `src/characterBuilder/services/thematicDirectionGenerator.js`
- [ ] Implement request options usage:

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

- [ ] Test integration with character builder
- [ ] Verify schema compatibility with existing response validation

**Validation Criteria:**

- ThematicDirectionGenerator successfully uses custom tool schema
- Character builder integration works end-to-end
- Response validation continues to work correctly

### 4.2 Identify Other Potential Users

**Estimated Time**: 2 hours  
**Priority**: Medium  
**Dependencies**: 4.1

**Tasks:**

- [ ] Search codebase for other services that could benefit from tool calling
- [ ] Document opportunities for future migration from JSON schema to tool calling
- [ ] Create migration roadmap for other features
- [ ] Identify services using `llmJsonService` that could switch to tool calling

**Validation Criteria:**

- Comprehensive list of potential migration candidates
- Clear migration roadmap for future phases
- Documentation of benefits for each candidate service

## Phase 5: Testing Implementation (Days 8-10)

**Focus**: Comprehensive testing coverage

### 5.1 Unit Tests - ConfigurableLLMAdapter

**Estimated Time**: 6 hours  
**Priority**: Critical  
**Dependencies**: Phase 4

**Tasks:**

- [ ] Create/update `tests/unit/turns/adapters/configurableLLMAdapter.test.js`
- [ ] Test with request options containing custom schema:
  ```javascript
  describe('ConfigurableLLMAdapter - Request Options', () => {
    it('should accept and use custom request options', async () => {
      const requestOptions = {
        toolSchema: {
          type: 'object',
          properties: { test: { type: 'string' } },
        },
        toolName: 'custom_tool',
        toolDescription: 'Custom tool description',
      };

      const result = await adapter.getAIDecision(prompt, null, requestOptions);

      expect(mockRequestExecutor.executeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          requestOptions: expect.objectContaining(requestOptions),
        })
      );
    });
  });
  ```
- [ ] Test without request options (backward compatibility)
- [ ] Test request options validation and error handling
- [ ] Test request options propagation to executor
- [ ] Test invalid request options scenarios

**Validation Criteria:**

- All test cases pass consistently
- Coverage includes both success and error scenarios
- Backward compatibility is thoroughly tested

### 5.2 Unit Tests - OpenRouterToolCallingStrategy

**Estimated Time**: 6 hours  
**Priority**: Critical  
**Dependencies**: 5.1

**Tasks:**

- [ ] Create/update `tests/unit/llms/strategies/openRouterToolCallingStrategy.test.js`
- [ ] Test with custom schema in request options
- [ ] Test without custom schema (backward compatibility)
- [ ] Test with invalid custom schema
- [ ] Test custom tool name and description
- [ ] Test precedence of request options over config
- [ ] Test tool validation with dynamic tool names

**Validation Criteria:**

- Schema precedence works correctly in all scenarios
- Tool validation handles dynamic names properly
- Error handling covers all edge cases
- Default fallback behavior is preserved

### 5.3 Unit Tests - LLMRequestExecutor

**Estimated Time**: 2 hours  
**Priority**: High  
**Dependencies**: 5.2

**Tasks:**

- [ ] Update `tests/unit/llms/services/llmRequestExecutor.test.js`
- [ ] Test request options propagation to strategy
- [ ] Test with and without request options
- [ ] Validate error handling scenarios

**Validation Criteria:**

- Request options are properly passed through
- No regression in existing functionality
- Error scenarios are handled correctly

### 5.4 Integration Tests

**Estimated Time**: 4 hours  
**Priority**: High  
**Dependencies**: 5.3

**Tasks:**

- [ ] Create `tests/integration/llms/requestTimeSchemaInjection.integration.test.js`
- [ ] Update `tests/integration/characterBuilder/thematicDirectionGeneration.integration.test.js`
- [ ] Test character builder integration with request-time schema
- [ ] Verify correct schema usage in API requests
- [ ] Validate response parsing with custom schema
- [ ] Test game AI backward compatibility
- [ ] Test end-to-end workflow with various schemas

**Validation Criteria:**

- Complete character builder flow works with new tool calling
- Game AI functionality remains unchanged
- Schema injection works correctly end-to-end
- Response parsing handles various schema types

## Phase 6: Documentation & Examples (Days 10-11)

**Focus**: Documentation and usage examples

### 6.1 API Documentation

**Estimated Time**: 3 hours  
**Priority**: Medium  
**Dependencies**: Phase 5

**Tasks:**

- [ ] Update JSDoc comments throughout codebase
- [ ] Document new request options parameter
- [ ] Create usage examples for different scenarios:

  ```javascript
  // Example 1: Character builder usage
  const requestOptions = {
    toolSchema: THEMATIC_DIRECTIONS_RESPONSE_SCHEMA,
    toolName: 'generate_thematic_directions',
    toolDescription: 'Generate thematic directions for character development',
  };
  const response = await llmAdapter.getAIDecision(prompt, null, requestOptions);

  // Example 2: Custom schema usage
  const customSchema = {
    type: 'object',
    properties: {
      analysis: { type: 'string', description: 'Analysis result' },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
    },
    required: ['analysis', 'confidence'],
  };
  const requestOptions = {
    toolSchema: customSchema,
    toolName: 'analyze_content',
    toolDescription: 'Analyze content and provide confidence score',
  };
  ```

- [ ] Update README sections if applicable
- [ ] Create inline code documentation

**Validation Criteria:**

- Documentation is comprehensive and accurate
- Examples are clear and functional
- JSDoc types are properly defined throughout

### 6.2 Migration Guide

**Estimated Time**: 2 hours  
**Priority**: Medium  
**Dependencies**: 6.1

**Tasks:**

- [ ] Create migration guide document
- [ ] Document how to migrate from JSON schema to tool calling
- [ ] Provide examples of common schema patterns
- [ ] Create troubleshooting guide for common issues
- [ ] Document performance considerations
- [ ] Explain when to use tool calling vs JSON schema

**Validation Criteria:**

- Migration guide is clear and actionable
- Common patterns are well documented
- Troubleshooting covers likely issues

### 6.3 Schema Examples

**Estimated Time**: 2 hours  
**Priority**: Low  
**Dependencies**: 6.2

**Tasks:**

- [ ] Create example schemas for common use cases
- [ ] Document schema validation patterns
- [ ] Provide best practices guide
- [ ] Create schema template library

**Validation Criteria:**

- Schema examples are valid and useful
- Best practices are clearly explained
- Templates are reusable and well-documented

## Phase 7: Validation & Rollout (Days 11-12)

**Focus**: Final validation and gradual rollout

### 7.1 End-to-End Testing

**Estimated Time**: 4 hours  
**Priority**: Critical  
**Dependencies**: Phase 6

**Tasks:**

- [ ] Test complete character builder flow with new tool calling
- [ ] Validate game AI continues to work unchanged
- [ ] Test error scenarios and recovery
- [ ] Test with various LLM configurations
- [ ] Validate schema validation edge cases
- [ ] Test abort signal handling with request options

**Validation Criteria:**

- All critical paths work correctly
- No regression in existing functionality
- Error handling is robust
- Performance is acceptable

### 7.2 Performance Testing

**Estimated Time**: 2 hours  
**Priority**: Medium  
**Dependencies**: 7.1

**Tasks:**

- [ ] Measure impact of request options processing
- [ ] Validate no significant performance regression
- [ ] Test with various schema sizes
- [ ] Benchmark tool calling vs JSON schema approaches
- [ ] Monitor memory usage patterns

**Validation Criteria:**

- No significant performance degradation
- Memory usage remains stable
- Tool calling performance is comparable to JSON schema

### 7.3 Rollout Preparation

**Estimated Time**: 2 hours  
**Priority**: Medium  
**Dependencies**: 7.2

**Tasks:**

- [ ] Prepare rollout checklist
- [ ] Create monitoring and alerting if needed
- [ ] Document rollback procedures
- [ ] Prepare feature toggle if applicable
- [ ] Create deployment validation tests

**Validation Criteria:**

- Rollout plan is comprehensive
- Monitoring covers key metrics
- Rollback procedures are tested

## Success Criteria

### Primary Objectives

- [ ] ThematicDirectionGenerator successfully uses custom tool schema
- [ ] Existing game AI functionality remains completely unchanged
- [ ] All unit and integration tests pass
- [ ] No performance regression detected
- [ ] Clean separation between LLM configs and use-case schemas maintained
- [ ] Documentation is complete and accurate

### Technical Requirements

- [ ] Request-time schema injection works for all supported LLM configurations
- [ ] Schema validation prevents invalid configurations
- [ ] Error handling provides clear, actionable messages
- [ ] Logging supports effective troubleshooting
- [ ] Backward compatibility is maintained for all existing code

### Quality Gates

- [ ] Code coverage >80% for all modified files
- [ ] No linting errors or warnings
- [ ] All type definitions are accurate and complete
- [ ] Performance benchmarks meet requirements
- [ ] Integration tests pass consistently

## Risk Mitigation

### Technical Risks

- **Risk**: Breaking existing functionality  
  **Mitigation**: Comprehensive backward compatibility testing and gradual rollout

- **Risk**: Performance regression  
  **Mitigation**: Performance benchmarking and monitoring throughout development

- **Risk**: Schema validation complexity  
  **Mitigation**: Robust validation with clear error messages and extensive testing

### Process Risks

- **Risk**: Integration complexity  
  **Mitigation**: Phase-based approach with validation at each step

- **Risk**: Testing coverage gaps  
  **Mitigation**: Comprehensive test strategy covering unit, integration, and end-to-end scenarios

## Dependencies

### Internal Dependencies

- **No external library changes**: All implementation uses existing codebase patterns
- **No configuration file changes**: llm-configs.json remains unchanged
- **No breaking API changes**: All existing interfaces remain compatible

### External Dependencies

- **LLM Provider Compatibility**: OpenRouter tool calling API must support dynamic tool schemas
- **Schema Format**: JSON Schema format must be compatible with OpenAI tool calling specification

## Monitoring & Observability

### Key Metrics

- Request options usage frequency
- Schema validation success/failure rates
- Performance impact measurements
- Error rates by schema type

### Logging Strategy

- Debug: Schema selection decisions and validation details
- Info: Request options usage patterns
- Warn: Schema validation warnings and fallbacks
- Error: Schema validation failures and processing errors

## Timeline Summary

**Total Duration**: 12 days (2.4 weeks)

- **Days 1-2**: Interface updates and foundations
- **Days 3-5**: Core implementation (critical path)
- **Days 6-7**: Strategy enhancement and service integration
- **Days 8-10**: Comprehensive testing
- **Days 11-12**: Documentation, validation, and rollout

## Conclusion

This workflow provides a comprehensive roadmap for implementing request-time schema injection in the Configurable LLM Adapter. The approach maintains strict backward compatibility while enabling powerful new capabilities for features requiring custom tool schemas. The phased implementation minimizes risk while ensuring thorough testing and documentation throughout the process.

The implementation will unlock reliable tool calling for character builder thematic direction generation and establish a pattern for future features requiring structured LLM outputs, all while keeping LLM configurations completely agnostic to specific use cases.
