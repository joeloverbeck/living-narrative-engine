# RECVALREF-001: Create IValidator Interface

**Phase:** 1 - Foundation & Interfaces
**Priority:** P0 - Critical
**Estimated Effort:** 2 hours
**Dependencies:** None

## Context

The current recipe validation system has no common abstraction for validators, resulting in inconsistent patterns:
- 2 validators use `ValidationRule` base class
- 9 validators are inline methods
- 2 validators are standalone functions

This ticket establishes the core validator interface that all validators will implement.

## Objectives

1. Create `IValidator` interface with standardized contract
2. Define validation result types
3. Establish severity levels (error, warning, info)
4. Provide priority-based execution ordering
5. Support fail-fast behavior

## Implementation Details

### File to Create

`src/anatomy/validation/interfaces/IValidator.js`

### Interface Specification

```javascript
/**
 * Validation severity levels
 * @typedef {'error' | 'warning' | 'info'} ValidationSeverity
 */

/**
 * Validation issue
 * @typedef {Object} ValidationIssue
 * @property {string} type - Issue type identifier
 * @property {ValidationSeverity} severity - Issue severity
 * @property {string} message - Human-readable message
 * @property {Object} [metadata] - Additional context
 */

/**
 * Validation result
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Overall validation status
 * @property {ValidationIssue[]} issues - All validation issues
 * @property {Object} [metadata] - Additional result data
 */

/**
 * Validator interface
 * @interface IValidator
 */
export class IValidator {
  /**
   * Validator name (unique identifier)
   * @type {string}
   */
  get name() {
    throw new Error('Not implemented');
  }

  /**
   * Validator priority (lower = runs first)
   * @type {number}
   */
  get priority() {
    throw new Error('Not implemented');
  }

  /**
   * Whether this validator should stop pipeline on failure
   * @type {boolean}
   */
  get failFast() {
    return false;
  }

  /**
   * Validate recipe
   * @param {Object} recipe - Recipe to validate
   * @param {Object} context - Validation context
   * @returns {Promise<ValidationResult>}
   */
  async validate(recipe, context) {
    throw new Error('Not implemented');
  }
}
```

## Testing Requirements

### Unit Tests

**File:** `tests/unit/anatomy/validation/interfaces/IValidator.test.js`

**Test Cases:**
1. ✅ Should define interface with required methods
2. ✅ Should throw on unimplemented name getter
3. ✅ Should throw on unimplemented priority getter
4. ✅ Should throw on unimplemented validate method
5. ✅ Should default failFast to false
6. ✅ ValidationIssue type should be properly defined
7. ✅ ValidationResult type should be properly defined

### Example Test

```javascript
import { describe, it, expect } from '@jest/globals';
import { IValidator } from '../../../../../src/anatomy/validation/interfaces/IValidator.js';

describe('IValidator Interface', () => {
  it('should throw when name getter not implemented', () => {
    const validator = new IValidator();
    expect(() => validator.name).toThrow('Not implemented');
  });

  it('should throw when priority getter not implemented', () => {
    const validator = new IValidator();
    expect(() => validator.priority).toThrow('Not implemented');
  });

  it('should default failFast to false', () => {
    const validator = new IValidator();
    expect(validator.failFast).toBe(false);
  });

  it('should throw when validate method not implemented', async () => {
    const validator = new IValidator();
    await expect(validator.validate({}, {})).rejects.toThrow('Not implemented');
  });
});
```

## Acceptance Criteria

- [ ] `IValidator` interface created in correct location
- [ ] All required properties and methods defined
- [ ] JSDoc types properly documented
- [ ] TypeScript-style type definitions included
- [ ] Unit tests achieve 100% branch coverage
- [ ] All tests pass
- [ ] Code follows project style guidelines
- [ ] No ESLint violations

## Related Tickets

- RECVALREF-002 (depends on this)
- RECVALREF-010 (depends on this)

## References

- **Analysis Document:** `reports/recipe-validation-architecture-analysis.md` (Section: Validation Layer Analysis)
- **Recommendations:** `reports/recipe-validation-refactoring-recommendations.md` (Phase 1.1)
- **Project Guidelines:** `CLAUDE.md` (Code Structure & Conventions)

## Notes

This interface establishes the foundation for all validator implementations. Keep it minimal and focused - additional features can be added to `BaseValidator` implementation in Phase 3.
