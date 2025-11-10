# WEASYSIMP-008: Create Weapons Mod Marker Component

**Phase:** Weapons Mod Core
**Timeline:** 0.5 days
**Status:** Not Started
**Dependencies:** WEASYSIMP-002 (Weapons Mod Manifest)
**Priority:** P0 (Blocking)

## Overview

Create the `weapons:weapon` marker component to identify weapon entities. This component serves as the base identifier for all weapon-type items.

## Objectives

1. Create `weapons:weapon` marker component
2. Validate component schema
3. Prepare for weapon-specific components

## Technical Details

### File to Create

**File:** `data/mods/weapons/components/weapon.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "weapons:weapon",
  "description": "Marker component identifying an item as a weapon. All weapons must have this component along with items:item, items:portable, and items:aimable.",
  "dataSchema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}
```

**Component Notes:**
- **Type:** Marker component (no data fields)
- **Purpose:** Identify entities as weapons for filtering and categorization
- **Used With:** Always combined with `items:item`, `items:portable`, `items:aimable`
- **Pattern:** Same as `items:item`, `items:portable` marker components

## Acceptance Criteria

- [ ] `weapon.component.json` created at `data/mods/weapons/components/`
- [ ] Valid JSON syntax
- [ ] Validates against `component.schema.json`
- [ ] Component ID is `weapons:weapon`
- [ ] Empty properties object (marker component)
- [ ] `npm run validate` passes

## Testing

```bash
# Validate
node -e "JSON.parse(require('fs').readFileSync('data/mods/weapons/components/weapon.component.json'))" && echo "✓ Valid"
npm run validate
```

## Related Tickets

- **Depends On:** WEASYSIMP-002
- **Blocks:** WEASYSIMP-009, WEASYSIMP-011-015 (all weapon actions)
