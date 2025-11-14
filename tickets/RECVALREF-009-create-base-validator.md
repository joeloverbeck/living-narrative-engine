# RECVALREF-009: Create BaseValidator Class

**Phase:** 3 - Validator Implementations
**Priority:** P0 - Critical
**Estimated Effort:** 3 hours
**Dependencies:** RECVALREF-001, RECVALREF-008

## Context

All validators need common functionality:
- Error handling with try-catch
- Result building with ValidationResultBuilder
- Logging integration
- Template method pattern for validation logic

## Objectives

1. Create abstract `BaseValidator` class implementing `IValidator`
2. Provide template method pattern for validation
3. Handle exceptions consistently
4. Integrate with ValidationResultBuilder

## Implementation

### File to Create
`src/anatomy/validation/validators/BaseValidator.js`

### Key Features
- Extends `IValidator` interface
- Constructor accepts: name, priority, failFast, logger
- `validate(recipe, context)` - Template method with exception handling
- `performValidation(recipe, context, builder)` - Abstract method for subclasses
- Automatic error wrapping and logging

## Testing
- Unit tests: `tests/unit/anatomy/validation/validators/BaseValidator.test.js`
- Test exception handling
- Test template method execution
- Test abstract method enforcement

## Acceptance Criteria
- [ ] BaseValidator class created
- [ ] Template method pattern implemented
- [ ] Exception handling consistent
- [ ] Unit tests achieve 95%+ coverage
- [ ] All methods properly documented

## References
- **Recommendations:** Phase 3.1
