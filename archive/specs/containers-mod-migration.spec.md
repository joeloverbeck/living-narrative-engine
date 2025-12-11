# Containers Mod Migration Specification

## Objective
Migrate container-related actions and logic from the `items` mod to a new dedicated `containers` mod to improve modularity. Handle resulting cyclical dependencies by extracting shared primitives to a `containers-core` mod.

## Scope
The following files currently in `items` mod are in scope for migration:

**Actions (Source of Migration):**
- `data/mods/containers/actions/put_in_container.action.json`
- `data/mods/containers/actions/take_from_container.action.json`
- `data/mods/containers/actions/open_container.action.json`

**Related Logic (To be migrated):**
- `data/mods/containers/rules/handle_put_in_container.rule.json`
- `data/mods/containers/rules/handle_take_from_container.rule.json`
- `data/mods/containers/rules/handle_open_container.rule.json`
- `data/mods/items/events/item_put_in_container.event.json`
- `data/mods/items/events/item_taken_from_container.event.json`
- `data/mods/items/events/container_opened.event.json`
- `data/mods/containers/conditions/event-is-action-put-in-container.condition.json`
- `data/mods/containers/conditions/event-is-action-take-from-container.condition.json`
- `data/mods/containers/conditions/event-is-action-open-container.condition.json`

**Common Primitives (To be extracted):**
- `data/mods/items/components/container.component.json`
- `data/mods/items/components/liquid_container.component.json` (Likely related)
- `data/mods/items/scopes/container_contents.scope`
- `data/mods/items/scopes/open_containers_at_location.scope`
- `data/mods/items/scopes/openable_containers_at_location.scope`

## Dependency Analysis & Architecture

### The Cycle
1. **Actions** (e.g., `put_in_container`) depend on `items:inventory` (to take items from) and `containers-core:container` (to put items into).
2. **Items** (e.g., specific chest definitions in `items` mod) depend on `containers-core:container` component.

If we simply move everything to `containers`:
- `containers` depends on `items` (for Inventory).
- `items` depends on `containers` (for Container Component).
-> **Cyclical Dependency**.

### The Solution: `containers-core`
We will create two new mods:

1.  **`containers-core`**:
    - **Purpose**: Holds the structural definitions (Components, Scopes) needed by both actions and item definitions.
    - **Contents**:
        - `container.component.json`
        - `liquid_container.component.json`
        - `container_contents.scope`
        - `open_containers_at_location.scope`
        - `openable_containers_at_location.scope`
    - **Dependencies**: None (or minimal `core`).

2.  **`containers`**:
    - **Purpose**: Holds the interaction logic (Actions, Rules, Events).
    - **Contents**:
        - All Actions listed in Scope.
        - All Rules, Events, and Conditions listed in Scope.
    - **Dependencies**:
        - `containers-core` (for the container definitions).
        - `items` (for `inventory` component and related item logic).

3.  **`items` (Existing)**:
    - **Changes**:
        - Remove migrated files.
        - Add dependency on `containers-core`.
    - **Retains**:
        - `inventory` component.
        - Item definitions (which will now reference `containers-core:container`).

## Visual Design (Color Scheme)

### Analysis of `docs/mods/mod-color-schemes.md`
Current available schemes do not adequately convey the "Storage/Logistics" theme of the `containers` mod. Most available schemes are System/Alert focused.

### New Color Scheme
We will define a new WCAG-compliant color scheme for the `containers` mod.

**Name**: Depot Olive
**Section**: 18. Physical/Interaction Colors (Extension) or new Category.
**Visual Properties**:
```json
{
  "backgroundColor": "#354230",
  "textColor": "#ffffff",
  "hoverBackgroundColor": "#455740",
  "hoverTextColor": "#f0f4f0"
}
```
*Note: This must be verified for WCAG AA compliance (4.5:1).*

### Implementation Steps
1.  Update `docs/mods/mod-color-schemes.md`:
    - Add **Depot Olive** definition.
    - Mark it as **IN USE: Containers**.
2.  Update the `visual` property of all migrated Actions in `containers` mod to use this new scheme.

## Implementation Plan

### 1. Create Directories
- `data/mods/containers-core/`
- `data/mods/containers/`
- Replicate subfolder structure (`actions`, `components`, `rules`, etc.).

### 2. Move Files & Rename IDs
**Phase A: `containers-core`**
- Move `container.component.json` -> `data/mods/containers-core/components/container.component.json`
    - Update ID: `containers-core:container` -> `containers-core:container`
- Move scopes -> `data/mods/containers-core/scopes/`
    - Update IDs (e.g., `containers-core:container_contents` -> `containers-core:contents`)
    - Update internal references to `containers-core:container`.

**Phase B: `containers`**
- Move Actions, Rules, Events, Conditions -> `data/mods/containers/...`
- Update IDs (e.g., `containers:put_in_container` -> `containers:put_in_container`)
- Update references:
    - `containers-core:container` -> `containers-core:container`
    - `items:inventory` -> `items:inventory` (Unchanged, cross-mod dependency)
    - Apply new **Depot Olive** color scheme to actions.

### 3. Update `items` Mod
- Update `package.json` (or equivalent mod config if exists, otherwise implicit) to reflect dependency on `containers-core`.
- Update any Item definitions (e.g., generic chest) in `data/mods/items/entities/` (if any) to use `containers-core:container`.

### 4. Global Reference Update
- Search and Replace all occurrences of:
    - `containers-core:container` -> `containers-core:container`
    - `containers:put_in_container` -> `containers:put_in_container`
    - `containers:take_from_container` -> `containers:take_from_container`
    - `containers:open_container` -> `containers:open_container`
    - `containers-core:container_contents` -> `containers-core:contents` (check naming)
    - `containers-core:open_containers_at_location` -> `containers-core:open_containers_at_location`

### 5. Verification
- **Tests**:
    - Run `npm run validate:ecosystem` to ensure JSON schemas and references are valid.
    - Run `npm run test:unit` and `npm run test:integration`.
    - Specifically verify that item interactions (put/take) still function in game logic.

## Acceptance Criteria
1. `containers` and `containers-core` mods exist.
2. No cyclical dependencies exist between `items`, `containers`, and `containers-core`.
3. `mod-color-schemes.md` includes the new "Depot Olive" scheme assigned to `containers`.
4. All migrated actions use the new color scheme.
5. `npm run validate:ecosystem` passes.
6. All tests pass.
