# APPGRAOCCSYS-002: Create anatomy:requires_grabbing Component Schema

**Status**: ✅ COMPLETED (2025-11-25)

**Originating Document**: `brainstorming/appendage-grabbing-occupation-system.md`

## Summary

Create the `anatomy:requires_grabbing` component schema that specifies how many grabbing appendages are needed to hold/wield an item. This component is applied to weapons, instruments, tools, and other items that require hands to use.

## Dependencies

- None (can be implemented in parallel with APPGRAOCCSYS-001)

## Files to Create

| File                                                                     | Purpose                          |
| ------------------------------------------------------------------------ | -------------------------------- |
| `data/mods/anatomy/components/requires_grabbing.component.json`          | Component schema definition      |
| `tests/unit/mods/anatomy/components/requires_grabbing.component.test.js` | Unit tests for schema validation |

## Files to Modify

| File                                  | Change                                                          |
| ------------------------------------- | --------------------------------------------------------------- |
| `data/mods/anatomy/mod-manifest.json` | Add component reference if manifest lists components explicitly |

## Out of Scope

- DO NOT modify any weapon/item entity definitions (handled in APPGRAOCCSYS-008)
- DO NOT create operation handlers (handled in APPGRAOCCSYS-004/005)
- DO NOT create operators (handled in APPGRAOCCSYS-006)
- DO NOT modify any action files
- DO NOT create utility functions (handled in APPGRAOCCSYS-003)
- DO NOT create condition files (handled in APPGRAOCCSYS-009)

## Implementation Details

### Component Schema (`data/mods/anatomy/components/requires_grabbing.component.json`)

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "anatomy:requires_grabbing",
  "description": "Specifies how many grabbing appendages are needed to hold/wield this item.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "handsRequired": {
        "description": "Number of grabbing appendages required to hold this item (e.g., 1 for dagger, 2 for longsword, 0 for rings).",
        "type": "integer",
        "minimum": 0,
        "default": 1
      },
      "minGripStrength": {
        "description": "Minimum total grip strength required. If set, the sum of gripStrength from all assigned appendages must meet this threshold.",
        "type": "number",
        "minimum": 0
      }
    },
    "required": ["handsRequired"],
    "additionalProperties": false
  }
}
```

## Acceptance Criteria

### Tests That Must Pass

1. **Schema Validation Test**: `tests/unit/mods/anatomy/components/requires_grabbing.component.test.js`
   - [ ] Component schema loads without AJV errors
   - [ ] Valid component data passes validation (handsRequired: 1)
   - [ ] Valid component data passes with minGripStrength (handsRequired: 2, minGripStrength: 1.5)
   - [ ] Valid component data passes for zero hands (handsRequired: 0, for worn items)
   - [ ] Invalid data fails: missing `handsRequired` field
   - [ ] Invalid data fails: `handsRequired` is not integer
   - [ ] Invalid data fails: `handsRequired` is negative
   - [ ] Invalid data fails: `handsRequired` is a float (e.g., 1.5)
   - [ ] Invalid data fails: `minGripStrength` is negative
   - [ ] Invalid data fails: additional properties present

2. **Existing Tests**: Run `npm run test:unit -- --testPathPattern="anatomy"` - all existing anatomy tests must still pass

### Invariants That Must Remain True

1. The `anatomy` mod's existing components continue to load and validate correctly
2. The component follows the same schema pattern as other anatomy components
3. The mod validation (`npm run validate:mod:anatomy`) passes
4. No circular dependencies introduced
5. The `handsRequired` field is strictly integer (no floats)

## Test File Template

**Note**: The test follows the established pattern from `can_grab.component.test.js`, using direct AJV imports and schema compilation rather than the `testBed` utility (which does not provide schema validation methods).

```javascript
// tests/unit/mods/anatomy/components/requires_grabbing.component.test.js
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { beforeAll, describe, expect, test } from '@jest/globals';

// --- Schemas to test against ---
import componentSchema from '../../../../../data/schemas/component.schema.json';
import commonSchema from '../../../../../data/schemas/common.schema.json';

// --- Component definition file to validate ---
import requiresGrabbingComponent from '../../../../../data/mods/anatomy/components/requires_grabbing.component.json';

describe('anatomy:requires_grabbing Component Definition', () => {
  let validateComponentDefinition;
  let validateComponentData;

  beforeAll(() => {
    const ajv = new Ajv({
      schemas: [commonSchema],
      strict: true,
      allErrors: true,
    });
    addFormats(ajv);

    validateComponentDefinition = ajv.compile(componentSchema);
    validateComponentData = ajv.compile(requiresGrabbingComponent.dataSchema);
  });

  describe('Schema Validation', () => {
    test('should conform to the component definition schema', () => {
      const ok = validateComponentDefinition(requiresGrabbingComponent);
      expect(ok).toBe(true);
    });

    test('should have correct component ID', () => {
      expect(requiresGrabbingComponent.id).toBe('anatomy:requires_grabbing');
    });
  });

  describe('Valid Component Data', () => {
    test('should validate one-handed item', () => {
      const data = { handsRequired: 1 };
      expect(validateComponentData(data)).toBe(true);
    });

    test('should validate two-handed item', () => {
      const data = { handsRequired: 2 };
      expect(validateComponentData(data)).toBe(true);
    });

    test('should validate worn item (zero hands)', () => {
      const data = { handsRequired: 0 };
      expect(validateComponentData(data)).toBe(true);
    });

    test('should validate with minGripStrength', () => {
      const data = { handsRequired: 2, minGripStrength: 2.0 };
      expect(validateComponentData(data)).toBe(true);
    });

    test('should validate heavy item requiring many hands', () => {
      const data = { handsRequired: 4, minGripStrength: 4.0 };
      expect(validateComponentData(data)).toBe(true);
    });
  });

  describe('Invalid Component Data', () => {
    test('should reject missing handsRequired field', () => {
      const data = { minGripStrength: 1.0 };
      expect(validateComponentData(data)).toBe(false);
    });

    test('should reject non-integer handsRequired', () => {
      const data = { handsRequired: 1.5 };
      expect(validateComponentData(data)).toBe(false);
    });

    test('should reject string handsRequired', () => {
      const data = { handsRequired: '1' };
      expect(validateComponentData(data)).toBe(false);
    });

    test('should reject negative handsRequired', () => {
      const data = { handsRequired: -1 };
      expect(validateComponentData(data)).toBe(false);
    });

    test('should reject negative minGripStrength', () => {
      const data = { handsRequired: 1, minGripStrength: -0.5 };
      expect(validateComponentData(data)).toBe(false);
    });

    test('should reject additional properties', () => {
      const data = { handsRequired: 1, extraField: true };
      expect(validateComponentData(data)).toBe(false);
    });
  });
});
```

## Verification Commands

```bash
# Validate the component schema
npm run validate:mod:anatomy

# Run schema tests
npm run test:unit -- tests/unit/mods/anatomy/components/requires_grabbing.component.test.js

# Ensure existing anatomy tests pass
npm run test:unit -- --testPathPattern="anatomy"
```

## Design Notes

### Example Usage by Item Type

| Item Type | handsRequired | minGripStrength | Notes                 |
| --------- | ------------- | --------------- | --------------------- |
| Dagger    | 1             | -               | Light one-handed      |
| Rapier    | 1             | -               | One-handed            |
| Longsword | 2             | -               | Two-handed            |
| Greataxe  | 2             | 2.0             | Heavy two-handed      |
| Shield    | 1             | -               | One-handed            |
| Lute      | 2             | -               | Two-handed instrument |
| Ring      | 0             | -               | Worn, not held        |
| Torch     | 1             | -               | One-handed            |

## Outcome

### What Was Changed (vs. Originally Planned)

**Ticket Corrections Applied:**

- The test file template was corrected to match the actual established pattern from `can_grab.component.test.js`. The original template incorrectly assumed `createTestBed()` provides `getSchemaValidator()` and `loadSchemas()` methods—these don't exist. The actual pattern uses direct AJV imports and schema compilation.

**Files Created (as planned):**

1. `data/mods/anatomy/components/requires_grabbing.component.json` — Component schema exactly as specified
2. `tests/unit/mods/anatomy/components/requires_grabbing.component.test.js` — Comprehensive test suite with 34 tests

**Files Modified (as planned):**

1. `data/mods/anatomy/mod-manifest.json` — Added `requires_grabbing.component.json` to components array

**Test Results:**

- All 34 new tests pass
- All 233 anatomy-related test suites pass (4706 tests total)
- No regressions introduced

**Test Coverage Added:**
| Test Category | Tests Added | Rationale |
|---------------|-------------|-----------|
| Schema Validation | 4 | Validates component definition conformance |
| Valid Component Data | 8 | Tests all valid input combinations including edge cases |
| Invalid Component Data | 10 | Tests all rejection scenarios specified + extras |
| Schema Structure | 7 | Verifies schema properties and constraints |
| Required Fields | 1 | Ensures component has required schema fields |
| Edge Cases | 4 | Tests component definition mutation scenarios |
