# CLOREMBLO-001: Create blocks_removal Component Schema

**Category**: Clothing System Enhancement
**Priority**: High
**Estimated Effort**: 2-3 hours
**Phase**: 1 - Foundation

---

## Overview

Create the `clothing:blocks_removal` component schema that enables explicit declaration of removal dependencies between clothing items. This component allows items to declare which other items or layers they block from removal, enforcing realistic clothing physics.

---

## Background

The clothing system currently allows unrealistic removal scenarios where dependent items (e.g., belts and pants) can be removed independently. When an actor wears a belt (layer: `accessories`, primary slot: `torso_lower`) and pants (layer: `base`, primary slot: `legs`, coverage_mapping: `["torso_lower"]`), both items appear in the `topmost_clothing` scope and can be removed independently.

This violates real-world clothing physics where:
- Belts must be removed before pants (belt secures pants)
- Armor blocks access to underlying clothing
- Tucked/buttoned items create dependencies

---

## Requirements

### Component Definition

**File**: `data/mods/clothing/components/blocks_removal.component.json`

**Purpose**: Declares which items or layers this item blocks from removal while worn.

**Schema Structure**:

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "clothing:blocks_removal",
  "description": "Defines what items or layers this item blocks from removal while it remains equipped. Used to enforce realistic clothing physics (e.g., belts blocking pants removal).",
  "dataSchema": {
    "type": "object",
    "properties": {
      "blockedSlots": {
        "type": "array",
        "description": "List of slot/layer combinations that cannot be removed while this item is worn",
        "items": {
          "type": "object",
          "properties": {
            "slot": {
              "type": "string",
              "enum": [
                "torso_upper",
                "torso_lower",
                "legs",
                "feet",
                "head_gear",
                "hands",
                "left_arm_clothing",
                "right_arm_clothing"
              ],
              "description": "Equipment slot that is blocked"
            },
            "layers": {
              "type": "array",
              "description": "Layers in the blocked slot that cannot be removed",
              "items": {
                "type": "string",
                "enum": ["underwear", "base", "outer", "accessories"]
              },
              "minItems": 1,
              "uniqueItems": true
            },
            "blockType": {
              "type": "string",
              "enum": [
                "must_remove_first",
                "must_loosen_first",
                "full_block"
              ],
              "description": "Type of blocking: must_remove_first (this item must be removed), must_loosen_first (this item must be loosened), full_block (complete inaccessibility)"
            },
            "reason": {
              "type": "string",
              "minLength": 1,
              "description": "Human-readable explanation of why blocking occurs (for error messages)"
            }
          },
          "required": ["slot", "layers", "blockType"],
          "additionalProperties": false
        },
        "minItems": 1
      },
      "blocksRemovalOf": {
        "type": "array",
        "description": "Specific item IDs that cannot be removed while this item is worn (for explicit item-to-item blocking)",
        "items": {
          "type": "string",
          "pattern": "^[a-zA-Z0-9_]+:[a-zA-Z0-9_]+$"
        },
        "uniqueItems": true
      }
    },
    "anyOf": [
      { "required": ["blockedSlots"] },
      { "required": ["blocksRemovalOf"] }
    ],
    "additionalProperties": false
  }
}
```

### Design Rationale

1. **Slot-Based Blocking** (`blockedSlots`):
   - Declares blocking by slot/layer combination (generic, reusable)
   - Supports blocking multiple layers in a slot
   - Allows cross-slot blocking (accessory in `torso_lower` blocks items in `legs`)

2. **Item-Specific Blocking** (`blocksRemovalOf`):
   - Explicit item ID blocking for special cases
   - Useful for quest items or unique clothing combinations
   - Less common than slot-based blocking

3. **Block Types**:
   - `must_remove_first`: This item must be removed before blocked item (standard case)
   - `must_loosen_first`: This item must be loosened but not removed (future: belt loosening)
   - `full_block`: Complete inaccessibility (armor covering clothing completely)

4. **Reason Field**:
   - Optional but recommended for clear error messages
   - Provides context for why removal is blocked

---

## Implementation Tasks

### 1. Create Component Schema File

Create `data/mods/clothing/components/blocks_removal.component.json` with the full schema definition above.

### 2. Validate Schema

Run validation to ensure the schema is correctly formatted:

```bash
npm run validate
```

Expected output: All schemas valid, no errors.

### 3. Create Unit Tests

**File**: `tests/unit/mods/clothing/components/blocksRemoval.test.js`

**Test Coverage**:

```javascript
describe('clothing:blocks_removal Component', () => {
  describe('Schema Validation', () => {
    it('should validate component with blockedSlots', () => {
      // Valid slot-based blocking
    });

    it('should validate component with blocksRemovalOf', () => {
      // Valid item ID blocking
    });

    it('should validate component with both blockedSlots and blocksRemovalOf', () => {
      // Both blocking methods
    });

    it('should reject component without blockedSlots or blocksRemovalOf', () => {
      // Must have at least one
    });

    it('should reject invalid slot names', () => {
      // Invalid equipment slot
    });

    it('should reject invalid layer names', () => {
      // Invalid layer value
    });

    it('should reject invalid blockType', () => {
      // Invalid block type
    });

    it('should reject empty layers array', () => {
      // minItems: 1 requirement
    });

    it('should reject duplicate layers', () => {
      // uniqueItems requirement
    });

    it('should reject invalid item ID pattern in blocksRemovalOf', () => {
      // Pattern validation
    });
  });
});
```

### 4. Document Component

Add inline documentation to the schema file explaining:
- Purpose and use cases
- Each field's meaning
- Example usage scenarios

---

## Validation

### Schema Validation

```bash
npm run validate
```

Must pass without errors.

### Unit Tests

```bash
NODE_ENV=test npm run test:unit -- tests/unit/mods/clothing/components/blocksRemoval.test.js
```

Must achieve 100% coverage for schema validation tests.

### Type Checking

```bash
npm run typecheck
```

Must pass without errors.

---

## Example Usage

### Belt Blocking Pants

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:black_calfskin_belt",
  "description": "Black calfskin belt with brushed-brass buckle",
  "components": {
    "core:name": {
      "text": "belt"
    },
    "clothing:wearable": {
      "layer": "accessories",
      "equipmentSlots": {
        "primary": "torso_lower"
      },
      "allowedLayers": ["accessories"]
    },
    "clothing:blocks_removal": {
      "blockedSlots": [
        {
          "slot": "legs",
          "layers": ["base", "outer"],
          "blockType": "must_remove_first",
          "reason": "Belt secures pants at waist"
        }
      ]
    }
  }
}
```

### Armor Blocking Clothing

```json
{
  "id": "armor:plate_cuirass",
  "components": {
    "clothing:wearable": {
      "layer": "outer",
      "equipmentSlots": {
        "primary": "torso_upper"
      }
    },
    "clothing:blocks_removal": {
      "blockedSlots": [
        {
          "slot": "torso_upper",
          "layers": ["base", "underwear"],
          "blockType": "full_block",
          "reason": "Plate armor completely covers torso"
        }
      ]
    }
  }
}
```

---

## Acceptance Criteria

- [ ] Component schema file created at correct location
- [ ] Schema validates successfully with `npm run validate`
- [ ] Schema includes all required fields and proper structure
- [ ] Unit tests created with comprehensive coverage
- [ ] All unit tests pass
- [ ] Type checking passes
- [ ] Inline documentation added to schema
- [ ] Component follows project naming conventions
- [ ] Schema properly extends base component schema

---

## Notes

- This component is **optional** - existing clothing without it continues working
- Blocking only activates when component is present
- Ensures backward compatibility with existing content
- Foundation for all subsequent blocking system features

---

## Related Tickets

- **CLOREMBLO-002**: Implement IsRemovalBlockedOperator (depends on this)
- **CLOREMBLO-003**: Register operator in DI container (depends on this)
- **CLOREMBLO-006**: Update belt entities with blocking component (depends on this)
