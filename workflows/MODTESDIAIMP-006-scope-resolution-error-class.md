# MODTESDIAIMP-006: Create ScopeResolutionError Class

**Phase**: 2 - Enhanced Error Context
**Priority**: 🔴 Critical
**Estimated Effort**: 2 hours
**Dependencies**: None (independent of Phase 1)

---

## Overview

Create a comprehensive error class `ScopeResolutionError` that wraps scope resolution failures with rich context including scope name, phase, parameters, hints, and original errors.

## Objectives

- Create enhanced error class extending `Error`
- Support structured context for debugging
- Preserve original error and stack trace
- Provide formatted output with sections
- Support JSON serialization for logging

## Implementation Details

### File Location
- **Path**: `src/scopeDsl/core/scopeResolutionError.js`
- **New File**: Yes

### Class Structure

```javascript
export class ScopeResolutionError extends Error {
  constructor(message, context = {})
  toString()
  toJSON()
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

1. **toString() Method**
   - Multi-section formatted output
   - Proper indentation for nested objects
   - Clear parameter formatting
   - Stack trace excerpt (first 5 lines)

2. **toJSON() Method**
   - Returns structured object for logging
   - Includes name, message, context, stack
   - Serializable for remote logging

3. **Error Preservation**
   - Captures original error message
   - Preserves original stack trace
   - Uses `Error.captureStackTrace` for new stack

## Acceptance Criteria

- ✅ Class extends `Error`
- ✅ Constructor accepts message and context
- ✅ `toString()` formats all context properties with sections
- ✅ Parameters formatted with proper indentation
- ✅ Original error preserved with stack excerpt
- ✅ `toJSON()` returns serializable object
- ✅ Stack trace captured via `Error.captureStackTrace`
- ✅ Hints and suggestions formatted with indicators

## Testing Requirements

**Test File**: `tests/unit/scopeDsl/core/scopeResolutionError.test.js`

### Test Cases

```javascript
describe('ScopeResolutionError', () => {
  describe('constructor', () => {
    it('should create error with message only')
    it('should create error with full context')
    it('should extend Error')
    it('should capture stack trace')
  });

  describe('toString()', () => {
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

  describe('toJSON()', () => {
    it('should return serializable object')
    it('should include name, message, context, stack')
    it('should not lose data in JSON round-trip')
  });

  describe('error preservation', () => {
    it('should preserve original error message')
    it('should preserve original error stack')
    it('should maintain error chain')
  });

  describe('context access', () => {
    it('should expose context object')
    it('should allow reading context properties')
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
    at CustomScopeResolver (ModTestFixture.js:2245)
    at ScopeRegistry.resolve (scopeRegistry.js:123)
    at ActionDiscoveryService.discover (actionDiscoveryService.js:456)
```

## References

- **Spec Section**: 3.2 Enhanced Error Context (lines 557-662)
- **Example Sections**: Usage Examples 1, 2, 3 (lines 664-735)
- **Related Ticket**: MODTESDIAIMP-007 (Error wrapping integration)
