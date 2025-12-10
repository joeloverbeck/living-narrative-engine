# Migration Spec: Item Handling Actions

## Goal
Migrate item manipulation actions (`pick_up_item`, `drop_item`, `drop_wielded_item`) from the `items` mod to a new dedicated `item-handling` mod to better organize the codebase around "changing what I'm holding/owning".

## 1. New Mod Creation
Create a new mod directory: `data/mods/item-handling/`
Required structure:
```
data/mods/item-handling/
├── actions/
├── scopes/
├── mod-manifest.json
└── README.md
```

**Manifest (`mod-manifest.json`):**
- **ID:** `item-handling`
- **Name:** "Item Handling"
- **Description:** "Actions for picking up, dropping, and manipulating items."
- **Dependencies:**
  - `items` (For inventory components and shared scopes)
  - `positioning` (For handling wielded items and forbidden states)
  - `anatomy` (For appendage checks)
  - `core` (Standard dependency)

## 2. File Migration
Move the following files.

| Source | Destination | Notes |
|--------|-------------|-------|
| `data/mods/items/actions/pick_up_item.action.json` | `data/mods/item-handling/actions/pick_up_item.action.json` | Update ID to `item-handling:pick_up_item` |
| `data/mods/items/actions/drop_item.action.json` | `data/mods/item-handling/actions/drop_item.action.json` | Update ID to `item-handling:drop_item` |
| `data/mods/items/actions/drop_wielded_item.action.json` | `data/mods/item-handling/actions/drop_wielded_item.action.json` | Update ID to `item-handling:drop_wielded_item` |
| `data/mods/items/scopes/non_wielded_inventory_items.scope` | `data/mods/item-handling/scopes/non_wielded_inventory_items.scope` | Update ID in file (if present) and refs |

**Files NOT migrating (Shared Dependencies):**
- `items:items_at_location` (Scope) - Used by other systems.
- `items:inventory` (Component) - Core item system.
- `items:wielded_items` (Scope) - Shared with `unwield` (which stays in `items`).

## 3. Content Updates

### A. ID Renaming
In all migrated files, rename the action IDs:
- `items:pick_up_item` -> `item-handling:pick_up_item`
- `items:drop_item` -> `item-handling:drop_item`
- `items:drop_wielded_item` -> `item-handling:drop_wielded_item`
- `items:non_wielded_inventory_items` -> `item-handling:non_wielded_inventory_items`

### B. Reference Updates
1.  **In `data/mods/item-handling/actions/drop_item.action.json`**:
    - Update target scope ref: `items:non_wielded_inventory_items` -> `item-handling:non_wielded_inventory_items`

2.  **In `data/mods/item-handling/scopes/non_wielded_inventory_items.scope`**:
    - Ensure the definition is correct (it references `actor.components.items:inventory` which is fine as an external ref).

### C. Color Scheme
1.  **Update `docs/mods/mod-color-schemes.md`**:
    - Add a new "Tactile Brown" scheme to a suitable section (e.g., "4. Nature/Environment" or a new "Physical/Interaction" section).
    - **Tactile Brown Definition:**
        ```json
        {
          "backgroundColor": "#5d4037",
          "textColor": "#efebe9",
          "hoverBackgroundColor": "#6d4c41",
          "hoverTextColor": "#ffffff"
        }
        ```
    - Mark it as **IN USE: Item-Handling**.

2.  **Update Action Visuals**:
    - Update the `visual` property in the three migrated action files to use the new **Tactile Brown** values.

## 4. Test Updates
Search for and update all references to the old IDs in the `tests/` directory.
- Pattern: `items:pick_up_item` -> `item-handling:pick_up_item`
- Pattern: `items:drop_item` -> `item-handling:drop_item`
- Pattern: `items:drop_wielded_item` -> `item-handling:drop_wielded_item`

**Key Test Files to Check:**
- `tests/unit/common/mods/ModTestFixture.autoRegistration.test.js`
- `tests/unit/goap/refinement/primitiveActionStepExecutor.test.js`
- `tests/integration/mods/items/*.test.js` (Note: Some of these tests might need to be moved to `tests/integration/mods/item-handling/` if they are specific to these actions, but renaming the IDs in place is the priority).

## 5. Verification
1.  Run `npm run validate:ecosystem` to ensure JSON integrity and schema compliance.
2.  Run `npm run test:unit` and `npm run test:integration` to ensure no regressions.
