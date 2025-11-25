# APPGRAOCCSYS-002: Create anatomy:requires_grabbing Component Schema

**Originating Document**: `brainstorming/appendage-grabbing-occupation-system.md`

## Summary

Create the `anatomy:requires_grabbing` component schema that specifies how many grabbing appendages are needed to hold/wield an item. This component is applied to weapons, instruments, tools, and other items that require hands to use.

## Dependencies

- None (can be implemented in parallel with APPGRAOCCSYS-001)

## Files to Create

| File | Purpose |
|------|---------|
| `data/mods/anatomy/components/requires_grabbing.component.json` | Component schema definition |
| `tests/unit/mods/anatomy/components/requires_grabbing.component.test.js` | Unit tests for schema validation |

## Files to Modify

| File | Change |
|------|--------|
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

```javascript
// tests/unit/mods/anatomy/components/requires_grabbing.component.test.js
import { describe, it, expect, beforeAll } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('anatomy:requires_grabbing component schema', () => {
  let testBed;
  let validator;

  beforeAll(async () => {
    testBed = await createTestBed();
    validator = testBed.getSchemaValidator();
    await testBed.loadSchemas();
  });

  describe('valid data', () => {
    it('should validate one-handed item', () => {
      const data = { handsRequired: 1 };
      const result = validator.validate('anatomy:requires_grabbing', data);
      expect(result.isValid).toBe(true);
    });

    it('should validate two-handed item', () => {
      const data = { handsRequired: 2 };
      const result = validator.validate('anatomy:requires_grabbing', data);
      expect(result.isValid).toBe(true);
    });

    it('should validate worn item (zero hands)', () => {
      const data = { handsRequired: 0 };
      const result = validator.validate('anatomy:requires_grabbing', data);
      expect(result.isValid).toBe(true);
    });

    it('should validate with minGripStrength', () => {
      const data = { handsRequired: 2, minGripStrength: 2.0 };
      const result = validator.validate('anatomy:requires_grabbing', data);
      expect(result.isValid).toBe(true);
    });

    it('should validate heavy item requiring many hands', () => {
      // e.g., a battering ram requiring 4 appendages
      const data = { handsRequired: 4, minGripStrength: 4.0 };
      const result = validator.validate('anatomy:requires_grabbing', data);
      expect(result.isValid).toBe(true);
    });
  });

  describe('invalid data', () => {
    it('should reject missing handsRequired field', () => {
      const data = { minGripStrength: 1.0 };
      const result = validator.validate('anatomy:requires_grabbing', data);
      expect(result.isValid).toBe(false);
    });

    it('should reject non-integer handsRequired', () => {
      const data = { handsRequired: 1.5 };
      const result = validator.validate('anatomy:requires_grabbing', data);
      expect(result.isValid).toBe(false);
    });

    it('should reject string handsRequired', () => {
      const data = { handsRequired: '1' };
      const result = validator.validate('anatomy:requires_grabbing', data);
      expect(result.isValid).toBe(false);
    });

    it('should reject negative handsRequired', () => {
      const data = { handsRequired: -1 };
      const result = validator.validate('anatomy:requires_grabbing', data);
      expect(result.isValid).toBe(false);
    });

    it('should reject negative minGripStrength', () => {
      const data = { handsRequired: 1, minGripStrength: -0.5 };
      const result = validator.validate('anatomy:requires_grabbing', data);
      expect(result.isValid).toBe(false);
    });

    it('should reject additional properties', () => {
      const data = { handsRequired: 1, extraField: true };
      const result = validator.validate('anatomy:requires_grabbing', data);
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
npm run test:unit -- tests/unit/mods/anatomy/components/requires_grabbing.component.test.js

# Ensure existing anatomy tests pass
npm run test:unit -- --testPathPattern="anatomy"
```

## Design Notes

### Example Usage by Item Type

| Item Type | handsRequired | minGripStrength | Notes |
|-----------|---------------|-----------------|-------|
| Dagger | 1 | - | Light one-handed |
| Rapier | 1 | - | One-handed |
| Longsword | 2 | - | Two-handed |
| Greataxe | 2 | 2.0 | Heavy two-handed |
| Shield | 1 | - | One-handed |
| Lute | 2 | - | Two-handed instrument |
| Ring | 0 | - | Worn, not held |
| Torch | 1 | - | One-handed |
