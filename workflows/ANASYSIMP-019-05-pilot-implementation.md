# ANASYSIMP-019-05: Pilot with Descriptor Components

**Phase:** 3 (Pilot Implementation)
**Timeline:** 1-2 days
**Status:** Not Started
**Dependencies:** ANASYSIMP-019-01, ANASYSIMP-019-02, ANASYSIMP-019-03, ANASYSIMP-019-04
**Parent:** ANASYSIMP-019 (Schema-Driven Validation Generation)

## Overview

Conduct a pilot implementation by migrating 5-10 descriptor component schemas to use the new `validationRules` system. This pilot will validate the approach, identify issues, and provide concrete examples before full rollout.

## Objectives

1. Select 5-10 representative descriptor components
2. Manually add `validationRules` to pilot schemas
3. Test validation improvements with real data
4. Compare error messages before and after migration
5. Measure performance impact
6. Document lessons learned
7. Refine migration utilities based on findings
8. Create migration template for other developers

## Technical Details

### 1. Pilot Component Selection

**Criteria for Selection:**
- High usage frequency (commonly validated)
- Varied enum sizes (small, medium, large)
- Mix of simple and complex validation needs
- Representative of broader descriptor set

**Recommended Pilots:**

1. **texture** - Surface texture descriptor
   - Enum size: ~15 values
   - Common typos: "smoothe", "ruff", "scaley"

2. **color** - Color descriptor
   - Enum size: ~30 values
   - Common typos: "blu", "greeen", "whte"

3. **shape** - Shape descriptor
   - Enum size: ~20 values
   - Common typos: "circuler", "rectagle"

4. **size** - Size descriptor
   - Enum size: ~10 values
   - Common typos: "tny", "larg", "medum"

5. **material** - Material descriptor
   - Enum size: ~25 values
   - Common typos: "metl", "woood", "plastik"

### 2. Migration Process

**For each pilot component:**

#### Step 1: Backup Original
```bash
git add data/mods/descriptors/components/texture.component.json
git commit -m "Backup: texture component before validation rules migration"
```

#### Step 2: Add validationRules

**Example: texture.component.json**

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "descriptors:texture",
  "description": "Describes the surface texture of an object or body part",
  "dataSchema": {
    "type": "object",
    "properties": {
      "texture": {
        "type": "string",
        "description": "The surface texture",
        "enum": [
          "bumpy", "chitinous", "coarse", "furry", "fuzzy",
          "rough", "scaly", "slimy", "smooth", "soft",
          "sticky", "velvety", "waxy", "wrinkled", "leathery"
        ],
        "default": "smooth"
      }
    },
    "required": ["texture"],
    "additionalProperties": false
  },
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid texture '{{value}}'. Did you mean one of: {{validValues}}?",
      "missingRequired": "Texture is required for this component",
      "invalidType": "Texture must be a string, got {{actual}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

#### Step 3: Test with Invalid Data

Create test cases with common mistakes:

**File to Create:** `tests/integration/validation/pilotDescriptorValidation.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';

describe('Pilot Descriptor Validation - texture', () => {
  let testBed;
  let validator;

  beforeEach(() => {
    testBed = createTestBed();
    validator = testBed.resolve('AjvSchemaValidator');
  });

  it('should provide helpful error for typo "smoothe"', () => {
    const data = { texture: 'smoothe' };
    const result = validator.validate(data, 'descriptors:texture');

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Invalid texture');
    expect(result.errors[0].suggestion).toBe('smooth');
  });

  it('should provide helpful error for typo "ruff"', () => {
    const data = { texture: 'ruff' };
    const result = validator.validate(data, 'descriptors:texture');

    expect(result.valid).toBe(false);
    expect(result.errors[0].suggestion).toBe('rough');
  });

  it('should provide helpful error for typo "scaley"', () => {
    const data = { texture: 'scaley' };
    const result = validator.validate(data, 'descriptors:texture');

    expect(result.valid).toBe(false);
    expect(result.errors[0].suggestion).toBe('scaly');
  });

  it('should validate correct texture', () => {
    const data = { texture: 'smooth' };
    const result = validator.validate(data, 'descriptors:texture');

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should provide error for missing required field', () => {
    const data = {};
    const result = validator.validate(data, 'descriptors:texture');

    expect(result.valid).toBe(false);
    expect(result.errors[0].type).toBe('missingRequired');
    expect(result.errors[0].message).toContain('required');
  });
});
```

#### Step 4: Comparison Testing

Create comparison tests showing improvement:

**File to Create:** `tests/integration/validation/beforeAfterComparison.test.js`

Compare error messages before and after migration.

### 3. Performance Measurement

**File to Create:** `tests/performance/validation/generatedValidatorPerformance.test.js`

```javascript
import { describe, it, expect } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';

describe('Generated Validator Performance', () => {
  it('should validate texture in < 1ms', () => {
    const testBed = createTestBed();
    const validator = testBed.resolve('AjvSchemaValidator');
    const data = { texture: 'smooth' };

    const iterations = 1000;
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      validator.validate(data, 'descriptors:texture');
    }

    const endTime = performance.now();
    const avgTime = (endTime - startTime) / iterations;

    expect(avgTime).toBeLessThan(1); // < 1ms per validation
  });

  it('should benefit from validator caching', () => {
    const testBed = createTestBed();
    const validator = testBed.resolve('AjvSchemaValidator');
    const data = { texture: 'smooth' };

    // First validation (generates validator)
    const firstStart = performance.now();
    validator.validate(data, 'descriptors:texture');
    const firstTime = performance.now() - firstStart;

    // Second validation (uses cached validator)
    const secondStart = performance.now();
    validator.validate(data, 'descriptors:texture');
    const secondTime = performance.now() - secondStart;

    // Cached validation should be faster
    expect(secondTime).toBeLessThan(firstTime);
  });
});
```

### 4. Lessons Learned Documentation

**File to Create:** `docs/validation/pilot-lessons-learned.md`

Document:
- What worked well
- Issues encountered
- Performance observations
- Error message quality
- Developer experience feedback
- Recommendations for full rollout

## Files to Create

- [ ] `tests/integration/validation/pilotDescriptorValidation.test.js`
- [ ] `tests/integration/validation/beforeAfterComparison.test.js`
- [ ] `tests/performance/validation/generatedValidatorPerformance.test.js`
- [ ] `docs/validation/pilot-lessons-learned.md`
- [ ] `docs/validation/migration-template.md`

## Files to Update

- [ ] `data/mods/descriptors/components/texture.component.json`
- [ ] `data/mods/descriptors/components/color.component.json`
- [ ] `data/mods/descriptors/components/shape.component.json`
- [ ] `data/mods/descriptors/components/size.component.json`
- [ ] `data/mods/descriptors/components/material.component.json`

## Testing Requirements

### Integration Tests

Test each pilot component with:
- Valid data
- Invalid enum values with typos
- Missing required fields
- Type errors
- Suggestion accuracy

### Performance Tests

Measure:
- Validation time per component
- Impact of validator caching
- Memory usage
- Comparison with AJV-only validation

**Coverage Target:** 90% branches for pilot components

## Acceptance Criteria

- [ ] 5-10 descriptor components migrated
- [ ] All migrated schemas validate correctly
- [ ] Validation tests demonstrate improvements
- [ ] Error messages are clearer and more helpful
- [ ] Suggestions accurately catch typos
- [ ] Performance meets target (< 1ms per validation)
- [ ] No regressions in existing validation
- [ ] Lessons learned documented
- [ ] Migration template created
- [ ] All tests pass
- [ ] ESLint passes
- [ ] TypeScript type checking passes

## Validation Commands

```bash
# Validate schemas
npm run validate

# Run integration tests
npm run test:integration -- tests/integration/validation/pilotDescriptorValidation.test.js

# Run performance tests
npm run test:performance -- tests/performance/validation/generatedValidatorPerformance.test.js

# Full test suite
npm run test:ci
```

## Success Metrics

- ✅ Validation errors are more helpful (measured by clarity)
- ✅ Suggestions correctly identify intended values
- ✅ Performance impact is minimal (< 10% overhead)
- ✅ Developer feedback is positive
- ✅ No breaking changes to existing systems
- ✅ Migration process is straightforward

## Evaluation Criteria

### Error Message Quality

**Before (AJV only):**
```
Error: data.texture should be equal to one of the allowed values
```

**After (Generated validator):**
```
Error: Invalid texture 'smoothe'. Did you mean one of: smooth, soft, silky?
Suggestion: smooth
```

### Suggestion Accuracy

Test with common typos:
- "smoothe" → suggests "smooth" ✅
- "ruff" → suggests "rough" ✅
- "scaley" → suggests "scaly" ✅
- "blu" → suggests "blue" ✅

### Performance Impact

Target metrics:
- Validation time: < 1ms per component
- Cache hit rate: > 95% for repeated validations
- Memory overhead: < 1MB for all generated validators

## Risk Assessment

**Low Risk:**
- Only affects 5-10 components
- Easy to rollback (remove validationRules)
- No breaking changes

**Medium Risk:**
- Performance impact unknown until tested
- May reveal edge cases in validator generation

**Mitigation:**
- Thorough performance testing
- Fallback to AJV-only validation if needed
- Incremental rollout

## Rollback Plan

If pilot reveals issues:

```bash
# Restore original schemas
git checkout HEAD -- data/mods/descriptors/components/

# Disable validator generation in code
# Set generateValidator: false in schemas

# Revert integration changes if needed
git revert <commit-hash>
```

## Related Tickets

- **Parent:** ANASYSIMP-019 (Schema-Driven Validation Generation)
- **Depends on:** ANASYSIMP-019-01, ANASYSIMP-019-02, ANASYSIMP-019-03, ANASYSIMP-019-04
- **Blocks:** ANASYSIMP-019-06 (Evaluate and Refine)
- **Feeds into:** ANASYSIMP-019-08 (Gradual Rollout)

## References

- **Descriptor Components:** `data/mods/descriptors/components/`
- **AJV Validator:** `src/validation/ajvSchemaValidator.js`
- **Validator Generator:** `src/validation/validatorGenerator.js`
- **Testing Guide:** `docs/testing/validation-testing.md`
