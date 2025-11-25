# UNWITEACT-003: Create `unwield_item.action.json` File

## Summary

Create the action definition file for the `unwield_item` action. This action allows an actor to stop wielding an item, freeing up their grabbing appendages.

## Dependencies

- **UNWITEACT-001** (scope file) must be completed - the action references `weapons:wielded_items` scope

## File to Create

### `data/mods/weapons/actions/unwield_item.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "weapons:unwield_item",
  "name": "Unwield Item",
  "description": "Stop wielding an item, freeing up your hands",
  "generateCombinations": true,
  "required_components": {
    "actor": [
      "items:inventory",
      "positioning:wielding"
    ]
  },
  "targets": {
    "primary": {
      "scope": "weapons:wielded_items",
      "placeholder": "target",
      "description": "Item to stop wielding"
    }
  },
  "template": "unwield {target}",
  "visual": {
    "backgroundColor": "#112a46",
    "textColor": "#e6f1ff",
    "hoverBackgroundColor": "#0b3954",
    "hoverTextColor": "#f0f4f8"
  }
}
```

## Files to Modify

None

## Out of Scope

- **DO NOT** modify `wield_threateningly.action.json`
- **DO NOT** create or modify any rule files
- **DO NOT** modify the weapons mod manifest (actions are auto-discovered)
- **DO NOT** modify any existing scope or condition files
- **DO NOT** add any prerequisite checks (unlike wield, unwield doesn't need to check for free appendage)

## Key Design Decisions

### Why `required_components.actor` includes `positioning:wielding`

Unlike `wield_threateningly` which only requires `items:inventory`, the `unwield_item` action requires:
- `items:inventory` - actor must have inventory system
- `positioning:wielding` - actor must currently be wielding something

This ensures the action only appears when there are items to unwield.

### Why no `prerequisites`

The `wield_threateningly` action has a prerequisite checking for a free grabbing appendage:
```json
"prerequisites": [
  {
    "logic": { "condition_ref": "anatomy:actor-has-free-grabbing-appendage" },
    "failure_message": "You need at least one free hand or appendage to wield a weapon."
  }
]
```

The `unwield_item` action does NOT need this because:
- We're releasing an appendage, not acquiring one
- The `positioning:wielding` component requirement already ensures there's something to unwield

### Visual consistency

Uses the same "Arctic Steel" color scheme as `wield_threateningly` to maintain visual consistency for weapons-related actions.

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run validate                           # Schema validation passes
npm run test:integration -- --testPathPattern="weapons"  # Existing weapons tests still pass
```

### Manual Verification

1. Action file exists at `data/mods/weapons/actions/unwield_item.action.json`
2. File is valid JSON
3. File passes schema validation against `action.schema.json`
4. `id` field is `weapons:unwield_item`
5. `required_components.actor` includes BOTH `items:inventory` AND `positioning:wielding`
6. `targets.primary.scope` is `weapons:wielded_items` (created in UNWITEACT-001)
7. No `prerequisites` field exists

### Invariants That Must Remain True

1. All existing weapons tests pass
2. `wield_threateningly.action.json` is NOT modified
3. No changes to any other files in the repository
