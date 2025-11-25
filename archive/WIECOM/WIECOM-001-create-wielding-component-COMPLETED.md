# WIECOM-001: Create Wielding Component Definition

**Status:** ✅ COMPLETED

## Summary

Create the `positioning:wielding` component that tracks items being actively wielded by an actor in a combat-ready or threatening manner.

## Files to Touch

| File | Action | Description |
|------|--------|-------------|
| `data/mods/positioning/components/wielding.component.json` | CREATE | New component definition |

## Out of Scope

- **DO NOT** modify `mod-manifest.json` (see WIECOM-002)
- **DO NOT** modify any rule files (see WIECOM-003)
- **DO NOT** modify any source code files
- **DO NOT** create any test files (see WIECOM-006)
- **DO NOT** add appendage mapping properties
- **DO NOT** add wielding style properties (one-handed, two-handed, dual-wield)

## Implementation Details

Create component with:
1. `wielded_item_ids` array (required, uniqueItems, references `namespacedId`)
2. `activityMetadata` object with:
   - `shouldDescribeInActivity` (default: true)
   - `template` (default: "{actor} is wielding {targets} threateningly")
   - `targetRole` (default: "wielded_item_ids")
   - `targetRoleIsArray` (default: true) - **NEW FIELD for array support**
   - `priority` (default: 70)

### Component Structure

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "positioning:wielding",
  "description": "Tracks items an actor is actively wielding in a combat-ready or threatening manner. Presence indicates the actor has one or more items in wielding stance.",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["wielded_item_ids"],
    "properties": {
      "wielded_item_ids": {
        "type": "array",
        "description": "Entity IDs of items currently being wielded. Order may indicate primary/secondary preference.",
        "uniqueItems": true,
        "default": [],
        "items": {
          "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId"
        }
      },
      "activityMetadata": {
        "type": "object",
        "description": "Inline metadata for activity description generation.",
        "additionalProperties": false,
        "properties": {
          "shouldDescribeInActivity": {
            "type": "boolean",
            "default": true,
            "description": "Whether this component should be included in activity descriptions."
          },
          "template": {
            "type": "string",
            "default": "{actor} is wielding {targets} threateningly",
            "description": "Template with {targets} placeholder for multiple item names."
          },
          "targetRole": {
            "type": "string",
            "default": "wielded_item_ids",
            "description": "Property containing target entity IDs."
          },
          "targetRoleIsArray": {
            "type": "boolean",
            "default": true,
            "description": "Signals that targetRole points to an array, enabling list formatting."
          },
          "priority": {
            "type": "integer",
            "minimum": 0,
            "maximum": 100,
            "default": 70,
            "description": "Display priority for activity ordering. 70 = active combat stance."
          }
        }
      }
    }
  }
}
```

## Reference Files

Study these before implementation:
- `data/mods/positioning/components/hugging.component.json` - activityMetadata pattern
- `data/mods/positioning/components/kneeling_before.component.json` - priority pattern

## Acceptance Criteria

### Specific Tests That Must Pass

After WIECOM-006 creates tests:
- Valid empty array: `{ wielded_item_ids: [] }` → PASS
- Valid single item: `{ wielded_item_ids: ['sword-1'] }` → PASS
- Valid multiple items: `{ wielded_item_ids: ['sword-1', 'dagger-2'] }` → PASS
- Valid with activityMetadata: `{ wielded_item_ids: ['sword'], activityMetadata: { shouldDescribeInActivity: true } }` → PASS
- Invalid missing wielded_item_ids: `{}` → FAIL
- Invalid items as string: `{ wielded_item_ids: 'sword' }` → FAIL
- Invalid non-string in array: `{ wielded_item_ids: [123] }` → FAIL
- Invalid additional properties: `{ wielded_item_ids: [], extra: 'bad' }` → FAIL
- Valid namespaced IDs: `{ wielded_item_ids: ['weapons:silver_revolver'] }` → PASS

### Invariants That Must Remain True

1. Component follows `component.schema.json` structure
2. `wielded_item_ids` is always an array (enforced by schema)
3. Array items reference valid entity ID format
4. `additionalProperties: false` prevents schema pollution
5. Component ID uses `positioning:` namespace

### Validation Commands

```bash
# Verify JSON syntax
node -e "JSON.parse(require('fs').readFileSync('data/mods/positioning/components/wielding.component.json'))"

# Full validation will require WIECOM-002 first (manifest registration)
```

## Priority Justification

Priority 70 chosen because:
- Wielding is more visually/tactically significant than sitting (62) or hugging (66)
- Less prominent than kneeling (75) which has social/power dynamics
- Represents an active state that significantly changes character perception

---

## Outcome

**Completion Date:** 2025-11-25

### What Was Actually Changed vs Originally Planned

**Matched Plan Exactly:**
- Created `data/mods/positioning/components/wielding.component.json` with the exact structure specified in the ticket
- All fields match the specification including:
  - `wielded_item_ids` array with `uniqueItems: true`, `default: []`, and `namespacedId` reference
  - `activityMetadata` object with all specified properties and defaults
  - `additionalProperties: false` enforced at both object levels

**Assumptions Verified:**
- Reference files (`hugging.component.json`, `kneeling_before.component.json`) confirmed the activityMetadata pattern
- `namespacedId` reference verified to exist in `common.schema.json` at `#/definitions/namespacedId`
- `targetRoleIsArray` is a forward-looking field (WIECOM-004 will implement the system support) - acceptable to define in schema

**Validation Performed:**
- JSON syntax validation: ✅ PASSED

**Tests:** Per ticket instructions, test creation is deferred to WIECOM-006.
