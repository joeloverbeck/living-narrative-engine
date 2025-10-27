# ANABLUNONHUM-024: Enhanced Validation Rules and Error Messages

**Phase**: 6 - Validation & Tooling
**Priority**: High
**Estimated Effort**: 8-10 hours
**Dependencies**: ANABLUNONHUM-018, ANABLUNONHUM-023

## Overview

Implement comprehensive validation with helpful, actionable error messages for template/blueprint/recipe issues.

## Validation Services

### 1. Template Validator
**File**: `src/anatomy/validation/templateValidator.js`

Rules:
- limbSet counts positive and < 100
- Socket ID templates generate unique IDs
- Orientation schemes valid
- No circular dependencies

### 2. Blueprint Validator
**File**: `src/anatomy/validation/blueprintValidator.js`

Rules:
- Referenced templates exist
- Additional slots don't conflict with generated
- Root entity type matches template expectation
- V1/V2 feature separation enforced

### 3. Recipe Validator
**File**: `src/anatomy/validation/recipeValidator.js`

Rules:
- Slot groups resolve to actual slots
- Wildcard patterns match existing slots
- Property filters reference valid components
- Pattern application conflicts detected

## Error Message Improvements

### Before
```
ValidationError: Recipe contains invalid slot key 'leg_3'
```

### After
```
ValidationError: Recipe 'my_spider' contains invalid slot key 'leg_3'.

Blueprint 'anatomy:spider' uses structure template 'anatomy:structure_arachnid_8leg'
which generates slots: leg_1, leg_2, leg_4, leg_5, leg_6, leg_7, leg_8, pedipalp_1, pedipalp_2, posterior_abdomen

Did you mean: 'leg_4'?

Hint: Use pattern matching to target all legs:
{
  "patterns": [{
    "matchesGroup": "limbSet:leg",
    "partType": "leg"
  }]
}
```

## Acceptance Criteria

- [ ] Three validation services implemented
- [ ] All validation rules from report implemented
- [ ] Error messages include:
  - [ ] Context (which file, which template)
  - [ ] Available options listed
  - [ ] Suggestions for fixes
  - [ ] Helpful hints for common issues
- [ ] 25+ validation test cases
- [ ] Integration with existing validation infrastructure

## References

- **Source**: `reports/anatomy-blueprint-non-human-architecture.md` Section 6, 8.4
