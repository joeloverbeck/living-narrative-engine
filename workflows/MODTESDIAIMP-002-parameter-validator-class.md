# MODTESDIAIMP-002: Create ParameterValidator Class

**Phase**: 1 - Parameter Validation
**Priority**: 🔴 Critical
**Estimated Effort**: 4 hours
**Dependencies**: MODTESDIAIMP-001

---

## Overview

Create a comprehensive parameter validator class with static methods for validating scope resolution parameters, providing fail-fast validation with context-aware error messages.

## Objectives

- Implement type validation for actorEntity structure
- Implement validation for runtimeContext services
- Implement validation for AST node structure
- Detect common mistakes (e.g., passing full context instead of actorEntity)
- Throw `ParameterValidationError` with helpful hints

## Implementation Details

### File Location
- **Path**: `src/scopeDsl/core/parameterValidator.js`
- **New File**: Yes

### Class Structure

```javascript
export class ParameterValidator {
  static validateActorEntity(value, source)
  static validateRuntimeContext(value, source)
  static validateAST(value, source)
}
```

### Method Specifications

#### 1. validateActorEntity(value, source)

**Validation Rules**:
- Must be an object
- Must have `id` property of type string
- `id` must not be empty or "undefined"
- If has `components`, must be an object

**Special Detection**:
- Detect if full context object passed (has `actorEntity`, `actor`, or `targets` properties)
- Provide specific hint for context object mistake

**Error Context**:
```javascript
{
  expected: 'Entity instance with id, components properties',
  received: typeof value,
  hint: 'actorEntity must be an entity object, not a primitive value',
  example: 'actorEntity = { id: "actor-123", components: {...} }'
}
```

#### 2. validateRuntimeContext(value, source)

**Required Services**:
- `entityManager`
- `jsonLogicEval`
- `logger`

**Validation Rules**:
- Must be an object
- All required services must be present

**Error Context**:
```javascript
{
  expected: 'runtimeCtx with all required services',
  received: `missing: ${missing.join(', ')}`,
  hint: 'Ensure runtimeCtx includes entityManager, jsonLogicEval, and logger',
  example: 'runtimeCtx = { entityManager, jsonLogicEval, logger }'
}
```

#### 3. validateAST(value, source)

**Validation Rules**:
- Must be an object
- Must have `kind` property

**Error Context**:
```javascript
{
  expected: 'Scope DSL AST object',
  received: typeof value,
  hint: 'AST nodes must specify their kind for resolver dispatch'
}
```

## Acceptance Criteria

- ✅ All three validation methods implemented
- ✅ Each method throws `ParameterValidationError` on failure
- ✅ Each method returns `true` on success
- ✅ Context object detection works for `validateActorEntity`
- ✅ Missing services detected in `validateRuntimeContext`
- ✅ Error messages include source location
- ✅ Hints provided for common mistakes

## Testing Requirements

**Test File**: `tests/unit/scopeDsl/core/parameterValidator.test.js`

### validateActorEntity Tests
1. Pass: Valid entity with id and components
2. Pass: Valid entity with id only
3. Fail: undefined value
4. Fail: null value
5. Fail: primitive value (string, number)
6. Fail: Object without id
7. Fail: Object with non-string id
8. Fail: Object with empty string id
9. Fail: Object with "undefined" string as id
10. Detect: Full context object (has actor/targets)
11. Fail: Object with non-object components

### validateRuntimeContext Tests
1. Pass: Valid runtimeCtx with all services
2. Fail: undefined value
3. Fail: null value
4. Fail: Missing entityManager
5. Fail: Missing jsonLogicEval
6. Fail: Missing logger
7. Fail: Missing multiple services
8. Pass: Extra properties allowed

### validateAST Tests
1. Pass: Valid AST with kind
2. Fail: undefined value
3. Fail: null value
4. Fail: Object without kind
5. Pass: AST with extra properties

## Integration Points

Will be used by:
- `ScopeEngine.resolve()` (MODTESDIAIMP-003)
- `FilterResolver.resolve()` (MODTESDIAIMP-004)
- `SourceResolver.resolve()` (MODTESDIAIMP-004)
- `ModTestFixture.registerCustomScope()` (MODTESDIAIMP-004)

## Example Usage

```javascript
import { ParameterValidator } from './parameterValidator.js';

function resolve(ast, actorEntity, runtimeCtx) {
  // Validate all parameters
  ParameterValidator.validateAST(ast, 'ScopeEngine.resolve');
  ParameterValidator.validateActorEntity(actorEntity, 'ScopeEngine.resolve');
  ParameterValidator.validateRuntimeContext(runtimeCtx, 'ScopeEngine.resolve');

  // Continue with resolution...
}
```

## References

- **Spec Section**: 3.1 Parameter Validation Layer (lines 295-468)
- **Related Tickets**:
  - MODTESDIAIMP-001 (ParameterValidationError)
  - MODTESDIAIMP-003 (ScopeEngine integration)
  - MODTESDIAIMP-004 (Resolver integration)
