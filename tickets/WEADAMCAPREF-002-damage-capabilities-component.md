# WEADAMCAPREF-002: Create damage_capabilities component

## Summary

Create the `damage-types:damage_capabilities` component definition that weapons will use to declare their damage types and amounts. This component replaces the marker-only `can_cut` component with a data-rich structure.

## Dependencies

- WEADAMCAPREF-001 (damage-capability-entry schema must exist)

## Files to Touch

| File | Action | Description |
|------|--------|-------------|
| `data/mods/damage-types/components/damage_capabilities.component.json` | CREATE | New component definition |
| `data/mods/damage-types/mod-manifest.json` | UPDATE | Add component to manifest |

## Out of Scope

- Weapon entity migrations (WEADAMCAPREF-009)
- Service changes (WEADAMCAPREF-004)
- Operator implementation (WEADAMCAPREF-003)
- Removing `can_cut` component (WEADAMCAPREF-011)

## Implementation Details

### Component Definition

Create `data/mods/damage-types/components/damage_capabilities.component.json`:

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "damage-types:damage_capabilities",
  "description": "Defines damage types and amounts a weapon can inflict, including effect configurations",
  "dataSchema": {
    "type": "object",
    "properties": {
      "entries": {
        "type": "array",
        "description": "Array of damage type entries this weapon can inflict",
        "minItems": 1,
        "items": {
          "$ref": "schema://living-narrative-engine/damage-capability-entry.schema.json"
        }
      }
    },
    "required": ["entries"],
    "additionalProperties": false
  }
}
```

### Manifest Update

Add to `data/mods/damage-types/mod-manifest.json` components array:
```json
"components": [
  "components/can_cut.component.json",
  "components/damage_capabilities.component.json"
]
```

## Acceptance Criteria

### Tests That Must Pass

1. `npm run validate` - All mod validation passes
2. `npm run validate:mod:damage-types` - Specific mod validation passes (if command exists)
3. Unit test verifying component schema loads correctly

### Invariants That Must Remain True

1. Component ID follows naming convention: `damage-types:damage_capabilities`
2. Component $ref correctly references the schema from WEADAMCAPREF-001
3. `entries` array requires at least 1 item (`minItems: 1`)
4. Existing `can_cut` component remains unchanged (removed in later ticket)
5. Mod manifest remains valid JSON with proper structure

## Estimated Size

- 1 new component file (~20 lines)
- 1 manifest update (~2 lines changed)
