# RECVALREF-011: Refactor 11 Validators to Standalone Classes

**Phase:** 3 - Validator Implementations
**Priority:** P0 - Critical
**Estimated Effort:** 16 hours (2 hours per validator average)
**Dependencies:** RECVALREF-009

## Context

Currently 11 validation checks are implemented as:
- 2 using ValidationRule base class
- 9 as inline methods in RecipePreflightValidator

All need to be refactored to standalone validator classes extending BaseValidator.

## Validators to Refactor

### Critical (P0) - Fail Fast
1. **ComponentExistenceValidator** - Already exists, needs BaseValidator migration
2. **PropertySchemasValidator** - Already exists, needs BaseValidator migration
3. **BodyDescriptorValidator** - NEW (currently inline method)
4. **BlueprintExistenceValidator** - NEW (currently inline method)

### High Priority (P1)
5. **SocketSlotCompatibilityValidator** - External function → class migration
6. **PatternMatchingValidator** - External function → class migration

### Medium Priority (P2)
7. **DescriptorCoverageValidator** - NEW (currently inline method)
8. **PartAvailabilityValidator** - NEW (currently inline method)
9. **GeneratedSlotPartsValidator** - NEW (currently inline method)

### Low Priority (P3-P4)
10. **LoadFailureValidator** - NEW (currently inline method)
11. **RecipeUsageValidator** - NEW (currently inline method)

## Sub-Tickets

Create individual tickets for each validator:
- RECVALREF-011-A through RECVALREF-011-K (one per validator)

## Implementation Pattern

Each validator should follow this structure:
```javascript
import { BaseValidator } from './BaseValidator.js';

export class XyzValidator extends BaseValidator {
  constructor({ logger, ...dependencies }) {
    super({
      name: 'validator_name',
      priority: N,
      failFast: boolean,
      logger,
    });
    // Inject dependencies
  }

  async performValidation(recipe, context, builder) {
    // Validation logic
    // Use builder.addError/addWarning/addInfo
  }
}
```

## Testing Requirements

Each validator needs:
- Unit test file: `tests/unit/anatomy/validation/validators/{Name}Validator.test.js`
- Test valid recipe scenarios
- Test error scenarios
- Test edge cases
- 80%+ branch coverage minimum

## Acceptance Criteria (per validator)
- [ ] Validator class created extending BaseValidator
- [ ] Inline method removed from RecipePreflightValidator
- [ ] Dependencies injected via constructor
- [ ] Uses ValidationResultBuilder
- [ ] Unit tests achieve 80%+ coverage
- [ ] All existing tests pass

## Migration Strategy

1. Create validator class in `src/anatomy/validation/validators/`
2. Write unit tests
3. Verify behavior matches original implementation
4. Update RecipePreflightValidator to use validator
5. Remove inline method
6. Run integration tests

## References
- **Recommendations:** Phase 3.2
- **Analysis:** Section "Validation Layer Analysis"
