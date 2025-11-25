# APPGRAOCCSYS-001: Create anatomy:can_grab Component Schema

**Originating Document**: `brainstorming/appendage-grabbing-occupation-system.md`

## Summary

Create the `anatomy:can_grab` component schema that marks body parts as capable of grabbing/holding items. This component contains a lock indicating whether the appendage is currently occupied, along with tracking for the held item and grip strength.

## Files to Create

| File | Purpose |
|------|---------|
| `data/mods/anatomy/components/can_grab.component.json` | Component schema definition |
| `tests/unit/mods/anatomy/components/can_grab.component.test.js` | Unit tests for schema validation |

## Files to Modify

| File | Change |
|------|--------|
| `data/mods/anatomy/mod-manifest.json` | Add component reference if manifest lists components explicitly |

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
   - [ ] Component schema loads without AJV errors
   - [ ] Valid component data passes validation (locked: false, heldItemId: null, gripStrength: 1.0)
   - [ ] Valid component data passes with minimal required fields (locked: false)
   - [ ] Invalid data fails: missing `locked` field
   - [ ] Invalid data fails: `locked` is not boolean
   - [ ] Invalid data fails: `heldItemId` is not string or null
   - [ ] Invalid data fails: `gripStrength` is negative
   - [ ] Invalid data fails: additional properties present
   - [ ] Default values are correctly applied when not provided

2. **Existing Tests**: Run `npm run test:unit -- --testPathPattern="anatomy"` - all existing anatomy tests must still pass

### Invariants That Must Remain True

1. The `anatomy` mod's existing components (`part`, `joint`, `body`, `sockets`, `blueprintSlot`) continue to load and validate correctly
2. The component follows the same schema pattern as other anatomy components
3. The mod validation (`npm run validate:mod:anatomy`) passes
4. No circular dependencies introduced

## Test File Template

```javascript
// tests/unit/mods/anatomy/components/can_grab.component.test.js
import { describe, it, expect, beforeAll } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('anatomy:can_grab component schema', () => {
  let testBed;
  let validator;

  beforeAll(async () => {
    testBed = await createTestBed();
    validator = testBed.getSchemaValidator();
    await testBed.loadSchemas();
  });

  describe('valid data', () => {
    it('should validate complete component data', () => {
      const data = {
        locked: false,
        heldItemId: null,
        gripStrength: 1.0
      };
      const result = validator.validate('anatomy:can_grab', data);
      expect(result.isValid).toBe(true);
    });

    it('should validate minimal required fields', () => {
      const data = { locked: false };
      const result = validator.validate('anatomy:can_grab', data);
      expect(result.isValid).toBe(true);
    });

    it('should validate with heldItemId string', () => {
      const data = {
        locked: true,
        heldItemId: 'weapons:longsword_001'
      };
      const result = validator.validate('anatomy:can_grab', data);
      expect(result.isValid).toBe(true);
    });
  });

  describe('invalid data', () => {
    it('should reject missing locked field', () => {
      const data = { gripStrength: 1.0 };
      const result = validator.validate('anatomy:can_grab', data);
      expect(result.isValid).toBe(false);
    });

    it('should reject non-boolean locked', () => {
      const data = { locked: 'false' };
      const result = validator.validate('anatomy:can_grab', data);
      expect(result.isValid).toBe(false);
    });

    it('should reject negative gripStrength', () => {
      const data = { locked: false, gripStrength: -1 };
      const result = validator.validate('anatomy:can_grab', data);
      expect(result.isValid).toBe(false);
    });

    it('should reject additional properties', () => {
      const data = { locked: false, extraField: true };
      const result = validator.validate('anatomy:can_grab', data);
      expect(result.isValid).toBe(false);
    });
  });
});
```

## Verification Commands

```bash
# Validate the component schema
npm run validate:mod:anatomy

# Run schema tests
npm run test:unit -- tests/unit/mods/anatomy/components/can_grab.component.test.js

# Ensure existing anatomy tests pass
npm run test:unit -- --testPathPattern="anatomy"
```
