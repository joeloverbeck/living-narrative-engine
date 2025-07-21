# Prompt Validation Extraction Specification

## Overview

This specification outlines the extraction of prompt validation logic from the monolithic `ConfigurableLLMAdapter` into a dedicated `PromptValidationService`. This refactoring addresses the architectural issues identified in the E2E workflow analysis report and improves modularity, testability, and extensibility.

## Current State Analysis

### Existing Validation Logic

1. **Token Validation**
   - Location: `src/llms/services/tokenEstimator.js`
   - Usage: Called by `ConfigurableLLMAdapter.#validateTokenLimit()`
   - Timing: After prompt generation (late validation)

2. **Game State Validation**
   - Location: `src/prompting/services/gameStateValidationServiceForPrompting.js`
   - Usage: Validates AI game state DTOs during content generation
   - Scope: Basic field presence checks

3. **Configuration Validation**
   - Location: `src/llms/services/validators/llmConfigSemanticValidator.js`
   - Usage: Validates LLM configuration structure
   - Timing: During configuration loading

### Problems with Current Approach

1. **Late Validation**: Token validation happens after expensive prompt generation
2. **Limited Scope**: No structural or content validation for prompts
3. **Scattered Logic**: Validation spread across multiple services
4. **Tight Coupling**: Validation logic embedded in `ConfigurableLLMAdapter`
5. **No Early Failure**: Can't detect issues before prompt assembly

## Proposed Architecture

### Service Interface

```javascript
// src/prompting/interfaces/IPromptValidator.js
export const IPromptValidator = Symbol('IPromptValidator');

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {Array<ValidationError>} errors - List of validation errors
 * @property {Object} metadata - Additional validation metadata
 * @property {number} metadata.estimatedTokens - Estimated token count
 * @property {number} metadata.maxTokens - Maximum allowed tokens
 */

/**
 * @typedef {Object} ValidationError
 * @property {string} code - Error code (e.g., 'TOKENS_EXCEEDED', 'MISSING_SECTION')
 * @property {string} message - Human-readable error message
 * @property {string} field - Field/section that failed validation
 * @property {Object} context - Additional error context
 */

/**
 * @interface IPromptValidator
 */
```

### Implementation Structure

```javascript
// src/prompting/services/promptValidationService.js
class PromptValidationService {
  constructor({
    tokenEstimator, // ITokenEstimator
    schemaValidator, // IAjvSchemaValidator
    logger, // ILogger
    eventBus, // IEventBus
  }) {
    // Initialize with validated dependencies
  }

  // Pre-generation validation
  async validatePromptPlan(template, context, llmConfig) {}

  // Post-generation validation
  async validateGeneratedPrompt(prompt, llmConfig) {}

  // Provider-specific validation
  async validateForProvider(prompt, provider) {}

  // Composite validation result
  async validateComplete(prompt, template, context, llmConfig) {}
}
```

### Validation Rules

#### 1. Token Validation Rules

```javascript
class TokenValidationRules {
  // Maximum tokens including buffer
  validateTokenLimit(text, llmConfig) {}

  // Token budget estimation
  estimateTokenBudget(template, context, llmConfig) {}

  // Multi-model token validation
  validateAcrossModels(text, models) {}
}
```

#### 2. Structure Validation Rules

```javascript
class StructureValidationRules {
  // Required sections present
  validateRequiredSections(prompt, template) {}

  // Section ordering
  validateSectionOrder(prompt, template) {}

  // Section format compliance
  validateSectionFormat(prompt, schema) {}
}
```

#### 3. Content Validation Rules

```javascript
class ContentValidationRules {
  // No unresolved placeholders
  validatePlaceholders(prompt) {}

  // Valid action references
  validateActionReferences(prompt, availableActions) {}

  // Character encoding
  validateEncoding(prompt) {}
}
```

#### 4. Provider-Specific Rules

```javascript
class ProviderValidationRules {
  // OpenRouter specific
  validateOpenRouterFormat(prompt, config) {}

  // JSON output validation
  validateJSONOutputFormat(prompt, schema) {}

  // Tool calling format
  validateToolCallingFormat(prompt, tools) {}
}
```

## Integration Points

### 1. AIPromptPipeline Integration

```javascript
// Before generation
async generatePrompt(actor, availableActions) {
  // Early validation
  const planValidation = await this.#promptValidator.validatePromptPlan(
    this.#template,
    { actor, availableActions },
    this.#llmConfig
  );

  if (!planValidation.valid) {
    throw new PromptValidationError('Pre-generation validation failed', planValidation.errors);
  }

  // Generate prompt...
  const prompt = await this.#buildPrompt(actor, availableActions);

  // Post-generation validation
  const promptValidation = await this.#promptValidator.validateGeneratedPrompt(
    prompt,
    this.#llmConfig
  );

  if (!promptValidation.valid) {
    throw new PromptValidationError('Post-generation validation failed', promptValidation.errors);
  }

  return prompt;
}
```

### 2. ConfigurableLLMAdapter Integration

```javascript
// Simplified adapter without validation logic
async getAIDecision(prompt, options = {}) {
  // Delegate validation to service
  const validation = await this.#promptValidator.validateComplete(
    prompt,
    this.#template,
    options.context,
    this.#activeConfig
  );

  if (!validation.valid) {
    this.#handleValidationFailure(validation);
  }

  // Proceed with LLM call...
}
```

### 3. Dependency Injection Updates

```javascript
// src/dependencyInjection/registrations/registerPrompting.js
export function registerPrompting(container) {
  // ... existing registrations ...

  // Register prompt validator
  container.register(tokens.IPromptValidator, PromptValidationService, {
    lifecycle: Lifecycle.Singleton,
    inject: [
      tokens.ITokenEstimator,
      tokens.IAjvSchemaValidator,
      tokens.ILogger,
      tokens.IEventBus,
    ],
  });
}
```

## Error Handling

### Custom Validation Errors

```javascript
// src/prompting/errors/promptValidationError.js
export class PromptValidationError extends Error {
  constructor(message, errors, code = 'PROMPT_VALIDATION_FAILED') {
    super(message);
    this.name = 'PromptValidationError';
    this.code = code;
    this.errors = errors;
  }
}

// Specific validation errors
export class PromptTooLongError extends PromptValidationError {
  constructor(tokenCount, maxTokens) {
    super(
      `Prompt exceeds token limit: ${tokenCount} > ${maxTokens}`,
      [
        {
          code: 'TOKENS_EXCEEDED',
          field: 'prompt',
          context: { tokenCount, maxTokens },
        },
      ],
      'PROMPT_TOO_LONG'
    );
  }
}

export class PromptStructureError extends PromptValidationError {
  constructor(missingSections) {
    super(
      `Prompt missing required sections: ${missingSections.join(', ')}`,
      missingSections.map((section) => ({
        code: 'MISSING_SECTION',
        field: section,
        message: `Required section '${section}' not found`,
      })),
      'INVALID_STRUCTURE'
    );
  }
}
```

### Event Dispatching

```javascript
// Validation failure events
{
  type: 'PROMPT_VALIDATION_FAILED',
  payload: {
    validationType: 'pre-generation|post-generation|complete',
    errors: [...],
    context: { actor, template, config }
  }
}

// Validation metrics events
{
  type: 'PROMPT_VALIDATION_COMPLETED',
  payload: {
    duration: 123,
    tokenCount: 1500,
    rulesChecked: 12,
    passed: true
  }
}
```

## Testing Strategy

### Unit Tests

```javascript
// tests/unit/prompting/services/promptValidationService.test.js
describe('PromptValidationService', () => {
  describe('validatePromptPlan', () => {
    it('should pass when token estimate is within limits', async () => {});
    it('should fail when token estimate exceeds limits', async () => {});
    it('should validate required context fields', async () => {});
  });

  describe('validateGeneratedPrompt', () => {
    it('should validate token count accurately', async () => {});
    it('should detect unresolved placeholders', async () => {});
    it('should validate section structure', async () => {});
  });

  describe('validateForProvider', () => {
    it('should apply OpenRouter-specific rules', async () => {});
    it('should validate JSON schema compliance', async () => {});
  });
});
```

### Integration Tests

```javascript
// tests/integration/prompting/promptValidation.integration.test.js
describe('Prompt Validation Integration', () => {
  it('should integrate with AIPromptPipeline', async () => {});
  it('should integrate with ConfigurableLLMAdapter', async () => {});
  it('should dispatch appropriate events', async () => {});
});
```

### Test Helpers

```javascript
// tests/common/helpers/promptValidationTestHelper.js
export class PromptValidationTestHelper {
  static createValidPrompt() {}
  static createPromptWithPlaceholders() {}
  static createOversizedPrompt(tokenCount) {}
  static createPromptMissingSection(section) {}
}
```

## Migration Plan

### Phase 1: Create Service Infrastructure (2 days)

1. Create interface definition
2. Implement PromptValidationService shell
3. Create validation rule classes
4. Add custom error types
5. Write unit tests

### Phase 2: Implement Validation Rules (3 days)

1. Port token validation from ConfigurableLLMAdapter
2. Implement structure validation
3. Implement content validation
4. Add provider-specific rules
5. Complete test coverage

### Phase 3: Integration (2 days)

1. Update AIPromptPipeline to use validator
2. Refactor ConfigurableLLMAdapter
3. Update dependency injection
4. Run integration tests

### Phase 4: Migration & Cleanup (1 day)

1. Remove old validation code
2. Update documentation
3. Performance testing
4. Deploy and monitor

## Performance Considerations

### Optimization Strategies

1. **Validation Caching**

   ```javascript
   class ValidationCache {
     // Cache validation results for identical inputs
     getCachedResult(prompt, config) {}
     cacheResult(prompt, config, result, ttl = 300) {}
   }
   ```

2. **Lazy Validation**
   - Only run expensive validations when necessary
   - Skip provider-specific validation if not using that provider

3. **Parallel Validation**
   - Run independent validation rules in parallel
   - Aggregate results efficiently

### Performance Targets

- Pre-generation validation: < 10ms
- Post-generation validation: < 50ms
- Complete validation: < 100ms
- Memory overhead: < 1MB per validation

## Extensibility

### Adding New Validation Rules

```javascript
// Example: Adding a custom validation rule
class CustomValidationRule {
  validate(prompt, context) {
    // Custom validation logic
    return {
      valid: true,
      errors: [],
    };
  }
}

// Register with service
promptValidator.addRule('custom', new CustomValidationRule());
```

### Provider Plugin System

```javascript
// Provider-specific validation plugin
class AnthropicValidationPlugin {
  getValidationRules() {
    return [new AnthropicTokenRule(), new AnthropicFormatRule()];
  }
}
```

## Success Criteria

1. **Functional Requirements**
   - All existing validation logic preserved
   - Early validation prevents expensive operations
   - Clear validation error messages
   - Support for multiple LLM providers

2. **Non-Functional Requirements**
   - < 100ms total validation time
   - 95%+ test coverage
   - Reduced ConfigurableLLMAdapter size by 100+ lines
   - Simplified test setup

3. **Quality Metrics**
   - Validation service < 300 lines
   - Each validation rule < 50 lines
   - Clear separation of concerns
   - Easy to add new rules

## References

- E2E Workflow Architecture Analysis Report
- CLAUDE.md project guidelines
- Existing validation implementations
- LLM provider documentation
