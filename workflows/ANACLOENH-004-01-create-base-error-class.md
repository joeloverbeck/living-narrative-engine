# ANACLOENH-004-01: Create BaseError Class

## Overview
Create the foundational BaseError class that all other error types will inherit from, providing standardized error properties and methods.

## Parent Ticket
- ANACLOENH-004: Establish Error Handling Framework

## Current State
- Multiple error classes exist in `src/errors/` but no common base class
- Each error implements its own structure
- No standardized metadata like severity or recoverability

## Objectives
1. Create BaseError class with core properties
2. Implement serialization methods
3. Add abstract methods for subclasses
4. Ensure V8 stack trace capture

## Technical Requirements

### BaseError Implementation
```javascript
// Location: src/errors/BaseError.js
class BaseError extends Error {
  #code;
  #context;
  #timestamp;
  #severity;
  #recoverable;
  #correlationId;

  constructor(message, code, context = {}) {
    super(message);
    this.name = this.constructor.name;
    this.#code = code;
    this.#context = context;
    this.#timestamp = Date.now();
    this.#severity = this.getSeverity();
    this.#recoverable = this.isRecoverable();
    this.#correlationId = context.correlationId || this.#generateCorrelationId();

    // Capture stack trace for V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  // Abstract methods for subclasses
  getSeverity() {
    return 'error'; // Default severity
  }

  isRecoverable() {
    return false; // Default to non-recoverable
  }

  // Correlation ID generation
  #generateCorrelationId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Getters
  get code() { return this.#code; }
  get context() { return this.#context; }
  get timestamp() { return this.#timestamp; }
  get severity() { return this.#severity; }
  get recoverable() { return this.#recoverable; }
  get correlationId() { return this.#correlationId; }

  // Serialization
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.#code,
      context: this.#context,
      timestamp: this.#timestamp,
      severity: this.#severity,
      recoverable: this.#recoverable,
      correlationId: this.#correlationId,
      stack: this.stack
    };
  }

  toString() {
    return `${this.name}[${this.#code}]: ${this.message} (severity: ${this.#severity}, recoverable: ${this.#recoverable})`;
  }

  // Context helpers
  addContext(key, value) {
    this.#context[key] = value;
    return this;
  }

  getContext(key = null) {
    return key ? this.#context[key] : this.#context;
  }
}
```

### Export Configuration
```javascript
// At end of BaseError.js
export default BaseError;
export { BaseError };
```

## Implementation Steps

1. **Create BaseError.js file**
   - Implement the class structure above
   - Add JSDoc comments for all methods
   - Ensure private field encapsulation

2. **Add severity levels enum**
   ```javascript
   export const ErrorSeverity = {
     DEBUG: 'debug',
     INFO: 'info',
     WARNING: 'warning',
     ERROR: 'error',
     CRITICAL: 'critical'
   };
   ```

3. **Add error codes enum**
   ```javascript
   export const ErrorCode = {
     VALIDATION_ERROR: 'VALIDATION_ERROR',
     SERVICE_ERROR: 'SERVICE_ERROR',
     NETWORK_ERROR: 'NETWORK_ERROR',
     PERMISSION_ERROR: 'PERMISSION_ERROR',
     NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
     CONFLICT_ERROR: 'CONFLICT_ERROR',
     INTERNAL_ERROR: 'INTERNAL_ERROR'
   };
   ```

## File Changes

### New Files
- `src/errors/BaseError.js` - The base error class implementation

### Modified Files
None in this ticket - child classes will be updated in subsequent tickets

## Dependencies
- **Prerequisites**: None
- **Blocks**: All subsequent error handling tickets

## Acceptance Criteria
1. ✅ BaseError class created with all specified properties
2. ✅ Private fields properly encapsulated
3. ✅ Serialization methods work correctly
4. ✅ Stack trace capture works in V8 environments
5. ✅ Correlation ID generated for each error
6. ✅ Context can be added and retrieved
7. ✅ Abstract methods can be overridden by subclasses

## Testing Requirements

### Unit Tests
Create `tests/unit/errors/BaseError.test.js`:
- Test constructor with various inputs
- Test serialization methods (toJSON, toString)
- Test context management methods
- Test correlation ID generation
- Test stack trace capture
- Test getter methods
- Mock and test abstract method overriding

### Test Cases
```javascript
describe('BaseError', () => {
  it('should create error with default values');
  it('should generate unique correlation IDs');
  it('should serialize to JSON correctly');
  it('should capture stack trace in V8');
  it('should allow context addition');
  it('should format toString correctly');
  it('should allow severity override in subclass');
  it('should allow recoverability override in subclass');
});
```

## Estimated Effort
- **Development**: 2 hours
- **Testing**: 1 hour
- **Total**: 3 hours

## Risk Assessment
- **Low Risk**: Foundational class with no dependencies
- **Consideration**: Ensure backward compatibility when extending in child classes

## Success Metrics
- All unit tests pass
- No breaking changes to existing error handling
- Clear documentation and examples provided

## Notes
- Keep the implementation simple and extensible
- Focus on core functionality that all errors need
- Ensure TypeScript/JSDoc types are comprehensive
- Consider adding static factory methods in future iterations