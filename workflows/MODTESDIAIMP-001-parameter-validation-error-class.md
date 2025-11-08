# MODTESDIAIMP-001: Create ParameterValidationError Class

**Phase**: 1 - Parameter Validation
**Priority**: 🔴 Critical
**Estimated Effort**: 2 hours
**Dependencies**: None

---

## Overview

Create a custom error class `ParameterValidationError` that provides enhanced context for parameter validation failures, including expected/received types, hints, and usage examples.

## Objectives

- Create a type-safe error class extending `BaseError` (not `TypeError` - project standard)
- Provide structured context for validation failures
- Include helpful hints and examples for common mistakes
- Support serialization for logging and debugging

## Implementation Details

### File Location
- **Path**: `src/scopeDsl/errors/parameterValidationError.js`
- **New File**: Yes
- **Note**: File should go in `src/scopeDsl/errors/` (not `src/scopeDsl/core/`) to match existing error organization pattern

### Class Structure

```javascript
import BaseError from '../../errors/baseError.js';

export class ParameterValidationError extends BaseError {
  constructor(message, context = {})
  // Inherits toString() from BaseError, override for custom formatting
  toString()
}
```

### Context Properties

The `context` object should support:
- `expected`: String describing expected type/structure
- `received`: String describing actual type/structure
- `hint`: Helpful suggestion for fixing the error
- `example`: Code example showing correct usage
- Additional properties will be stored via BaseError's context system

### Key Features

1. **Enhanced toString()**
   - Multi-line formatted output
   - Clear section headers
   - Emoji indicators (💡 for hints)
   - Indented examples
   - Override BaseError's default toString()

2. **Type Safety**
   - Extends `BaseError` (project standard, not `TypeError`)
   - Uses error code `PARAMETER_VALIDATION_ERROR`
   - Maintains stack trace via `Error.captureStackTrace` (inherited from BaseError)

3. **Debugging Support**
   - Structured context for programmatic access
   - Human-readable formatting for console output
   - Serialization via inherited `toJSON()` method

4. **Project Conventions**
   - Follow BaseError pattern (see `src/errors/baseError.js`)
   - Include `getSeverity()` returning `'warning'`
   - Include `isRecoverable()` returning `true`
   - Use private fields with `#` prefix where appropriate

## Acceptance Criteria

- ✅ Class extends `BaseError` (project standard)
- ✅ Constructor accepts message and context object
- ✅ Uses error code `PARAMETER_VALIDATION_ERROR`
- ✅ `toString()` formats context properties with sections
- ✅ Hints displayed with 💡 emoji
- ✅ Examples properly indented
- ✅ Stack trace preserved (inherited from BaseError)
- ✅ Context accessible via `.context` property (inherited getter)
- ✅ Implements `getSeverity()` returning `'warning'`
- ✅ Implements `isRecoverable()` returning `true`
- ✅ Serialization via inherited `toJSON()` method works correctly

## Testing Requirements

**Test File**: `tests/unit/scopeDsl/errors/parameterValidationError.test.js`

Test suite pattern:
```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { ParameterValidationError } from '../../../../src/scopeDsl/errors/parameterValidationError.js';

describe('ParameterValidationError', () => {
  // Test cases here
});
```

Test cases:
1. Basic error creation with message only
2. Error with full context (expected, received, hint, example)
3. toString() formatting verification
4. Stack trace preservation
5. Context property access via getter
6. Error instanceof checks (Error, BaseError, ParameterValidationError)
7. getSeverity() returns 'warning'
8. isRecoverable() returns true
9. toJSON() serialization includes all context
10. Error code is 'PARAMETER_VALIDATION_ERROR'

## Integration Points

This error class will be used by:
- `ParameterValidator.validateActorEntity()` (MODTESDIAIMP-002)
- `ParameterValidator.validateRuntimeContext()` (MODTESDIAIMP-002)
- `ParameterValidator.validateAST()` (MODTESDIAIMP-002)
- Scope resolution system for early parameter validation
- Test helpers for clearer error messages

## Example Output

```
ParameterValidationError: ScopeEngine.resolve: actorEntity has invalid 'id' property: undefined
  Expected: string id property
  Received: undefined
  💡 Hint: You appear to have passed the entire context object instead of extracting actorEntity.
           Extract actorEntity from context before calling ScopeEngine.resolve()
  Example:
    const actorEntity = context.actorEntity || context.actor;
    scopeEngine.resolve(ast, actorEntity, runtimeCtx);
```

## Implementation Notes

### BaseError Integration

The error should leverage BaseError's existing infrastructure:
- Constructor signature: `super(message, 'PARAMETER_VALIDATION_ERROR', context)`
- Context storage is handled by BaseError (private field with getter)
- Stack trace capture is automatic
- Serialization via `toJSON()` is inherited
- No need to manually implement context getters

### Error Code Pattern

Following project convention:
- Error codes are UPPER_SNAKE_CASE strings
- Stored in BaseError's private `#code` field
- Accessible via inherited `code` getter

### Validation Pattern

Similar to existing errors like `InvalidActorEntityError`:
- Extend BaseError
- Call super with message, code, and context
- Set `this.name` to class name
- Implement `getSeverity()` and `isRecoverable()`
- Override `toString()` for custom formatting only if needed

## References

- **Spec Section**: 3.1 Parameter Validation Layer (lines 289-333) in `specs/mod-testing-diagnostics-improvements.md`
- **Related Ticket**: MODTESDIAIMP-002 (ParameterValidator class)
- **Error Pattern**: `src/errors/baseError.js` - Base class implementation
- **Example Pattern**: `src/errors/invalidActorEntityError.js` - Similar validation error
- **Directory Pattern**: `src/scopeDsl/errors/scopeDslError.js` - Scope DSL error location
