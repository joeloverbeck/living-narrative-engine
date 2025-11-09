# MODTESDIAIMP-006: Create ScopeResolutionError Class

**Phase**: 2 - Enhanced Error Context
**Priority**: 🔴 Critical
**Estimated Effort**: 2 hours
**Dependencies**: None (independent of Phase 1)

---

## ⚠️ Workflow Corrections (2024-11-09)

This workflow has been updated to align with actual codebase patterns:

1. **File Location**: Changed from `src/scopeDsl/core/` to `src/scopeDsl/errors/`
   - Reason: All error classes are in the `errors/` subdirectory

2. **Test Location**: Changed from `tests/unit/scopeDsl/core/` to `tests/unit/scopeDsl/errors/`
   - Reason: Test structure mirrors source structure

3. **Base Class**: Changed from extending `Error` to extending `BaseError`
   - Reason: `ParameterValidationError` pattern uses `BaseError` from `src/errors/baseError.js`
   - Benefits: Built-in error codes, timestamps, correlation IDs, context management, toJSON()

4. **Constructor**: Must call `super(message, 'SCOPE_RESOLUTION_ERROR', context)`
   - Reason: BaseError requires error code parameter

5. **Additional Methods**: Added `getSeverity()` and `isRecoverable()`
   - Reason: Abstract methods from BaseError that must be implemented

6. **Built-in Features**: Documented that toJSON(), stack capture, correlation IDs come from BaseError
   - Reason: Avoid reimplementing existing functionality

**Verified Against**:
- `src/scopeDsl/errors/parameterValidationError.js` (reference pattern)
- `src/errors/baseError.js` (base class)
- `tests/unit/scopeDsl/errors/parameterValidationError.test.js` (test pattern)
- `src/scopeDsl/constants/errorCodes.js` (error code constants)

---

## Overview

Create a comprehensive error class `ScopeResolutionError` that wraps scope resolution failures with rich context including scope name, phase, parameters, hints, and original errors.

## Objectives

- Create enhanced error class extending `BaseError` (following `ParameterValidationError` pattern)
- Support structured context for debugging
- Preserve original error and stack trace
- Provide formatted output with sections
- Support JSON serialization for logging (inherited from BaseError)

## Implementation Details

### File Location
- **Path**: `src/scopeDsl/errors/scopeResolutionError.js` (note: in `errors/` subdirectory, not `core/`)
- **New File**: Yes

### Class Structure

```javascript
import BaseError from '../../errors/baseError.js';

export class ScopeResolutionError extends BaseError {
  constructor(message, context = {})
  getSeverity()
  isRecoverable()
  toString() // Override to provide custom formatting
  // toJSON() inherited from BaseError
}
```

### Context Properties

The `context` object should support:
- `scopeName`: Name of scope being resolved
- `phase`: Resolution phase (e.g., "parameter extraction", "filter evaluation")
- `parameters`: Object with parameter values for debugging
- `expected`: Expected type/structure
- `received`: Actual type/structure
- `hint`: Suggestion for fixing the error
- `suggestion`: Specific action to take
- `example`: Code example showing correct usage
- `originalError`: Wrapped error object

### Key Features

1. **Constructor**
   - Must call `super(message, 'SCOPE_RESOLUTION_ERROR', context)` to initialize BaseError
   - BaseError provides: error code, timestamp, correlation ID, deep context copy
   - Error code should be 'SCOPE_RESOLUTION_ERROR' (custom) or use existing code like 'RESOLUTION_FAILED_GENERIC'

2. **toString() Method** (Override)
   - Multi-section formatted output
   - Proper indentation for nested objects
   - Clear parameter formatting
   - Stack trace excerpt (first 5 lines)
   - Can optionally call or extend `super.toString()`

3. **toJSON() Method** (Inherited from BaseError)
   - Already returns structured object for logging
   - Includes name, message, code, context, timestamp, severity, recoverable, correlationId, stack
   - Serializable for remote logging

4. **Error Preservation**
   - Captures original error message in context.originalError
   - Preserves original stack trace
   - BaseError already uses `Error.captureStackTrace` in constructor

5. **Severity and Recoverability** (Abstract methods from BaseError)
   - `getSeverity()`: Return 'error', 'warning', or 'critical'
   - `isRecoverable()`: Return true/false based on error nature

## Acceptance Criteria

- ✅ Class extends `BaseError` (from `../../errors/baseError.js`)
- ✅ Constructor accepts message and context, calls `super(message, 'SCOPE_RESOLUTION_ERROR', context)`
- ✅ Implements `getSeverity()` method (return 'error' or 'warning')
- ✅ Implements `isRecoverable()` method (return true/false)
- ✅ `toString()` overridden to format all context properties with sections
- ✅ Parameters formatted with proper indentation
- ✅ Original error preserved in context.originalError with stack excerpt
- ✅ `toJSON()` inherited from BaseError returns serializable object
- ✅ Stack trace captured automatically by BaseError constructor
- ✅ Hints and suggestions formatted with indicators
- ✅ Error code constant defined or uses existing ErrorCodes

## Testing Requirements

**Test File**: `tests/unit/scopeDsl/errors/scopeResolutionError.test.js` (note: in `errors/` subdirectory)

### Test Cases

```javascript
import { ScopeResolutionError } from '../../../../src/scopeDsl/errors/scopeResolutionError.js';
import BaseError from '../../../../src/errors/baseError.js';

describe('ScopeResolutionError', () => {
  describe('Basic error creation', () => {
    it('should create error with message only')
    it('should create error with full context')
    it('should extend Error')
    it('should extend BaseError')
    it('should be instance of ScopeResolutionError')
  });

  describe('Error properties from BaseError', () => {
    it('should have correct error code')
    it('should have timestamp')
    it('should have correlation ID')
    it('should return correct severity via getSeverity()')
    it('should return correct recoverability via isRecoverable()')
    it('should capture stack trace automatically')
  });

  describe('toString() override', () => {
    it('should format basic message')
    it('should include scope name section')
    it('should include phase section')
    it('should format parameters object')
    it('should indent nested parameter objects')
    it('should include expected/received')
    it('should include hint with emoji')
    it('should include suggestion')
    it('should include multiline example')
    it('should include original error message')
    it('should include stack trace excerpt')
    it('should format all sections in correct order')
  });

  describe('toJSON() inherited from BaseError', () => {
    it('should return serializable object')
    it('should include name, message, code, context, timestamp, severity, recoverable, correlationId, stack')
    it('should not lose data in JSON round-trip')
  });

  describe('error preservation', () => {
    it('should preserve original error message in context.originalError')
    it('should preserve original error stack in context')
    it('should maintain error chain')
  });

  describe('context access via BaseError', () => {
    it('should expose context via getContext()')
    it('should return deep copy of context (defensive)')
    it('should allow reading specific context properties via getContext(key)')
    it('should support addContext() for fluent interface')
  });
});
```

## Integration Points

This error class will be used by:
- Scope resolution failure handling (MODTESDIAIMP-007)
- Filter evaluation errors (MODTESDIAIMP-007)
- Custom scope resolver errors (MODTESDIAIMP-007)

## Example Output

```
ScopeResolutionError: Invalid parameter passed to scope resolver
  Scope: positioning:close_actors_facing_each_other
  Phase: parameter extraction
  Parameters:
    contextType: object
    hasActorEntity: true
    hasActor: false
    extractedType: object
  Expected: Entity instance with id property
  Received: Full context object with actor, targets properties
  💡 Hint: Extract actorEntity from context before passing to ScopeEngine.resolve()
  Suggestion: Use: const actorEntity = context.actorEntity || context.actor
  Example:
    const actorEntity = context.actorEntity || context.actor;
    const result = scopeEngine.resolve(scopeData.ast, actorEntity, runtimeCtx);
  Original Error: ParameterValidationError: actorEntity has invalid 'id' property
  Stack Trace:
    at CustomScopeResolver (ModTestFixture.js:2261)
    at ScopeRegistry.resolve (scopeRegistry.js:78)
    at ActionDiscoveryService.discover (actionDiscoveryService.js:30)

  [BaseError metadata]
  Code: SCOPE_RESOLUTION_ERROR
  Severity: error
  Recoverable: false
  Timestamp: 2024-11-09T12:34:56.789Z
  Correlation ID: 550e8400-e29b-41d4-a716-446655440000
```

**Note**: The example output above shows the custom toString() formatting. The inherited toJSON() would return:
```json
{
  "name": "ScopeResolutionError",
  "message": "Invalid parameter passed to scope resolver",
  "code": "SCOPE_RESOLUTION_ERROR",
  "context": {
    "scopeName": "positioning:close_actors_facing_each_other",
    "phase": "parameter extraction",
    "parameters": { "contextType": "object", ... },
    "expected": "Entity instance with id property",
    "received": "Full context object with actor, targets properties",
    "hint": "Extract actorEntity from context before passing to ScopeEngine.resolve()",
    "suggestion": "Use: const actorEntity = context.actorEntity || context.actor",
    "example": "const actorEntity = context.actorEntity || context.actor;\nconst result = scopeEngine.resolve(scopeData.ast, actorEntity, runtimeCtx);",
    "originalError": "ParameterValidationError: actorEntity has invalid 'id' property"
  },
  "timestamp": "2024-11-09T12:34:56.789Z",
  "severity": "error",
  "recoverable": false,
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "stack": "ScopeResolutionError: Invalid parameter passed to scope resolver\n    at CustomScopeResolver (ModTestFixture.js:2261)..."
}
```

## References

- **Spec Section**: 3.2 Enhanced Error Context (lines 557-662)
- **Example Sections**: Usage Examples 1, 2, 3 (lines 664-735)
- **Related Ticket**: MODTESDIAIMP-007 (Error wrapping integration)
