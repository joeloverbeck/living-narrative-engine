# ANASYSIMP-019-04: Migrate Components to Use ValidationRules

**Phase:** 2 (Integration)
**Timeline:** 2 hours
**Status:** Not Started
**Dependencies:** ANASYSIMP-019-01 (Component Schema Extension), ANASYSIMP-019-03 (AJV Integration)
**Parent:** ANASYSIMP-019 (Schema-Driven Validation Generation)

## Overview

Migrate existing component schemas with enum properties to use the new `validationRules` feature. This enables enhanced error messages, similarity-based suggestions, and consistent validation across the codebase.

**Approach:** AI-assisted manual migration (not automated tooling)

## Context

### Current State
- **128 total** component schemas in `data/mods/`
- **46 components** with enum properties (migration candidates)
- **1 component** already uses validationRules (`descriptors:texture-with-validation`)
- **45 components** need migration

### Why Not Build Migration Utilities?

Migration utilities were considered but deemed **not cost-effective**:
- **Scale:** Only 45 components (not 100+ as initially estimated)
- **Simplicity:** Pattern is straightforward and repetitive
- **One-time task:** Not a recurring migration pattern
- **Time trade-off:** 1 day to build tools vs. 1.5 hours to migrate manually
- **Maintenance burden:** Adds rarely-used scripts to maintain

**Decision:** Use AI-assisted manual migration for speed and simplicity.

## Objectives

1. Add `validationRules` to 45 component schemas with enum properties
2. Validate all migrated schemas pass validation
3. Test that enhanced validation works at runtime
4. Document the migration pattern for future reference
5. Ensure backward compatibility (no breaking changes)

## Migration Pattern

### Standard ValidationRules Template

For components with enum properties, use this standard pattern:

```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid {propertyName}: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "{PropertyLabel} is required",
      "invalidType": "Invalid type for {propertyName}: expected {{expected}}, got {{actual}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

### Example Migration

**Before (clothing/wearable.component.json):**
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "clothing:wearable",
  "description": "Defines clothing item properties and equipment behavior",
  "dataSchema": {
    "type": "object",
    "properties": {
      "layer": {
        "type": "string",
        "enum": ["underwear", "base", "outer", "accessories"],
        "description": "Layer priority for stacking"
      }
    },
    "required": ["layer"],
    "additionalProperties": false
  }
}
```

**After:**
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "clothing:wearable",
  "description": "Defines clothing item properties and equipment behavior",
  "dataSchema": {
    "type": "object",
    "properties": {
      "layer": {
        "type": "string",
        "enum": ["underwear", "base", "outer", "accessories"],
        "description": "Layer priority for stacking"
      }
    },
    "required": ["layer"],
    "additionalProperties": false
  },
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid layer: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Layer is required",
      "invalidType": "Invalid type for layer: expected {{expected}}, got {{actual}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

### Customization Guidelines

**Error Messages:**
- Replace `{propertyName}` with actual property name (e.g., "layer", "mood", "texture")
- Capitalize `{PropertyLabel}` for user-facing messages (e.g., "Layer", "Mood", "Texture")
- Keep template variables: `{{value}}`, `{{validValues}}`, `{{expected}}`, `{{actual}}`

**Suggestions Configuration:**
- Use default values for most cases: `maxDistance: 3`, `maxSuggestions: 3`
- Only adjust if specific use case requires it

**Multiple Enum Properties:**
- If component has multiple enum properties, error messages apply to all
- Consider most important property for message wording
- Or use generic messages: "Invalid value: {{value}}"

## Implementation Steps

### Phase 1: Identify Migration Candidates (15 minutes)

**Step 1.1: Generate candidate list**
```bash
# Find all components with enum properties
grep -l '"enum"' data/mods/*/components/*.component.json > migration-candidates.txt

# Exclude already migrated
grep -L 'validationRules' $(cat migration-candidates.txt) > components-to-migrate.txt

# Review the list
cat components-to-migrate.txt
```

**Expected:** ~45 component files

**Step 1.2: Group by mod**
Organize components by mod for batch processing:
- Anatomy mod
- Clothing mod
- Core mod
- Music mod
- etc.

### Phase 2: Batch Migration (60 minutes)

**Process per mod (10-15 components per batch):**

1. **Open component file**
2. **Identify enum property** (look for `"enum": [...]`)
3. **Copy template** from section above
4. **Customize error messages** with property name
5. **Add `validationRules` block** after `dataSchema`
6. **Save file**
7. **Validate:**
   ```bash
   npm run validate
   ```
8. **Commit batch:**
   ```bash
   git add data/mods/{mod-name}/components/*.component.json
   git commit -m "feat(validation): add validationRules to {mod-name} components"
   ```

**Recommended order:**
1. Descriptors mod (6 components) - simple, well-defined
2. Anatomy mod (2-3 components) - reference body descriptor docs
3. Clothing mod (7 components) - moderate complexity
4. Core mod (5 components) - foundational
5. Remaining mods (25 components) - by priority

### Phase 3: Testing & Validation (30 minutes)

**Step 3.1: Schema validation**
```bash
# Validate all schemas
npm run validate

# Check for validation errors
echo $?  # Should be 0
```

**Step 3.2: Runtime validation test**

Create quick test to verify enhanced validation:

**File:** `tests/integration/validation/componentValidationRules.integration.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';

describe('Component ValidationRules Integration', () => {
  let testBed;
  let validator;

  beforeEach(async () => {
    testBed = createTestBed();
    validator = await testBed.resolve('IAjvSchemaValidator');
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should provide enhanced error messages for enum violations', () => {
    // Test with a component that has validationRules
    const invalidData = { layer: 'invalid-layer' };
    const result = validator.validate('clothing:wearable', invalidData);

    expect(result.isValid).toBe(false);
    expect(result.errors[0].message).toContain('Invalid layer');
    expect(result.errors[0].message).toContain('invalid-layer');
    expect(result.errors[0].message).toContain('Valid options');
  });

  it('should suggest similar valid values', () => {
    // Test with typo close to valid value
    const invalidData = { layer: 'outter' }; // Typo of "outer"
    const result = validator.validate('clothing:wearable', invalidData);

    expect(result.isValid).toBe(false);
    expect(result.errors[0].suggestions).toBeDefined();
    expect(result.errors[0].suggestions).toContain('outer');
  });

  it('should work with components without validationRules', () => {
    // Test backward compatibility
    const validData = { /* component without validationRules */ };
    const result = validator.validate('some:component', validData);

    // Should still work, just without enhanced messages
    expect(result).toBeDefined();
  });
});
```

**Step 3.3: Run test suite**
```bash
# Run integration tests
npm run test:integration

# Run full test suite
npm run test:ci
```

### Phase 4: Verification (15 minutes)

**Step 4.1: Verify migration completeness**
```bash
# Should return 0 (all migrated)
grep -l '"enum"' data/mods/*/components/*.component.json | \
  xargs grep -L 'validationRules' | \
  wc -l
```

**Step 4.2: Check for common mistakes**
```bash
# Verify all validationRules have required properties
for file in $(grep -l 'validationRules' data/mods/*/components/*.component.json); do
  echo "Checking $file..."
  jq -e '.validationRules.generateValidator != null' "$file" > /dev/null || echo "  Missing generateValidator"
  jq -e '.validationRules.errorMessages != null' "$file" > /dev/null || echo "  Missing errorMessages"
  jq -e '.validationRules.suggestions != null' "$file" > /dev/null || echo "  Missing suggestions"
done
```

**Step 4.3: Final validation**
```bash
# ESLint (if any JS files were modified)
npx eslint tests/integration/validation/componentValidationRules.integration.test.js

# TypeScript check
npm run typecheck

# Full test suite
npm run test:ci
```

## Files to Create

- [ ] `tests/integration/validation/componentValidationRules.integration.test.js` - Runtime validation test
- [ ] `migration-candidates.txt` - List of components to migrate (temporary, not committed)
- [ ] `components-to-migrate.txt` - Filtered list (temporary, not committed)

## Files to Modify

**~45 component files** in various mods (exact list generated in Phase 1):
- `data/mods/anatomy/components/*.component.json`
- `data/mods/clothing/components/*.component.json`
- `data/mods/core/components/*.component.json`
- `data/mods/descriptors/components/*.component.json`
- `data/mods/music/components/*.component.json`
- `data/mods/*/components/*.component.json` (other mods)

## Testing Strategy

### Unit Tests
No new unit tests required - `ValidatorGenerator` already has comprehensive coverage.

### Integration Tests
**File:** `tests/integration/validation/componentValidationRules.integration.test.js`

Test cases:
- [ ] Enhanced error messages for enum violations
- [ ] Similarity suggestions for typos
- [ ] Multiple enum properties in single component
- [ ] Backward compatibility with non-migrated components
- [ ] Required field validation
- [ ] Type validation

**Coverage Target:** 85% branches, 90% functions/lines (for new test file)

## Acceptance Criteria

- [ ] All 45 components with enum properties have `validationRules` sections
- [ ] All migrated components pass schema validation (`npm run validate`)
- [ ] Integration test demonstrates enhanced validation works
- [ ] Error messages use appropriate property names (not generic)
- [ ] Similarity suggestions enabled for all enum properties
- [ ] No breaking changes to existing functionality
- [ ] Full test suite passes (`npm run test:ci`)
- [ ] ESLint passes for modified files
- [ ] TypeScript type checking passes
- [ ] Migration verified complete (grep check returns 0)

## Reference Documentation

### Anatomy System
- **Body Descriptors Guide:** [`docs/anatomy/body-descriptors-complete.md`](../docs/anatomy/body-descriptors-complete.md)
  - Registry architecture and descriptor metadata
  - Current descriptors: height, skinColor, build, composition, hairDensity, smell
  - Validation system overview
- **Anatomy System Guide:** [`docs/anatomy/anatomy-system-guide.md`](../docs/anatomy/anatomy-system-guide.md)
- **Testing Recipes:** [`docs/anatomy/testing-recipes.md`](../docs/anatomy/testing-recipes.md)

### Testing Patterns
- **Mod Testing Guide:** [`docs/testing/mod-testing-guide.md`](../docs/testing/mod-testing-guide.md)
  - Component file naming conventions (underscores)
  - ModTestFixture patterns
  - Domain matchers and assertions
- **Validation Workflow:** [`docs/anatomy/validation-workflow.md`](../docs/anatomy/validation-workflow.md)

### Implementation References
- **Validator Generator:** `src/validation/validatorGenerator.js` (30+ unit tests)
- **AJV Integration:** `src/validation/ajvSchemaValidator.js`
- **Component Schema:** `data/schemas/component.schema.json`
- **Example Component:** `data/mods/descriptors/components/texture-with-validation.component.json`

## Success Metrics

- ✅ 45 components migrated in ~1.5 hours (not 1 day)
- ✅ Zero schema validation errors after migration
- ✅ Enhanced error messages visible in integration tests
- ✅ Similarity suggestions working for typos
- ✅ 100% backward compatibility maintained
- ✅ Full test suite passes without degradation

## Common Pitfalls & Solutions

### Pitfall 1: Wrong Template Variable Syntax
**Problem:** Using `{value}` instead of `{{value}}`
**Solution:** Always use double braces: `{{value}}`, `{{validValues}}`, `{{expected}}`, `{{actual}}`

### Pitfall 2: Missing Required Properties
**Problem:** Forgetting `generateValidator`, `errorMessages`, or `suggestions`
**Solution:** Copy complete template, don't piece together manually

### Pitfall 3: Inconsistent Capitalization
**Problem:** "layer is required" vs "Layer is required"
**Solution:** Capitalize property name in user-facing messages (missingRequired)

### Pitfall 4: Not Testing After Each Batch
**Problem:** Multiple batches fail validation at once
**Solution:** Run `npm run validate` after each mod's components

### Pitfall 5: Committing Temporary Files
**Problem:** `migration-candidates.txt` in git
**Solution:** Add to `.gitignore` or delete before committing

## Migration Progress Tracking

Use this checklist to track progress by mod (based on actual findings from ANASYSIMP-019-04-01):

### Priority 1: Core & Anatomy Mods (6 components)

#### Core Mod (4 components)
- [ ] gender
- [ ] material
- [ ] notes
- [ ] player_type

#### Anatomy Mod (2 components)
- [ ] body
- [ ] sockets

### Priority 2: Clothing Mod (4 components)
- [ ] wearable
- [ ] coverage_mapping
- [ ] slot_metadata
- [ ] blocks_removal

### Priority 3: Activity & Music Mods (2 components)
- [ ] description_metadata (activity mod)
- [ ] performance_mood (music mod)

### Priority 4: Descriptors Mod (33 components to migrate)

#### Already Migrated (1 component)
- [x] texture-with-validation ✓

#### Body-level descriptors (5 components)
- [ ] body_composition
- [ ] build
- [ ] height
- [ ] body_hair
- [ ] texture

#### Part-level descriptors (28 components)
- [ ] acoustic_property
- [ ] animation
- [ ] color_basic
- [ ] color_extended
- [ ] deformity
- [ ] digit_count
- [ ] effect
- [ ] embellishment
- [ ] facial_aesthetic
- [ ] facial_hair
- [ ] firmness
- [ ] flexibility
- [ ] hair_style
- [ ] length_category
- [ ] length_hair
- [ ] luminosity
- [ ] pattern
- [ ] projection
- [ ] secretion
- [ ] sensory_capability
- [ ] shape_eye
- [ ] shape_general
- [ ] size_category
- [ ] structural_integrity
- [ ] temperature
- [ ] visual_capability
- [ ] vocal_capability
- [ ] weight_feel

**Total: 45 components to migrate (46 total - 1 already migrated)**

## Related Tickets

- **Parent:** ANASYSIMP-019 (Schema-Driven Validation Generation)
- **Depends on:** ANASYSIMP-019-01 (Extend component.schema.json)
- **Depends on:** ANASYSIMP-019-03 (Integrate AJV Validator)
- **Enables:** ANASYSIMP-019-05 (Pilot with Descriptor Components)
- **Enables:** ANASYSIMP-019-08 (Gradual Rollout)

## Post-Migration

### Optional Enhancements
After successful migration, consider:
1. Add migration pattern to `CLAUDE.md` for future developers
2. Update component schema documentation with examples
3. Add validation rules section to component creation wizard
4. Create pre-commit hook to remind about validationRules for new components

### Metrics to Track
- Error message quality in production logs
- Reduction in invalid component data incidents
- Developer feedback on error message clarity
- Time saved debugging validation issues
