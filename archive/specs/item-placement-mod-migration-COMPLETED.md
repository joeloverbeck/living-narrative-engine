# Mod Migration Spec: Item Placement

## Objective
Migrate `put_on_nearby_surface` and `take_from_nearby_surface` actions and their related dependencies from the `furniture` mod to a new `item-placement` mod. This mod will focus on "on top of / on a surface" interactions (staging, tidying, leaving evidence).

## Analysis
The following files are currently located in `furniture` mod but are self-contained enough (or their dependencies are specific enough) to be moved to `item-placement`.

### Files to Migrate
1.  **Actions**:
    *   `data/mods/furniture/actions/put_on_nearby_surface.action.json`
    *   `data/mods/furniture/actions/take_from_nearby_surface.action.json`
2.  **Scopes**:
    *   `data/mods/furniture/scopes/open_containers_on_nearby_furniture.scope`
        *   *Note*: Only used by the above actions.
3.  **Rules**:
    *   `data/mods/furniture/rules/handle_put_on_nearby_surface.rule.json`
    *   `data/mods/furniture/rules/handle_take_from_nearby_surface.rule.json`
4.  **Conditions**:
    *   `data/mods/furniture/conditions/event-is-action-put-on-nearby-surface.condition.json`
    *   `data/mods/furniture/conditions/event-is-action-take-from-nearby-surface.condition.json`
5.  **Tests**:
    *   `tests/integration/mods/furniture/putOnNearbySurfaceActionDiscovery.test.js`
    *   `tests/integration/mods/furniture/takeFromNearbySurfaceActionDiscovery.test.js`

### Dependencies
The migrated files depend on:
*   `items` mod (inventory, containers) - External, remain as dependency.
*   `positioning` mod (sitting_on) - External, remain as dependency.
*   `anatomy` mod (appendages) - External, remain as dependency.
*   `core` mod (position, events) - External, remain as dependency.
*   `isNearbyFurniture` operator - Defined in `src/`, available globally.

The `furniture` mod will **not** be a dependency of `item-placement` because the specific scope `open_containers_on_nearby_furniture` is being moved to `item-placement`.

## New Mod Structure: `item-placement`
Create the following structure:
```
data/mods/item-placement/
├── mod-manifest.json
├── actions/
│   ├── put_on_nearby_surface.action.json
│   └── take_from_nearby_surface.action.json
├── scopes/
│   └── open_containers_on_nearby_furniture.scope
├── rules/
│   ├── handle_put_on_nearby_surface.rule.json
│   └── handle_take_from_nearby_surface.rule.json
└── conditions/
    ├── event-is-action-put-on-nearby-surface.condition.json
    └── event-is-action-take-from-nearby-surface.condition.json
```

## Color Scheme
The current color scheme used is `Aurora Depths` (Teal), which belongs to `Items`. Since `Item-Placement` is a distinct concept about surfaces and stability, we will introduce a new fitting color scheme.

**Selected Scheme: "Foundation Earth"**
*   **Background**: `#3e2723` (Dark Brown)
*   **Text**: `#ffffff` (White)
*   **Hover Background**: `#4e342e` (Lighter Brown)
*   **Hover Text**: `#efebe9` (Off-white)
*   **WCAG Compliance**: High contrast (approx 13:1), suitable for AA/AAA.
*   **Theme**: Stability, surfaces, grounding.

This scheme should be added to `docs/mods/mod-color-schemes.md` under a new or existing category (e.g., "18. Physical/Interaction Colors") and marked as **Active** for `Item-Placement`.

## Implementation Steps

1.  **Create New Mod**:
    *   Create `data/mods/item-placement/mod-manifest.json`.
    *   Define dependencies (`core`, `items`, `positioning`, `anatomy`).

2.  **Move Files**:
    *   Move actions, scopes, rules, and conditions from `furniture` to `item-placement`.
    *   Move tests from `tests/integration/mods/furniture/` to `tests/integration/mods/item-placement/`.

3.  **Update Namespaces & Content**:
    *   Rename identifiers in all moved files:
        *   `furniture:put_on_nearby_surface` -> `item-placement:put_on_nearby_surface`
        *   `furniture:take_from_nearby_surface` -> `item-placement:take_from_nearby_surface`
        *   `furniture:open_containers_on_nearby_furniture` -> `item-placement:open_containers_on_nearby_furniture`
        *   `furniture:handle_put_on_nearby_surface` -> `item-placement:handle_put_on_nearby_surface`
        *   `furniture:handle_take_from_nearby_surface` -> `item-placement:handle_take_from_nearby_surface`
        *   `furniture:event-is-action-...` -> `item-placement:event-is-action-...`
    *   Update `visual` property in actions to use the new "Foundation Earth" color scheme.

4.  **Update `furniture` Mod**:
    *   Remove references to moved files from `data/mods/furniture/mod-manifest.json`.

5.  **Update Documentation**:
    *   Add "Foundation Earth" to `docs/mods/mod-color-schemes.md`.
    *   Mark it as used by `Item-Placement`.

6.  **Verify & Test**:
    *   Run `npm run validate:ecosystem` to ensure manifest and JSON validity.
    *   Run `npm run test:integration` to ensure the migrated tests pass and no regressions occur.
    *   Verify no other files in `furniture` referenced the moved files (confirmed by analysis).

## Verification Criteria
*   New mod `item-placement` exists and is valid.
*   `furniture` mod is valid and no longer contains the moved actions.
*   All migrated actions use the new color scheme.
*   All tests in `tests/integration/mods/item-placement/` pass.
*   Global validation (`npm run validate:ecosystem`) passes.
