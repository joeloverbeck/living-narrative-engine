# STRWAISYS-001: Component and Schema Foundation

**Status:** Ready for Implementation
**Priority:** High
**Estimated Effort:** 2-3 hours
**Dependencies:** None
**Blocks:** STRWAISYS-002, STRWAISYS-004, STRWAISYS-005, STRWAISYS-006

## Objective

Create the foundational `straddling_waist` component with comprehensive schema validation and unit tests. This component tracks which actor is being straddled and the straddler's orientation.

## Background

The straddling waist system needs a component-based state tracking mechanism similar to existing positioning components (`kneeling_before`, `bending_over`, `sitting_on`). This ticket establishes that foundation.

## Implementation Tasks

### 1. Create Component Definition

**File:** `data/mods/positioning/components/straddling_waist.component.json`

**Content:**
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "positioning:straddling_waist",
  "description": "Tracks which entity this actor is currently straddling and the orientation (facing or facing away).",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["target_id", "facing_away"],
    "properties": {
      "target_id": {
        "description": "The ID of the entity being straddled",
        "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId"
      },
      "facing_away": {
        "type": "boolean",
        "description": "Whether the straddling actor is facing away from the target (true) or facing them (false)"
      }
    }
  }
}
```

**Validation Points:**
- Component follows standard component schema structure
- Uses `$schema` property for validation
- Uses namespaced ID format: `positioning:straddling_waist`
- `target_id` references common schema definition for namespaced IDs
- `facing_away` boolean provides primary orientation tracking

### 2. Create Unit Tests

**File:** `tests/unit/mods/positioning/components/straddling_waist.test.js`

**Test Structure:**
```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../../common/testBed.js';

describe('positioning:straddling_waist Component - Schema Validation', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  it('should pass validation with valid component data', () => {
    const validData = {
      target_id: 'actor:target_123',
      facing_away: false
    };

    const result = testBed.validateComponentData(
      'positioning:straddling_waist',
      validData
    );

    expect(result.valid).toBe(true);
  });

  it('should pass validation with facing_away true', () => {
    const validData = {
      target_id: 'actor:target_456',
      facing_away: true
    };

    const result = testBed.validateComponentData(
      'positioning:straddling_waist',
      validData
    );

    expect(result.valid).toBe(true);
  });

  it('should fail validation when target_id is missing', () => {
    const invalidData = {
      facing_away: false
    };

    const result = testBed.validateComponentData(
      'positioning:straddling_waist',
      invalidData
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('target_id');
  });

  it('should fail validation when facing_away is missing', () => {
    const invalidData = {
      target_id: 'actor:target_123'
    };

    const result = testBed.validateComponentData(
      'positioning:straddling_waist',
      invalidData
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('facing_away');
  });

  it('should fail validation when target_id has invalid format', () => {
    const invalidData = {
      target_id: 'invalid-format',
      facing_away: false
    };

    const result = testBed.validateComponentData(
      'positioning:straddling_waist',
      invalidData
    );

    expect(result.valid).toBe(false);
  });

  it('should fail validation when facing_away is not a boolean', () => {
    const invalidData = {
      target_id: 'actor:target_123',
      facing_away: 'yes'
    };

    const result = testBed.validateComponentData(
      'positioning:straddling_waist',
      invalidData
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('facing_away');
  });

  it('should fail validation with additional properties', () => {
    const invalidData = {
      target_id: 'actor:target_123',
      facing_away: false,
      extra_property: 'not allowed'
    };

    const result = testBed.validateComponentData(
      'positioning:straddling_waist',
      invalidData
    );

    expect(result.valid).toBe(false);
  });

  it('should accept special namespaced IDs like "self"', () => {
    const validData = {
      target_id: 'self',
      facing_away: false
    };

    const result = testBed.validateComponentData(
      'positioning:straddling_waist',
      validData
    );

    expect(result.valid).toBe(true);
  });
});
```

**Test Coverage Requirements:**
- Valid component data passes validation
- Missing required fields fail validation
- Invalid data types fail validation
- Invalid ID formats fail validation
- Additional properties fail validation
- Both boolean values for `facing_away` work correctly
- Special namespaced IDs are accepted

### 3. Update Mod Manifest

**File:** `data/mods/positioning/mod-manifest.json`

**Action:** Add component to manifest's components array

**Verification:**
```bash
# Run manifest update script
npm run update-manifest

# Verify component is registered
grep -A 5 "straddling_waist" data/mods/positioning/mod-manifest.json
```

## Design Decisions

### Component Structure

**Decision:** Store `facing_away` boolean directly in component
**Rationale:**
- Authoritative source of truth for orientation
- No need to query separate `facing_away` component for orientation
- Simpler data flow and queries
- Component data is self-contained

**Alternative Considered:** Store only `target_id`, query `facing_away` component
**Rejected Because:**
- Requires component existence check for orientation
- More complex queries
- Risk of desync between components

### Mutual Exclusivity

**Decision:** Enforce via action `forbidden_components`, not component schema
**Rationale:**
- Action discovery naturally filters incompatible states
- Schema validation focuses on data integrity
- Flexibility for future scenarios
- Follows existing positioning mod pattern

### Target Validation

**Decision:** Use `namespacedId` schema reference
**Rationale:**
- Reuses existing validation logic
- Ensures ID format consistency
- Supports special IDs like `self`, `none`
- Type-safe validation

## Testing Strategy

### Unit Test Coverage
- Schema validation (all required fields)
- Data type validation
- Format validation for namespaced IDs
- Edge cases (special IDs, boundary values)
- Invalid data rejection

### Manual Testing
```bash
# Run unit tests
NODE_ENV=test npm run test:unit -- tests/unit/mods/positioning/components/straddling_waist.test.js

# Validate against schema
npm run scope:lint
```

## Acceptance Criteria

- [ ] Component file created at correct path
- [ ] Component follows JSON schema standards
- [ ] Component ID uses correct namespace format
- [ ] `target_id` uses `namespacedId` reference
- [ ] `facing_away` is required boolean
- [ ] No additional properties allowed
- [ ] Unit tests created with 100% schema coverage
- [ ] All unit tests pass
- [ ] Mod manifest updated
- [ ] Schema validation passes

## Verification Commands

```bash
# Run component unit tests
NODE_ENV=test npm run test:unit -- tests/unit/mods/positioning/components/straddling_waist.test.js --verbose

# Validate JSON schema
npm run scope:lint

# Check manifest registration
grep "straddling_waist" data/mods/positioning/mod-manifest.json

# Run full positioning mod tests
NODE_ENV=test npm run test:unit -- tests/unit/mods/positioning/ --silent
```

## References

### Similar Components
- `positioning:kneeling_before` - Single target entity tracking
- `positioning:sitting_on` - Furniture tracking with index
- `positioning:bending_over` - Target tracking with movement lock
- `positioning:facing_away` - Orientation tracking

### Documentation
- CLAUDE.md - Project conventions and patterns
- Spec: `specs/straddling-waist-system.spec.md` (Section: Component Design)

## Notes

- This component is foundational for STRWAISYS-004, STRWAISYS-005, STRWAISYS-006
- Component presence indicates active straddling state
- Movement locking handled by rules, not component
- Closeness membership required but not enforced by component schema
