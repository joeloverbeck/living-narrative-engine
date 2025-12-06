# APPGRAOCCSYS-001: Create anatomy:can_grab Component Schema

**Status**: ✅ COMPLETED

**Originating Document**: `brainstorming/appendage-grabbing-occupation-system.md`

## Summary

Create the `anatomy:can_grab` component schema that marks body parts as capable of grabbing/holding items. This component contains a lock indicating whether the appendage is currently occupied, along with tracking for the held item and grip strength.

## Files to Create

| File                                                            | Purpose                          |
| --------------------------------------------------------------- | -------------------------------- |
| `data/mods/anatomy/components/can_grab.component.json`          | Component schema definition      |
| `tests/unit/mods/anatomy/components/can_grab.component.test.js` | Unit tests for schema validation |

## Files to Modify

| File                                  | Change                                          |
| ------------------------------------- | ----------------------------------------------- |
| `data/mods/anatomy/mod-manifest.json` | Add component reference to the components array |

## Out of Scope

- DO NOT modify any body part entity definitions (handled in APPGRAOCCSYS-007)
- DO NOT create operation handlers (handled in APPGRAOCCSYS-004/005)
- DO NOT create operators (handled in APPGRAOCCSYS-006)
- DO NOT modify any action files
- DO NOT create utility functions (handled in APPGRAOCCSYS-003)
- DO NOT create condition files (handled in APPGRAOCCSYS-009)

## Implementation Details

### Component Schema (`data/mods/anatomy/components/can_grab.component.json`)

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "anatomy:can_grab",
  "description": "Marks a body part as capable of grabbing/holding items. Contains a lock that indicates whether this appendage is currently occupied.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "locked": {
        "description": "If true, this grabbing appendage is currently occupied (holding something). If false, it's available.",
        "type": "boolean",
        "default": false
      },
      "heldItemId": {
        "description": "The entity ID of the item currently held by this appendage. Null if not holding anything.",
        "type": ["string", "null"],
        "default": null
      },
      "gripStrength": {
        "description": "The strength of grip this appendage provides. Used for weight limits or skill checks.",
        "type": "number",
        "default": 1.0,
        "minimum": 0
      }
    },
    "required": ["locked"],
    "additionalProperties": false
  }
}
```

## Acceptance Criteria

### Tests That Must Pass

1. **Schema Validation Test**: `tests/unit/mods/anatomy/components/can_grab.component.test.js`
   - [x] Component definition conforms to component.schema.json
   - [x] Component has correct ID (anatomy:can_grab)
   - [x] Component has a description
   - [x] Valid component data passes validation (locked: false, heldItemId: null, gripStrength: 1.0)
   - [x] Valid component data passes with minimal required fields (locked: false)
   - [x] Invalid data fails: missing `locked` field
   - [x] Invalid data fails: `locked` is not boolean
   - [x] Invalid data fails: `heldItemId` is not string or null
   - [x] Invalid data fails: `gripStrength` is negative
   - [x] Invalid data fails: additional properties present
   - [x] Default values are correctly specified in schema

2. **Existing Tests**: Run `npm run test:unit -- --testPathPattern="anatomy"` - all existing anatomy tests must still pass

### Invariants That Must Remain True

1. The `anatomy` mod's existing components (`part`, `joint`, `body`, `sockets`, `blueprintSlot`) continue to load and validate correctly
2. The component follows the same schema pattern as other anatomy components
3. The mod validation (`npm run validate:mod:anatomy`) passes
4. No circular dependencies introduced

## Corrected Test File Template

**Note**: The original template assumed a non-existent `testBed.getSchemaValidator()` API. The corrected template follows the established pattern from `tests/unit/mods/weapons/weapon_component_schema.test.js` which imports AJV directly and validates both the component definition and sample data.

```javascript
// tests/unit/mods/anatomy/components/can_grab.component.test.js
/**
 * @file Test suite to validate the anatomy:can_grab component definition.
 * @see data/mods/anatomy/components/can_grab.component.json
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { beforeAll, describe, expect, test } from '@jest/globals';

// --- Schemas to test against ---
import componentSchema from '../../../../../data/schemas/component.schema.json';
import commonSchema from '../../../../../data/schemas/common.schema.json';

// --- Component definition file to validate ---
import canGrabComponent from '../../../../../data/mods/anatomy/components/can_grab.component.json';

describe('anatomy:can_grab Component Definition', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validateComponentDefinition;
  /** @type {import('ajv').ValidateFunction} */
  let validateComponentData;

  beforeAll(() => {
    const ajv = new Ajv({
      schemas: [commonSchema],
      strict: true,
      allErrors: true,
    });
    addFormats(ajv);

    validateComponentDefinition = ajv.compile(componentSchema);
    validateComponentData = ajv.compile(canGrabComponent.dataSchema);
  });

  describe('Schema Validation', () => {
    test('should conform to the component definition schema', () => {
      const ok = validateComponentDefinition(canGrabComponent);
      if (!ok) {
        console.error(
          'Validation failed:',
          JSON.stringify(validateComponentDefinition.errors, null, 2)
        );
      }
      expect(ok).toBe(true);
    });

    test('should have correct component ID', () => {
      expect(canGrabComponent.id).toBe('anatomy:can_grab');
    });

    test('should have a description', () => {
      expect(canGrabComponent.description).toBeDefined();
      expect(typeof canGrabComponent.description).toBe('string');
      expect(canGrabComponent.description.length).toBeGreaterThan(0);
    });

    test('should have valid schema reference', () => {
      expect(canGrabComponent.$schema).toBe(
        'schema://living-narrative-engine/component.schema.json'
      );
    });
  });

  describe('Valid Component Data', () => {
    test('should validate complete component data', () => {
      const data = {
        locked: false,
        heldItemId: null,
        gripStrength: 1.0,
      };
      expect(validateComponentData(data)).toBe(true);
    });

    test('should validate minimal required fields', () => {
      const data = { locked: false };
      expect(validateComponentData(data)).toBe(true);
    });

    test('should validate locked: true with heldItemId string', () => {
      const data = {
        locked: true,
        heldItemId: 'weapons:longsword_001',
      };
      expect(validateComponentData(data)).toBe(true);
    });

    test('should validate with zero gripStrength', () => {
      const data = {
        locked: false,
        gripStrength: 0,
      };
      expect(validateComponentData(data)).toBe(true);
    });
  });

  describe('Invalid Component Data', () => {
    test('should reject missing locked field', () => {
      const data = { gripStrength: 1.0 };
      expect(validateComponentData(data)).toBe(false);
    });

    test('should reject non-boolean locked', () => {
      const data = { locked: 'false' };
      expect(validateComponentData(data)).toBe(false);
    });

    test('should reject heldItemId as number', () => {
      const data = { locked: false, heldItemId: 123 };
      expect(validateComponentData(data)).toBe(false);
    });

    test('should reject negative gripStrength', () => {
      const data = { locked: false, gripStrength: -1 };
      expect(validateComponentData(data)).toBe(false);
    });

    test('should reject additional properties', () => {
      const data = { locked: false, extraField: true };
      expect(validateComponentData(data)).toBe(false);
    });
  });

  describe('Schema Structure', () => {
    test('should require locked field', () => {
      expect(canGrabComponent.dataSchema.required).toContain('locked');
    });

    test('should disallow additional properties', () => {
      expect(canGrabComponent.dataSchema.additionalProperties).toBe(false);
    });

    test('should define default values', () => {
      const props = canGrabComponent.dataSchema.properties;
      expect(props.locked.default).toBe(false);
      expect(props.heldItemId.default).toBe(null);
      expect(props.gripStrength.default).toBe(1.0);
    });

    test('should set minimum for gripStrength', () => {
      expect(canGrabComponent.dataSchema.properties.gripStrength.minimum).toBe(
        0
      );
    });
  });
});
```

## Verification Commands

```bash
# Validate the component schema
npm run validate:quick

# Run schema tests
npm run test:unit -- tests/unit/mods/anatomy/components/can_grab.component.test.js

# Ensure existing anatomy tests pass
npm run test:unit -- tests/unit/mods/anatomy/
```

---

## Outcome

**Completed**: 2025-11-25

### What Was Actually Changed vs Originally Planned

#### Changes Made as Planned

1. ✅ Created `data/mods/anatomy/components/can_grab.component.json` - exact schema as specified
2. ✅ Created `tests/unit/mods/anatomy/components/can_grab.component.test.js` - 29 tests
3. ✅ Updated `data/mods/anatomy/mod-manifest.json` - added `can_grab.component.json` to components array

#### Deviations from Original Plan

1. **Test Template Corrected**: The original ticket assumed a `testBed.getSchemaValidator()` API that doesn't exist. The actual implementation follows the established pattern from `tests/unit/mods/weapons/weapon_component_schema.test.js`:
   - Imports AJV directly
   - Validates both the component definition file (against `component.schema.json`) AND sample data (against the component's `dataSchema`)
   - Added comprehensive edge case tests beyond the original acceptance criteria

2. **Test File Location**: Created new directory `tests/unit/mods/anatomy/components/` as no existing anatomy unit tests were present in `tests/unit/mods/`

3. **Verification Command Correction**: Changed `npm run validate:mod:anatomy` to `npm run validate:quick` (the former doesn't exist)

### Test Summary

| Test Category          | Tests Added | Rationale                                                                       |
| ---------------------- | ----------- | ------------------------------------------------------------------------------- |
| Schema Validation      | 4           | Validates component definition conforms to meta-schema                          |
| Valid Component Data   | 6           | Tests all valid state combinations including edge cases                         |
| Invalid Component Data | 9           | Comprehensive rejection tests for type errors, missing fields, extra properties |
| Schema Structure       | 5           | Verifies required fields, defaults, constraints                                 |
| Required Fields        | 1           | Confirms component has all required top-level fields                            |
| Edge Cases             | 4           | Tests component definition edge cases (missing fields, extra properties)        |

**Total: 29 tests passing**

### Files Modified/Created

| File                                                            | Action                                        |
| --------------------------------------------------------------- | --------------------------------------------- |
| `data/mods/anatomy/components/can_grab.component.json`          | Created                                       |
| `data/mods/anatomy/mod-manifest.json`                           | Modified (line 19: added component reference) |
| `tests/unit/mods/anatomy/components/can_grab.component.test.js` | Created                                       |
