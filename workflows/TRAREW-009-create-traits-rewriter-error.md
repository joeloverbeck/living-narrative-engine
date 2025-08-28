# TRAREW-009: Create TraitsRewriterError Class and Error Handling

## Priority: 🔥 HIGH

**Phase**: 2 - Core Business Logic  
**Story Points**: 1  
**Estimated Time**: 1-2 hours

## Problem Statement

The TraitsRewriter services need a comprehensive error handling system with domain-specific error types, consistent error codes, and detailed error context. This provides better debugging capabilities, user-friendly error messages, and standardized error handling across all TraitsRewriter components.

## Requirements

1. Create TraitsRewriterError class extending base Error
2. Define comprehensive error codes for all error scenarios
3. Support error context and metadata for debugging
4. Provide user-friendly error messages
5. Follow established error handling patterns in the codebase
6. Support error categorization and severity levels

## Acceptance Criteria

- [ ] **Error Class**: TraitsRewriterError extends Error with proper constructor
- [ ] **Error Codes**: Comprehensive set of error codes for all scenarios
- [ ] **Error Context**: Support for detailed error context and metadata
- [ ] **User Messages**: User-friendly error messages vs technical details
- [ ] **Pattern Adherence**: Follows existing error class patterns in codebase
- [ ] **Type Safety**: Proper TypeScript/JSDoc type definitions

## Implementation Details

### File to Create

**Path**: `/src/characterBuilder/errors/TraitsRewriterError.js`

### Core Error Class

```javascript
/**
 * @file TraitsRewriterError - Domain-specific error handling for trait rewriting
 * @description Custom error class with error codes and context for trait rewriting operations
 */

/**
 * Custom error class for trait rewriting operations
 * Extends base Error with additional context and error codes
 */
export class TraitsRewriterError extends Error {
  /**
   * Create a TraitsRewriterError
   * @param {string} message - Human-readable error message
   * @param {string} code - Error code from TRAITS_REWRITER_ERROR_CODES
   * @param {object} [context={}] - Additional error context and metadata
   * @param {Error} [cause] - Original error that caused this error
   */
  constructor(message, code, context = {}, cause = null) {
    super(message);

    // Set error name
    this.name = 'TraitsRewriterError';

    // Set error code
    this.code = code;

    // Set error context
    this.context = {
      timestamp: new Date().toISOString(),
      ...context,
    };

    // Set cause if provided
    if (cause) {
      this.cause = cause;
      this.stack += `\nCaused by: ${cause.stack}`;
    }

    // Ensure proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TraitsRewriterError);
    }
  }

  /**
   * Get user-friendly error message
   * @returns {string} User-friendly error message
   */
  getUserMessage() {
    return USER_ERROR_MESSAGES[this.code] || this.message;
  }

  /**
   * Get error severity level
   * @returns {string} Severity level (info, warning, error, critical)
   */
  getSeverity() {
    return ERROR_SEVERITY_MAP[this.code] || 'error';
  }

  /**
   * Convert error to JSON for logging/debugging
   * @returns {object} JSON representation of error
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      severity: this.getSeverity(),
      userMessage: this.getUserMessage(),
      stack: this.stack,
      timestamp: this.context.timestamp,
    };
  }

  /**
   * Create error from unknown error object
   * @param {any} error - Unknown error object
   * @param {string} defaultCode - Default error code to use
   * @param {object} context - Additional context
   * @returns {TraitsRewriterError} TraitsRewriterError instance
   */
  static from(
    error,
    defaultCode = TRAITS_REWRITER_ERROR_CODES.UNKNOWN_ERROR,
    context = {}
  ) {
    if (error instanceof TraitsRewriterError) {
      return error;
    }

    const message = error?.message || String(error) || 'Unknown error occurred';
    return new TraitsRewriterError(message, defaultCode, context, error);
  }
}
```

### Error Codes Definition

```javascript
/**
 * Comprehensive error codes for trait rewriting operations
 * @readonly
 * @enum {string}
 */
export const TRAITS_REWRITER_ERROR_CODES = {
  // Input validation errors
  INVALID_CHARACTER_DEFINITION: 'INVALID_CHARACTER_DEFINITION',
  MISSING_CHARACTER_DATA: 'MISSING_CHARACTER_DATA',
  INVALID_JSON_FORMAT: 'INVALID_JSON_FORMAT',
  MISSING_REQUIRED_TRAITS: 'MISSING_REQUIRED_TRAITS',

  // Generation process errors
  GENERATION_FAILED: 'GENERATION_FAILED',
  LLM_SERVICE_ERROR: 'LLM_SERVICE_ERROR',
  PROMPT_CREATION_FAILED: 'PROMPT_CREATION_FAILED',
  TOKEN_LIMIT_EXCEEDED: 'TOKEN_LIMIT_EXCEEDED',

  // Response processing errors
  RESPONSE_PROCESSING_FAILED: 'RESPONSE_PROCESSING_FAILED',
  INVALID_RESPONSE_FORMAT: 'INVALID_RESPONSE_FORMAT',
  SCHEMA_VALIDATION_FAILED: 'SCHEMA_VALIDATION_FAILED',
  INCOMPLETE_RESPONSE: 'INCOMPLETE_RESPONSE',

  // Display and export errors
  DISPLAY_FORMATTING_FAILED: 'DISPLAY_FORMATTING_FAILED',
  EXPORT_FAILED: 'EXPORT_FAILED',
  FILE_GENERATION_FAILED: 'FILE_GENERATION_FAILED',
  CONTENT_SANITIZATION_FAILED: 'CONTENT_SANITIZATION_FAILED',

  // Service errors
  SERVICE_INITIALIZATION_FAILED: 'SERVICE_INITIALIZATION_FAILED',
  DEPENDENCY_RESOLUTION_FAILED: 'DEPENDENCY_RESOLUTION_FAILED',

  // System errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
};
```

### User-Friendly Error Messages

```javascript
/**
 * User-friendly error messages mapped to error codes
 * These messages are safe to display to end users
 * @readonly
 */
const USER_ERROR_MESSAGES = {
  [TRAITS_REWRITER_ERROR_CODES.INVALID_CHARACTER_DEFINITION]:
    'The character definition format is not valid. Please check your JSON format and try again.',

  [TRAITS_REWRITER_ERROR_CODES.MISSING_CHARACTER_DATA]:
    'No character data provided. Please enter a character definition to rewrite traits.',

  [TRAITS_REWRITER_ERROR_CODES.INVALID_JSON_FORMAT]:
    'The character definition is not valid JSON. Please check for syntax errors and try again.',

  [TRAITS_REWRITER_ERROR_CODES.MISSING_REQUIRED_TRAITS]:
    'No traits found to rewrite. Please ensure your character definition includes personality traits.',

  [TRAITS_REWRITER_ERROR_CODES.GENERATION_FAILED]:
    'Failed to generate rewritten traits. Please try again or contact support if the problem persists.',

  [TRAITS_REWRITER_ERROR_CODES.LLM_SERVICE_ERROR]:
    'The AI service encountered an error. Please try again in a moment.',

  [TRAITS_REWRITER_ERROR_CODES.TOKEN_LIMIT_EXCEEDED]:
    'The character definition is too large to process. Please try with a shorter description.',

  [TRAITS_REWRITER_ERROR_CODES.SCHEMA_VALIDATION_FAILED]:
    'The generated response format is invalid. Please try generating again.',

  [TRAITS_REWRITER_ERROR_CODES.EXPORT_FAILED]:
    'Failed to export traits. Please try again or try a different export format.',

  [TRAITS_REWRITER_ERROR_CODES.NETWORK_ERROR]:
    'Network connection error. Please check your connection and try again.',

  [TRAITS_REWRITER_ERROR_CODES.TIMEOUT_ERROR]:
    'The request timed out. Please try again with a shorter character definition.',

  [TRAITS_REWRITER_ERROR_CODES.UNKNOWN_ERROR]:
    'An unexpected error occurred. Please try again or contact support if the problem persists.',
};
```

### Error Severity Mapping

```javascript
/**
 * Error severity levels mapped to error codes
 * Used for logging and alerting decisions
 * @readonly
 */
const ERROR_SEVERITY_MAP = {
  [TRAITS_REWRITER_ERROR_CODES.INVALID_CHARACTER_DEFINITION]: 'warning',
  [TRAITS_REWRITER_ERROR_CODES.MISSING_CHARACTER_DATA]: 'info',
  [TRAITS_REWRITER_ERROR_CODES.INVALID_JSON_FORMAT]: 'warning',
  [TRAITS_REWRITER_ERROR_CODES.MISSING_REQUIRED_TRAITS]: 'warning',
  [TRAITS_REWRITER_ERROR_CODES.GENERATION_FAILED]: 'error',
  [TRAITS_REWRITER_ERROR_CODES.LLM_SERVICE_ERROR]: 'error',
  [TRAITS_REWRITER_ERROR_CODES.PROMPT_CREATION_FAILED]: 'error',
  [TRAITS_REWRITER_ERROR_CODES.TOKEN_LIMIT_EXCEEDED]: 'warning',
  [TRAITS_REWRITER_ERROR_CODES.RESPONSE_PROCESSING_FAILED]: 'error',
  [TRAITS_REWRITER_ERROR_CODES.SCHEMA_VALIDATION_FAILED]: 'warning',
  [TRAITS_REWRITER_ERROR_CODES.EXPORT_FAILED]: 'error',
  [TRAITS_REWRITER_ERROR_CODES.SERVICE_INITIALIZATION_FAILED]: 'critical',
  [TRAITS_REWRITER_ERROR_CODES.NETWORK_ERROR]: 'warning',
  [TRAITS_REWRITER_ERROR_CODES.TIMEOUT_ERROR]: 'warning',
  [TRAITS_REWRITER_ERROR_CODES.UNKNOWN_ERROR]: 'error',
};
```

## Dependencies

**Blocking**:

- None (foundational component)

**Required By**:

- TRAREW-005 (TraitsRewriterGenerator) - Uses error class
- TRAREW-006 (TraitsRewriterResponseProcessor) - Uses error class
- TRAREW-007 (TraitsRewriterDisplayEnhancer) - Uses error class
- TRAREW-008 (TraitsRewriterController) - Uses error class

## Testing Requirements

### Unit Tests

Create `/tests/unit/characterBuilder/errors/TraitsRewriterError.test.js`:

```javascript
describe('TraitsRewriterError', () => {
  describe('Constructor', () => {
    it('should create error with message and code');
    it('should include timestamp in context');
    it('should support additional context data');
    it('should support cause error chaining');
    it('should maintain proper stack trace');
  });

  describe('Error Codes', () => {
    it('should have comprehensive error codes defined');
    it('should have no duplicate error codes');
    it('should have user messages for all error codes');
    it('should have severity levels for all error codes');
  });

  describe('User Messages', () => {
    it('should return user-friendly messages');
    it('should fallback to technical message when no user message');
    it('should not expose sensitive technical details');
  });

  describe('Severity Levels', () => {
    it('should return appropriate severity levels');
    it('should default to error severity for unknown codes');
    it('should support all severity levels (info, warning, error, critical)');
  });

  describe('JSON Serialization', () => {
    it('should serialize to complete JSON representation');
    it('should include all relevant error information');
    it('should be safe for logging and debugging');
  });

  describe('Static Methods', () => {
    it('should create TraitsRewriterError from unknown error');
    it('should preserve existing TraitsRewriterError instances');
    it('should handle null/undefined errors gracefully');
    it('should support default error codes');
  });
});
```

### Error Scenarios to Test

```javascript
// Test cases for different error scenarios
const testCases = [
  {
    name: 'Invalid JSON',
    code: TRAITS_REWRITER_ERROR_CODES.INVALID_JSON_FORMAT,
    context: { input: '{"invalid": json}' },
    expectedSeverity: 'warning',
  },
  {
    name: 'Generation failure',
    code: TRAITS_REWRITER_ERROR_CODES.GENERATION_FAILED,
    context: { characterName: 'Test', traitCount: 3 },
    expectedSeverity: 'error',
  },
  {
    name: 'Service initialization',
    code: TRAITS_REWRITER_ERROR_CODES.SERVICE_INITIALIZATION_FAILED,
    context: { service: 'TraitsRewriterGenerator' },
    expectedSeverity: 'critical',
  },
];
```

## Validation Steps

### Step 1: Error Class Creation

```javascript
const error = new TraitsRewriterError(
  'Test error message',
  TRAITS_REWRITER_ERROR_CODES.GENERATION_FAILED,
  { characterName: 'Test Character' }
);

expect(error).toBeInstanceOf(Error);
expect(error).toBeInstanceOf(TraitsRewriterError);
expect(error.code).toBe('GENERATION_FAILED');
```

### Step 2: User Message Test

```javascript
const userMessage = error.getUserMessage();
expect(userMessage).not.toContain('technical details');
expect(userMessage).toMatch(/user-friendly language/);
```

### Step 3: JSON Serialization Test

```javascript
const errorJson = error.toJSON();
expect(errorJson).toHaveProperty('name');
expect(errorJson).toHaveProperty('code');
expect(errorJson).toHaveProperty('context');
expect(errorJson).toHaveProperty('severity');
expect(errorJson).toHaveProperty('userMessage');
```

## Files Modified

### New Files

- `/src/characterBuilder/errors/TraitsRewriterError.js` - Complete error class

### Integration Usage

Services will use the error class like:

```javascript
import { TraitsRewriterError, TRAITS_REWRITER_ERROR_CODES } from '../errors/TraitsRewriterError.js';

// Throw specific error
throw new TraitsRewriterError(
  'Character definition validation failed',
  TRAITS_REWRITER_ERROR_CODES.INVALID_CHARACTER_DEFINITION,
  {
    characterName: characterData.name,
    validationErrors: validationResult.errors
  }
);

// Convert unknown error
catch (unknownError) {
  const traitsError = TraitsRewriterError.from(
    unknownError,
    TRAITS_REWRITER_ERROR_CODES.GENERATION_FAILED,
    { characterName, traitCount }
  );
  logger.error('Generation failed', traitsError.toJSON());
  throw traitsError;
}
```

## Error Context Guidelines

### Context Data Standards

```javascript
// Character-related context
{
  characterName: string,
  characterId?: string,
  traitTypes?: string[],
  traitCount?: number
}

// Service-related context
{
  service: string,
  method: string,
  dependencies?: string[],
  configuration?: object
}

// Request-related context
{
  requestId?: string,
  userId?: string,
  timestamp: string,
  retryCount?: number
}

// Technical context
{
  stackTrace?: string,
  errorCode?: string,
  httpStatus?: number,
  responseTime?: number
}
```

### Sensitive Data Handling

- Never include API keys, passwords, or tokens
- Sanitize user input before including in context
- Avoid logging full character definitions (use summaries)
- Redact personally identifiable information

## Logging Integration

### Service Integration

```javascript
// In service methods
try {
  // Service operation
} catch (error) {
  const traitsError = TraitsRewriterError.from(error, defaultCode, context);

  // Log with appropriate level based on severity
  const severity = traitsError.getSeverity();
  this.#logger[severity]('Operation failed', traitsError.toJSON());

  throw traitsError;
}
```

### Controller Integration

```javascript
// In controller methods
try {
  // Controller operation
} catch (error) {
  if (error instanceof TraitsRewriterError) {
    // Display user-friendly message
    this.#displayError(error.getUserMessage());

    // Log technical details
    this._getLogger().error('Controller operation failed', error.toJSON());
  } else {
    // Convert unknown error
    const traitsError = TraitsRewriterError.from(error);
    this.#displayError(traitsError.getUserMessage());
  }
}
```

## Success Metrics

- **Comprehensive Coverage**: All error scenarios have specific error codes
- **User Experience**: User-friendly error messages that don't expose technical details
- **Developer Experience**: Rich context and debugging information for developers
- **Integration**: Seamless integration with all TraitsRewriter services
- **Maintainability**: Easy to add new error types and modify error handling

## Next Steps

After completion:

- **TRAREW-005-008**: Use error class in all service implementations
- **TRAREW-010-017**: Include error scenarios in all test suites

## Implementation Checklist

- [ ] Create TraitsRewriterError class with proper Error inheritance
- [ ] Define comprehensive TRAITS_REWRITER_ERROR_CODES enum
- [ ] Create user-friendly error message mappings
- [ ] Define error severity level mappings
- [ ] Implement getUserMessage() method
- [ ] Implement getSeverity() method
- [ ] Implement toJSON() method for logging
- [ ] Implement static from() method for error conversion
- [ ] Add proper JSDoc documentation
- [ ] Create comprehensive unit tests
- [ ] Test error serialization and logging
- [ ] Validate integration patterns with services
- [ ] Document error handling guidelines
