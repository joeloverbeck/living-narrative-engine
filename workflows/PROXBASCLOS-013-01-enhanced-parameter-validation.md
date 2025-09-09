# PROXBASCLOS-013-01: Enhanced Parameter Validation

**Parent Ticket**: PROXBASCLOS-013  
**Phase**: Edge Case Handling - Part 1  
**Priority**: Critical  
**Complexity**: Low-Medium  
**Dependencies**: None (first ticket in series)  
**Estimated Time**: 2-3 hours

## Summary

Enhance the `validateProximityParameters()` function in `src/utils/proximityUtils.js` to provide comprehensive parameter validation with detailed error messages. This is the foundation for robust edge case handling throughout the proximity-based closeness system.

## Current State

The existing `validateProximityParameters()` function provides basic validation:
- Uses `assertNonBlankString` for ID validation
- Uses `validateNonNegativeInteger` for spot index
- Minimal error context

## Implementation Requirements

### 1. Enhanced Furniture ID Validation

Update `validateProximityParameters()` to validate:
- **Presence**: ID must exist and not be null/undefined
- **Type**: Must be a string
- **Whitespace**: Cannot be empty or whitespace-only
- **Format**: Must follow `modId:identifier` namespaced format
- **Namespace validation**:
  - Mod ID: alphanumeric + underscore only (`/^[a-zA-Z0-9_]+$/`)
  - Identifier: alphanumeric + underscore + hyphen (`/^[a-zA-Z0-9_-]+$/`)

### 2. Enhanced Actor ID Validation

Apply same validation rules as furniture ID:
- Must be in namespaced format
- Validate both parts of the namespace
- Provide specific error messages for each failure type

### 3. Enhanced Spot Index Validation

Strengthen spot index validation:
- **Required**: Cannot be null or undefined
- **Type**: Must be an integer (`Number.isInteger()`)
- **Range**: 0-9 (maximum furniture capacity)
- **Specific error messages** for each validation failure

### 4. Logger Validation

Validate logger object:
- Must be present and be an object
- Must have required methods: `info`, `warn`, `error`, `debug`
- Each method must be a function

### 5. Error Accumulation and Reporting

Implement error accumulation pattern:
```javascript
const errors = [];
// Collect all validation errors
if (errors.length > 0) {
  const errorMessage = `Parameter validation failed: ${errors.join(', ')}`;
  logger.error('Proximity parameter validation failed', {
    furnitureId,
    actorId,
    spotIndex,
    errors,
    timestamp: new Date().toISOString()
  });
  throw new InvalidArgumentError(errorMessage);
}
```

## Implementation Example

```javascript
export function validateProximityParameters(furnitureId, actorId, spotIndex, logger) {
  const errors = [];

  try {
    // Enhanced furniture ID validation
    if (!furnitureId) {
      errors.push('Furniture ID is required');
    } else if (typeof furnitureId !== 'string') {
      errors.push('Furniture ID must be a string');
    } else if (furnitureId.trim().length === 0) {
      errors.push('Furniture ID cannot be empty or whitespace only');
    } else if (!furnitureId.includes(':')) {
      errors.push('Furniture ID must be in namespaced format (modId:identifier)');
    } else {
      const [modId, identifier] = furnitureId.split(':');
      if (!modId || !identifier) {
        errors.push('Furniture ID must have both mod ID and identifier');
      } else if (!/^[a-zA-Z0-9_]+$/.test(modId)) {
        errors.push('Mod ID must contain only alphanumeric characters and underscores');
      } else if (!/^[a-zA-Z0-9_-]+$/.test(identifier)) {
        errors.push('Identifier must contain only alphanumeric characters, underscores, and hyphens');
      }
    }

    // Similar validation for actor ID...
    // Spot index validation...
    // Logger validation...

    if (errors.length > 0) {
      const errorMessage = `Parameter validation failed: ${errors.join(', ')}`;
      if (logger && typeof logger.error === 'function') {
        logger.error('Proximity parameter validation failed', {
          furnitureId,
          actorId,
          spotIndex,
          errors,
          timestamp: new Date().toISOString()
        });
      }
      throw new InvalidArgumentError(errorMessage);
    }

    // Log successful validation at debug level
    if (logger && typeof logger.debug === 'function') {
      logger.debug('Proximity parameters validated successfully', {
        furnitureId,
        actorId,
        spotIndex
      });
    }

  } catch (error) {
    if (error instanceof InvalidArgumentError) {
      throw error; // Re-throw validation errors
    }
    
    // Handle unexpected validation errors
    const unexpectedError = new Error(`Unexpected error during parameter validation: ${error.message}`);
    if (logger && typeof logger.error === 'function') {
      logger.error('Unexpected validation error', {
        originalError: error.message,
        stack: error.stack
      });
    }
    throw unexpectedError;
  }
}
```

## Testing Requirements

### Unit Tests to Add

Create/update tests in `tests/unit/utils/proximityUtils.test.js`:

1. **Invalid Furniture ID Tests**:
   - Empty string: `''`
   - Whitespace only: `'   '`
   - No namespace: `'no-colon'`
   - Missing mod ID: `':missing-mod'`
   - Missing identifier: `'missing-id:'`
   - Double colon: `'mod::double-colon'`
   - Extra colons: `'mod:id:extra'`
   - Invalid mod ID characters: `'mod-with-dash:id'`
   - Invalid identifier characters: `'mod:id@special'`
   - Non-string types: `null`, `undefined`, `123`, `{}`, `[]`

2. **Invalid Actor ID Tests**:
   - Same test cases as furniture ID

3. **Invalid Spot Index Tests**:
   - Negative: `-1`, `-999`
   - Above maximum: `10`, `100`
   - Non-integer: `1.5`, `NaN`, `Infinity`
   - String numbers: `'0'`, `'1'`
   - Non-numeric: `null`, `undefined`, `'spot'`

4. **Invalid Logger Tests**:
   - Null logger
   - Missing methods
   - Non-function methods

5. **Error Message Validation**:
   - Verify error messages are descriptive
   - Check error context includes all parameters
   - Validate timestamp is included

## Acceptance Criteria

- [ ] **Comprehensive Validation**: All parameter types validated with specific checks
- [ ] **Detailed Error Messages**: Each validation failure produces a clear, actionable message
- [ ] **Error Accumulation**: All errors collected and reported together
- [ ] **Backward Compatibility**: Existing valid calls continue to work
- [ ] **Performance**: Validation adds <5ms to execution time
- [ ] **Logging**: Debug logging for successful validation, error logging for failures
- [ ] **Test Coverage**: 100% branch coverage for validation function
- [ ] **Documentation**: JSDoc comments updated with all validation rules

## Dependencies and Imports

Required imports:
```javascript
import { InvalidArgumentError } from '../errors/invalidArgumentError.js';
// Remove dependency on assertPresent, assertNonBlankString
// Implement validation directly for better error messages
```

## Files to Modify

1. `src/utils/proximityUtils.js` - Update `validateProximityParameters()` function
2. `tests/unit/utils/proximityUtils.test.js` - Add comprehensive edge case tests

## Definition of Done

- [ ] Enhanced validation function implemented with all specified checks
- [ ] All error messages provide actionable information
- [ ] Unit tests pass with 100% coverage of validation logic
- [ ] Performance impact measured and <5ms
- [ ] Code follows project conventions
- [ ] ESLint and prettier checks pass
- [ ] Manual testing confirms improved error messages

## Notes for Implementation

- Keep the existing function signature for backward compatibility
- Return `true` on successful validation (existing behavior)
- Use `InvalidArgumentError` class from existing errors
- Consider creating helper functions if validation logic becomes too complex
- Ensure error messages help developers identify and fix issues quickly

## Next Steps

After completing this ticket, proceed to:
- **PROXBASCLOS-013-02**: Component State Validator (builds on this validation foundation)