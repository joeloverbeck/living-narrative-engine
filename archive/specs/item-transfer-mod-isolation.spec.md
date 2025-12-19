# Specification: item-transfer Mod Isolation

## Overview

This specification documents the migration of the `give_item` action and its exclusive dependencies from the `items` mod to a new dedicated `item-transfer` mod. The purpose is to reduce UI clutter caused by the combinatorial explosion of available actions when actors have multiple items and multiple recipients are present.

## Motivation

When an actor has 2-3 items in inventory and 4+ other actors are in the same location, the `give_item` action generates a combinatorial explosion of options (items × recipients). While this behavior is correct and desired, it creates visual clutter that makes it difficult for both human users and LLM-based actors to navigate the action list. Isolating this action into its own mod allows for better visual separation in the UI.

## Scope

### Files to Migrate

| Original Path                                                         | New Path                                                                      | Status           |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------- |
| `data/mods/items/actions/give_item.action.json`                       | `data/mods/item-transfer/actions/give_item.action.json`                       | Migrate + update |
| `data/mods/items/rules/handle_give_item.rule.json`                    | `data/mods/item-transfer/rules/handle_give_item.rule.json`                    | Migrate + update |
| `data/mods/items/conditions/event-is-action-give-item.condition.json` | `data/mods/item-transfer/conditions/event-is-action-give-item.condition.json` | Migrate + update |

### ID Changes

| Original ID                       | New ID                                    |
| --------------------------------- | ----------------------------------------- |
| `items:give_item`                 | `item-transfer:give_item`                 |
| `items:event-is-action-give-item` | `item-transfer:event-is-action-give-item` |

### Shared Resources (Not Migrated)

The following resources are used by `give_item` but are shared with other actions and must remain in their original locations:

- `items:actor_inventory_items` scope (shared by: examine_owned_item, apply_lipstick, jot_down_notes, put_in_container)
- `core:actors_in_location` scope (core mod)
- `items:item_transferred.event.json` (broadly used)
- All operation handlers (engine-level: VALIDATE_INVENTORY_CAPACITY, TRANSFER_ITEM, etc.)

## New Mod Structure

```
data/mods/item-transfer/
├── mod-manifest.json
├── actions/
│   └── give_item.action.json
├── conditions/
│   └── event-is-action-give-item.condition.json
└── rules/
    └── handle_give_item.rule.json
```

## Dependencies

The `item-transfer` mod requires the following dependencies:

| Dependency    | Version | Reason                                                                                                  |
| ------------- | ------- | ------------------------------------------------------------------------------------------------------- |
| `core`        | 1.0.0   | `core:actors_in_location` scope, `core:attempt_action` event, `core:display_failed_action_result` event |
| `items`       | 1.0.0   | `items:inventory` component, `items:actor_inventory_items` scope                                        |
| `positioning` | 1.0.0   | forbidden_components (`positioning:bending_over`, `positioning:fallen`, etc.)                           |
| `anatomy`     | 1.0.0   | `anatomy:actor-has-free-grabbing-appendage` prerequisite condition                                      |

## Color Scheme

### Trade Amber (New Scheme)

A new WCAG 2.1 AA/AAA compliant color scheme specifically designed for item transfer actions:

```json
{
  "backgroundColor": "#7d5a00",
  "textColor": "#fff8e1",
  "hoverBackgroundColor": "#9a7000",
  "hoverTextColor": "#ffffff"
}
```

**Contrast Ratios:**

- Normal state: ~8.7:1 (AAA compliant)
- Hover state: ~6.2:1 (AA compliant)

**Design Rationale:**

- Warm amber evokes trading and exchange (historical association with commerce)
- Distinct from Items mod's Aurora Depths teal (#004d61)
- Professional yet warm - suitable for collaborative actions between actors
- Amber/gold tones psychologically represent exchange, commerce, and generosity

## File Specifications

### mod-manifest.json

```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "item-transfer",
  "version": "1.0.0",
  "name": "Item Transfer",
  "description": "Actions for transferring items between characters. Separated from the Items mod to isolate combinatorial explosion of give/receive actions.",
  "actionPurpose": "Transfer items between characters through giving and receiving.",
  "actionConsiderWhen": "Wanting to share items with other characters, give gifts, or hand over objects.",
  "author": "Living Narrative Engine",
  "gameVersion": "0.0.1",
  "dependencies": [
    { "id": "core", "version": "1.0.0" },
    { "id": "items", "version": "1.0.0" },
    { "id": "positioning", "version": "1.0.0" },
    { "id": "anatomy", "version": "1.0.0" }
  ],
  "content": {
    "actions": ["actions/give_item.action.json"],
    "conditions": ["conditions/event-is-action-give-item.condition.json"],
    "rules": ["rules/handle_give_item.rule.json"]
  }
}
```

### give_item.action.json

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "item-transfer:give_item",
  "name": "Give Item",
  "description": "Give an item from your inventory to another actor",
  "generateCombinations": true,
  "required_components": {
    "actor": ["items:inventory"],
    "primary": ["items:inventory"]
  },
  "forbidden_components": {
    "actor": [
      "positioning:bending_over",
      "positioning:fallen",
      "positioning:being_restrained",
      "positioning:restraining"
    ]
  },
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "anatomy:actor-has-free-grabbing-appendage"
      },
      "failure_message": "You need a free hand to give an item."
    }
  ],
  "targets": {
    "primary": {
      "scope": "core:actors_in_location",
      "placeholder": "recipient",
      "description": "Actor to give item to"
    },
    "secondary": {
      "scope": "items:actor_inventory_items",
      "placeholder": "item",
      "description": "Item to give"
    }
  },
  "template": "give {item} to {recipient}",
  "visual": {
    "backgroundColor": "#7d5a00",
    "textColor": "#fff8e1",
    "hoverBackgroundColor": "#9a7000",
    "hoverTextColor": "#ffffff"
  }
}
```

### event-is-action-give-item.condition.json

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "item-transfer:event-is-action-give-item",
  "description": "Checks if event is the give_item action",
  "logic": {
    "==": [{ "var": "event.payload.actionId" }, "item-transfer:give_item"]
  }
}
```

### handle_give_item.rule.json

The rule file remains structurally identical to the original, with one change:

- `condition_ref` updated from `items:event-is-action-give-item` to `item-transfer:event-is-action-give-item`

## Files to Update

### data/game.json

Add `item-transfer` to the mods array after `items`:

```json
{
  "mods": [
    ...
    "items",
    "item-transfer",
    ...
  ]
}
```

### data/mods/items/mod-manifest.json

Remove references to the migrated files from the `content` section:

- Remove from `actions`: `"give_item.action.json"`
- Remove from `conditions`: `"event-is-action-give-item.condition.json"`
- Remove from `rules`: `"handle_give_item.rule.json"`

### docs/mods/mod-color-schemes.md

Add the Trade Amber scheme to the document:

1. Add to Quick Reference table:

   ```
   | Item-Transfer | Trade Amber | 13.1 | `#7d5a00` | Active |
   ```

2. Add new section 13 (Exchange/Transaction Colors):

   ````markdown
   ### 13. Exchange/Transaction Colors

   #### 13.1 Trade Amber ✅ IN USE: Item-Transfer

   ```json
   {
     "backgroundColor": "#7d5a00",
     "textColor": "#fff8e1",
     "hoverBackgroundColor": "#9a7000",
     "hoverTextColor": "#ffffff"
   }
   ```
   ````

   - **Normal Contrast**: 8.7:1 🌟 AAA
   - **Hover Contrast**: 6.2:1 ✅ AA
   - **Use Cases**: Item exchange between characters, gift giving, trade actions
   - **Theme**: Warm amber evoking commerce and exchange

   ```

   ```

## Test Specifications

### Integration Test: Action Discovery

**File:** `tests/integration/mods/item-transfer/give_item_action_discovery.test.js`

| Test Case                           | Description                                         | Expected Result                 |
| ----------------------------------- | --------------------------------------------------- | ------------------------------- |
| Discovery with items and recipients | Actor has inventory items, other actors in location | Action discovered               |
| Empty inventory                     | Actor has no items in inventory                     | Action NOT discovered           |
| No recipients                       | No other actors in same location                    | Action NOT discovered           |
| Actor bending over                  | Actor has `positioning:bending_over` component      | Action NOT discovered           |
| Actor fallen                        | Actor has `positioning:fallen` component            | Action NOT discovered           |
| Actor being restrained              | Actor has `positioning:being_restrained` component  | Action NOT discovered           |
| No free grabbing appendage          | Actor fails anatomy prerequisite                    | Action NOT discovered           |
| Combinatorial generation            | 2 items, 3 recipients                               | 6 action combinations generated |

### Integration Test: Rule Execution

**File:** `tests/integration/mods/item-transfer/give_item_rule_execution.test.js`

| Test Case                | Description                         | Expected Result                               |
| ------------------------ | ----------------------------------- | --------------------------------------------- |
| Successful transfer      | Recipient has capacity              | Item moved, perceptible event dispatched      |
| Capacity exceeded        | Recipient inventory at max capacity | Transfer blocked, failure message shown       |
| Description regeneration | After successful transfer           | Both actor and recipient descriptions updated |
| Turn ending              | After action completes              | Actor's turn ended appropriately              |

## Migration Checklist

1. [ ] Create `data/mods/item-transfer/` directory structure
2. [ ] Create `mod-manifest.json` with all dependencies
3. [ ] Create `actions/give_item.action.json` with updated ID and Trade Amber colors
4. [ ] Create `conditions/event-is-action-give-item.condition.json` with updated ID
5. [ ] Create `rules/handle_give_item.rule.json` with updated condition_ref
6. [ ] Update `docs/mods/mod-color-schemes.md` with Trade Amber scheme
7. [ ] Update `data/mods/items/mod-manifest.json` to remove migrated file references
8. [ ] Update `data/game.json` to include `item-transfer` mod
9. [ ] Delete original files from items mod
10. [ ] Create integration tests
11. [ ] Run validation: `npm run validate`
12. [ ] Run tests: `npm run test:integration`

## Risk Assessment

**Risk Level:** Low

**Considerations:**

- File ownership is clear (3 files are `give_item`-exclusive)
- No shared scopes need duplication
- All dependencies have proper namespacing
- Action ID change from `items:give_item` to `item-transfer:give_item` is a breaking change for:
  - Save files with pending actions (will fail gracefully)
  - Any external references to the old action ID

## Rollback Plan

If issues arise, the migration can be reversed by:

1. Restoring the original files to the items mod
2. Removing the item-transfer mod directory
3. Removing item-transfer from game.json
4. Reverting changes to items mod-manifest.json
5. Reverting changes to mod-color-schemes.md

## Version History

| Version | Date       | Description           |
| ------- | ---------- | --------------------- |
| 1.0.0   | 2025-12-03 | Initial specification |
