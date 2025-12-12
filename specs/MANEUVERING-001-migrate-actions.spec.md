# Migration of Place Yourself Behind Action to Maneuvering Mod

## 1. Overview

This specification outlines the creation of a new mod, `maneuvering`, and the migration of the `place_yourself_behind` action (and its exclusive dependencies) from the `positioning` mod. This new mod represents actions related to gaining a positional advantage, such as flanking.

## 2. New Mod: Maneuvering

*   **Path**: `data/mods/maneuvering/`
*   **Dependencies**: `positioning` (Must be declared in `mod-manifest.json`)
*   **Color Scheme**: **Midnight Green** (7.3)
    *   **Reasoning**: "Midnight Green" (`#004d40`) offers a tactical, stealth-like aesthetic fitting for maneuvering and gaining advantage, distinct from the "Deep Orange" of basic positioning.
    *   **Definition**:
        ```json
        {
          "backgroundColor": "#004d40",
          "textColor": "#b2dfdb",
          "hoverBackgroundColor": "#00695c",
          "hoverTextColor": "#e0f2f1"
        }
        ```

## 3. Migration Scope

The following files will be moved from `data/mods/positioning/` to `data/mods/maneuvering/`. IDs within these files and references to them must be updated from `positioning:*` to `maneuvering:*`.

| File Type | Original Path (in `data/mods/positioning/`) | New Path (in `data/mods/maneuvering/`) | New ID |
| :--- | :--- | :--- | :--- |
| **Action** | `actions/place_yourself_behind.action.json` | `actions/place_yourself_behind.action.json` | `maneuvering:place_yourself_behind` |
| **Rule** | `rules/place_yourself_behind.rule.json` | `rules/place_yourself_behind.rule.json` | `handle_place_yourself_behind` (Rule IDs are often unique keys, but verify naming convention) |
| **Condition** | `conditions/event-is-action-place-yourself-behind.condition.json` | `conditions/event-is-action-place-yourself-behind.condition.json` | `maneuvering:event-is-action-place-yourself-behind` |
| **Scope** | `scopes/actors_in_location_not_facing_away_from_actor.scope` | `scopes/actors_in_location_not_facing_away_from_actor.scope` | `maneuvering:actors_in_location_not_facing_away_from_actor` |
| **Event** | `events/actor_placed_behind.event.json` | `events/actor_placed_behind.event.json` | `maneuvering:actor_placed_behind` |

### 3.1. Files Remaining in Positioning

All other files in `positioning` must remain. The `maneuvering` mod will depend on `positioning` to access shared components like `positioning:facing_away`.

## 4. Implementation Steps

1.  **Create Mod Structure**:
    *   Create `data/mods/maneuvering/` with subdirectories: `actions`, `rules`, `conditions`, `scopes`, `events`.
    *   Create `data/mods/maneuvering/mod-manifest.json` with dependency on `positioning`.

2.  **Move Files**:
    *   Move the files listed in Section 3 to their new locations.

3.  **Update Content & IDs**:
    *   **Action**: Update `id`, `scope` reference, `visual` (to Midnight Green). Keep `required_components` and `forbidden_components` referencing `positioning:*` as appropriate (since `maneuvering` depends on `positioning`).
    *   **Rule**: Update `rule_id` (if namespaced), `condition` reference, `event_type` dispatch (`maneuvering:actor_placed_behind`).
        *   **Crucial**: The rule logic modifies `positioning:facing_away`. This is valid as `maneuvering` depends on `positioning`.
    *   **Condition**: Update `id` and the logic checking for `maneuvering:place_yourself_behind`.
    *   **Scope**: Update definition to be `maneuvering:actors_in_location_not_facing_away_from_actor`.
    *   **Event**: Update `id`.

4.  **Update Manifests**:
    *   **Positioning**: Remove the migrated files from `data/mods/positioning/mod-manifest.json`.
    *   **Maneuvering**: Register the new files in `data/mods/maneuvering/mod-manifest.json`.

5.  **Documentation**:
    *   Update `docs/mods/mod-color-schemes.md`:
        *   Mark **Midnight Green (7.3)** as **In Use** by **Maneuvering**.
        *   Update its "Use Cases" to include "Maneuvering, tactical advantage".

6.  **Tests**:
    *   Search for all references to `positioning:place_yourself_behind` in `tests/` and update them to `maneuvering:place_yourself_behind`.
    *   Ensure integration tests for the action still pass.

## 5. Validation

*   Run `npm run validate:ecosystem` to ensure all IDs and references resolve correctly.
*   Run tests to verify functionality.
