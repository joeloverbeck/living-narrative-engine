# TRAREW-006: Implement TraitsRewriterResponseProcessor Service

## Priority: 🔥 HIGH

**Phase**: 2 - Core Business Logic  
**Story Points**: 3  
**Estimated Time**: 3-4 hours

## Problem Statement

The TraitsRewriterResponseProcessor handles the critical task of parsing, validating, and processing LLM responses for trait rewriting. It ensures response quality, validates against expected schemas, sanitizes content for safe display, and handles error recovery scenarios.

## Requirements

1. Parse LLM responses safely with comprehensive error handling
2. Validate responses against TRAITS_REWRITER_RESPONSE_SCHEMA
3. Verify trait completeness and content quality
4. Sanitize trait content for secure display
5. Handle partial responses and malformed JSON
6. Provide detailed error reporting and recovery options

## Acceptance Criteria

- [ ] **JSON Parsing**: Safe parsing with fallback for malformed JSON
- [ ] **Schema Validation**: Uses `TRAITS_REWRITER_RESPONSE_SCHEMA` for validation
- [ ] **Content Verification**: Ensures all requested traits are present and valid
- [ ] **Content Sanitization**: HTML escaping and XSS prevention
- [ ] **Error Recovery**: Handles partial responses and validation failures
- [ ] **Integration**: Works seamlessly with `llmJsonService` patterns
- [ ] **Architecture Compliance**: Follows codebase patterns (private fields, validation)

## Implementation Details

### File to Create

**Path**: `/src/characterBuilder/services/TraitsRewriterResponseProcessor.js`

### Core Interface

```javascript
/**
 * @file TraitsRewriterResponseProcessor - LLM response processing and validation
 * @description Handles parsing, validation, and sanitization of trait rewriting responses
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { TRAITS_REWRITER_RESPONSE_SCHEMA, DEFAULT_TRAIT_KEYS } from '../prompts/traitsRewriterPrompts.js';
import { TraitsRewriterError, TRAITS_REWRITER_ERROR_CODES } from '../errors/TraitsRewriterError.js';

export class TraitsRewriterResponseProcessor {
  // Private fields following codebase patterns
  /** @private @type {ILogger} */
  #logger;

  /** @private @type {LlmJsonService} */
  #llmJsonService;

  /** @private @type {ISchemaValidator} */
  #schemaValidator;

  constructor(dependencies) {
    // Validate all dependencies using codebase pattern
    this.#validateDependencies(dependencies);

    this.#logger = dependencies.logger;
    this.#llmJsonService = dependencies.llmJsonService;
    this.#schemaValidator = dependencies.schemaValidator;

    this.#logger.info('TraitsRewriterResponseProcessor: Initialized successfully');
  }

  /**
   * Main entry point for response processing
   * @param {string|object} llmResponse - Raw LLM response
   * @param {object} originalCharacterData - Original character definition
   * @returns {Promise<object>} Processed and validated traits
   */
  async processResponse(llmResponse, originalCharacterData) {
    // Implementation details...
  }

  // Private processing methods
  #parseJsonResponse(responseText)
  #validateResponseSchema(parsedResponse)
  #verifyTraitCompleteness(response, originalTraits)
  #sanitizeTraitContent(traits)
  #handleProcessingErrors(error, context)
  #extractOriginalTraits(characterData)
  #validateDependencies(dependencies)
}
```

### Key Methods Implementation

#### 1. processResponse()

Main processing workflow:

- Parse JSON response safely with error handling
- Validate against schema using `schemaValidator`
- Verify trait completeness against original character data
- Sanitize all trait content for safe display
- Handle errors with detailed context
- Return processed trait data

#### 2. #parseJsonResponse()

Safe JSON parsing:

- Use `llmJsonService.parseAndValidateResponse()` when available
- Implement fallback parsing with error recovery
- Handle malformed JSON with partial extraction
- Log parsing issues with helpful context

#### 3. #validateResponseSchema()

Schema validation:

- Use `TRAITS_REWRITER_RESPONSE_SCHEMA` from prompts
- Validate response structure and field types
- Check required fields and optional fields
- Provide detailed validation error messages

#### 4. #verifyTraitCompleteness()

Content verification:

- Compare requested traits vs received traits
- Validate trait content quality and length
- Check for empty or placeholder content
- Ensure first-person voice transformation

#### 5. #sanitizeTraitContent()

Content sanitization:

- HTML escaping for safe display
- XSS prevention measures
- Content length validation
- Character encoding normalization

## Dependencies

**Blocking**:

- TRAREW-004 (Application Startup Verified)
- TraitsRewriterError class (created in TRAREW-009)

**External Dependencies**:

- `TRAITS_REWRITER_RESPONSE_SCHEMA` from `traitsRewriterPrompts.js` ✅
- Schema validation infrastructure ✅
- LLM JSON service infrastructure ✅

**Required Services** (via DI):

- `ILogger` - Logging service
- `LlmJsonService` - JSON parsing and validation utilities
- `ISchemaValidator` - Schema validation service

## Testing Requirements

### Unit Tests

Create `/tests/unit/characterBuilder/services/TraitsRewriterResponseProcessor.test.js`:

```javascript
describe('TraitsRewriterResponseProcessor', () => {
  describe('Constructor Validation', () => {
    it('should validate all required dependencies');
    it('should throw error for missing dependencies');
  });

  describe('JSON Parsing', () => {
    it('should parse valid JSON responses');
    it('should handle malformed JSON gracefully');
    it('should extract partial data from broken responses');
    it('should use llmJsonService for parsing when available');
  });

  describe('Schema Validation', () => {
    it('should validate responses against schema');
    it('should reject invalid response structures');
    it('should provide detailed validation errors');
  });

  describe('Content Verification', () => {
    it('should verify all requested traits are present');
    it('should detect missing or empty traits');
    it('should validate first-person voice transformation');
  });

  describe('Content Sanitization', () => {
    it('should escape HTML content safely');
    it('should prevent XSS attacks');
    it('should normalize character encodings');
  });

  describe('Error Recovery', () => {
    it('should handle partial responses');
    it('should recover from validation failures');
    it('should provide meaningful error messages');
  });
});
```

### Test Data

```javascript
// Valid response example
const validResponse = {
  characterName: 'Test Character',
  rewrittenTraits: {
    'core:personality':
      'I am analytical and methodical in my approach to problems.',
    'core:likes': 'I enjoy reading books and solving complex puzzles.',
  },
  generatedAt: '2024-01-15T10:30:00Z',
};

// Invalid response examples
const malformedJson = '{"characterName": "Test", "rewritten'; // Truncated
const invalidSchema = { name: 'Test' }; // Wrong structure
const partialResponse = { characterName: 'Test', rewrittenTraits: {} }; // Missing traits
```

## Validation Steps

### Step 1: Service Creation

```javascript
const processor = container.resolve(tokens.TraitsRewriterResponseProcessor);
expect(processor).toBeDefined();
```

### Step 2: Valid Response Processing

```javascript
const result = await processor.processResponse(
  validResponse,
  originalCharacterData
);
expect(result).toHaveProperty('characterName');
expect(result).toHaveProperty('rewrittenTraits');
```

### Step 3: Error Handling Test

```javascript
await expect(
  processor.processResponse(malformedJson, originalCharacterData)
).rejects.toThrow(TraitsRewriterError);
```

## Files Modified

### New Files

- `/src/characterBuilder/services/TraitsRewriterResponseProcessor.js` - Main service

### Dependencies Referenced

- `/src/characterBuilder/prompts/traitsRewriterPrompts.js` ✅ (exists)
- `/src/characterBuilder/errors/TraitsRewriterError.js` (created in TRAREW-009)

## Response Processing Workflow

### 1. Input Validation

- Verify llmResponse is not null/undefined
- Confirm originalCharacterData is valid
- Log processing start with context

### 2. JSON Parsing

```javascript
let parsedResponse;
try {
  // Try llmJsonService first (preferred)
  parsedResponse = await this.#llmJsonService.parseAndValidateResponse(
    llmResponse,
    TRAITS_REWRITER_RESPONSE_SCHEMA
  );
} catch (error) {
  // Fallback to manual parsing
  parsedResponse = this.#parseJsonResponse(llmResponse);
}
```

### 3. Schema Validation

```javascript
const validationResult = this.#schemaValidator.validate(
  parsedResponse,
  TRAITS_REWRITER_RESPONSE_SCHEMA
);

if (!validationResult.valid) {
  throw new TraitsRewriterError(
    'Response schema validation failed',
    TRAITS_REWRITER_ERROR_CODES.VALIDATION_FAILED,
    { errors: validationResult.errors }
  );
}
```

### 4. Content Processing

- Extract and verify trait completeness
- Sanitize all trait content
- Validate first-person voice transformation
- Check content quality and length

### 5. Error Recovery

- Handle missing traits with partial processing
- Recover from sanitization issues
- Provide actionable error messages
- Log detailed error context

## Content Sanitization Approach

### HTML Escaping

```javascript
#escapeHtmlContent(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
```

### XSS Prevention

- Strip script tags and event handlers
- Validate content length limits
- Check for suspicious patterns
- Sanitize URLs and links

### Content Quality Checks

- Minimum content length validation
- First-person voice verification
- Coherence and readability checks
- Language and tone appropriateness

## Error Handling Strategy

### Error Categories

- **RESPONSE_PROCESSING_FAILED**: JSON parsing errors
- **VALIDATION_FAILED**: Schema validation failures
- **INCOMPLETE_RESPONSE**: Missing or partial traits
- **SANITIZATION_FAILED**: Content cleaning errors

### Error Context

Each error includes:

- Original response data (sanitized)
- Processing step where error occurred
- Character name and traits being processed
- Specific validation failures or parsing issues

### Recovery Options

- Partial processing for salvageable responses
- Retry suggestions for transient failures
- Fallback content for missing traits
- User guidance for resolution

## Performance Considerations

### Parsing Optimization

- Stream processing for large responses
- Efficient JSON parsing libraries
- Memory management for large trait sets

### Validation Efficiency

- Schema compilation and caching
- Batch validation where possible
- Early validation exit on critical errors

### Sanitization Performance

- Efficient regex patterns
- Minimal string operations
- Bulk content processing

## Success Metrics

- **Parsing Success**: Handles valid and invalid JSON correctly
- **Schema Compliance**: Validates against expected response structure
- **Content Safety**: All output is XSS-safe and properly sanitized
- **Error Recovery**: Graceful handling of malformed responses
- **Integration**: Works seamlessly with TraitsRewriterGenerator
- **Performance**: Processes responses efficiently without memory leaks

## Next Steps

After completion:

- **TRAREW-007**: Implement TraitsRewriterDisplayEnhancer
- **TRAREW-005**: Integration with TraitsRewriterGenerator
- **TRAREW-012**: Comprehensive unit testing

## Implementation Checklist

- [ ] Create service file with proper imports
- [ ] Implement constructor with dependency validation
- [ ] Implement processResponse() main method
- [ ] Implement JSON parsing with error handling
- [ ] Implement schema validation logic
- [ ] Implement trait completeness verification
- [ ] Implement content sanitization methods
- [ ] Implement comprehensive error handling
- [ ] Add XSS prevention measures
- [ ] Add performance optimizations
- [ ] Create comprehensive unit tests
- [ ] Test with various response scenarios
- [ ] Validate error recovery mechanisms
- [ ] Document security considerations
