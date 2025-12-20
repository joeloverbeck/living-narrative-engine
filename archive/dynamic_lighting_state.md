# Dynamic Lighting State From Lit Entities

## Overview

This spec replaces the location-level `locations:light_sources` component with a dynamic lighting query. The lighting system should derive light availability from lit entities in the location and in inventories carried by entities in that location. This removes the need for mod rules to maintain a per-location array of light sources.

## Current Usage Analysis

### Component Definitions

- `data/mods/locations/components/naturally_dark.component.json`
  - Marker component that declares a location has no ambient light.
- `data/mods/locations/components/light_sources.component.json`
  - Stores `sources: string[]` listing active light source entity IDs.

### Runtime Logic

- `src/locations/services/lightingStateService.js`
  - Uses `locations:naturally_dark` to determine whether to check `locations:light_sources`.
  - If naturally dark and `light_sources.sources` is non-empty, the location is lit.
- `src/perception/services/perceptionFilterService.js`
  - Calls `LightingStateService.getLocationLightingState()` during perceptible event dispatch filtering.
- `src/domUI/locationRenderer.js` and `src/data/providers/locationSummaryProvider.js`
  - Rely on `LightingStateService` for lit/dark UI state.

### Mod Rules

- `data/mods/lighting/rules/handle_ignite_light_source.rule.json`
  - Adds `lighting:is_lit` to the target.
  - Updates `locations:light_sources` by inserting the lit entity ID.
- `data/mods/lighting/rules/handle_extinguish_light_source.rule.json`
  - Removes `lighting:is_lit` from the target.
  - Updates `locations:light_sources` by removing the entity ID.

### Mod Data

- `data/mods/locations/mod-manifest.json` includes `light_sources.component.json`.
- Dredgers location definitions include `locations:light_sources` initialized with empty `sources`.
  - Examples: `data/mods/dredgers/entities/definitions/lower_gallery.location.json`,
    `data/mods/dredgers/entities/definitions/segment_b.location.json`.

### Tests

The component and rule wiring is covered in multiple test suites, including:

- `tests/unit/locations/services/lightingStateService.test.js`
- `tests/unit/mods/locations/components/lightingComponents.test.js`
- `tests/integration/mods/locations/modManifestValidation.test.js`
- `tests/integration/mods/dredgers/lightingComponents.integration.test.js`
- `tests/integration/mods/lighting/ignite_light_source_rule_execution.test.js`
- `tests/integration/mods/lighting/extinguish_light_source_rule_execution.test.js`
- `tests/integration/prompting/locationSummaryProviderLighting.integration.test.js`
- `tests/common/mods/lighting/lightingFixtures.js`

## Problem Statement

`locations:light_sources` is maintained by mod rules, but moving lit items between locations (including via inventory transfer) requires manual updates that are not modeled today. This breaks when actors move while holding lit items. The lighting decision should be an engine-level concern derived from entity state, not a rule-level bookkeeping task.

## Goals

- Remove `locations:light_sources` entirely.
- Stop rules from manually adding/removing light sources on locations.
- Determine whether a naturally dark location is lit by checking:
  1) Any entity present in the location that has `lighting:is_lit`.
  2) Any entity in that location that has an inventory containing an entity with `lighting:is_lit`.
- Update tests to reflect the new lighting model.

## Non-Goals

- No changes to `lighting:is_lit` semantics or to the ignition/extinguish actions themselves.
- No automatic handling of nested container inventories (containers inside inventories).
- No changes to non-lighting perception logic beyond the lighting check itself.

## Proposed Changes

### 1) Remove `locations:light_sources`

- Delete `data/mods/locations/components/light_sources.component.json`.
- Remove `light_sources.component.json` from `data/mods/locations/mod-manifest.json`.
- Remove any `locations:light_sources` entries from location definitions (e.g., dredgers underground locations).

### 2) Remove Manual Light Source Bookkeeping in Rules

Update lighting rules to stop adding or removing `locations:light_sources`:

- `data/mods/lighting/rules/handle_ignite_light_source.rule.json`
  - Keep `ADD_COMPONENT` for `lighting:is_lit`.
  - Remove the `QUERY_COMPONENT`, `IF`, `ADD_COMPONENT`, and `MODIFY_ARRAY_FIELD` actions that mutate `locations:light_sources`.

- `data/mods/lighting/rules/handle_extinguish_light_source.rule.json`
  - Keep `REMOVE_COMPONENT` for `lighting:is_lit`.
  - Remove the `QUERY_COMPONENT`, `IF`, and `MODIFY_ARRAY_FIELD` actions that mutate `locations:light_sources`.

### 3) Dynamic Lighting Computation

Update `src/locations/services/lightingStateService.js` to compute light sources dynamically.

Behavior:

- If `locations:naturally_dark` is absent: return `{ isLit: true, lightSources: [] }` (ambient light).
- If `locations:naturally_dark` is present:
  - Query the location membership via `entityManager.getEntitiesInLocation(locationId)`.
  - A location is lit if ANY of the following are true:
    - An entity in the location has `lighting:is_lit`.
    - An entity in the location has `items:inventory` containing an entity with `lighting:is_lit`.

Suggested algorithm (single inventory level):

```javascript
const entities = entityManager.getEntitiesInLocation(locationId) ?? new Set();
const litSources = new Set();

for (const entityId of entities) {
  if (entityManager.hasComponent(entityId, 'lighting:is_lit')) {
    litSources.add(entityId);
    continue;
  }

  const inventory = entityManager.getComponentData(entityId, 'items:inventory');
  const items = Array.isArray(inventory?.items) ? inventory.items : [];
  for (const itemId of items) {
    if (entityManager.hasComponent(itemId, 'lighting:is_lit')) {
      litSources.add(itemId);
    }
  }
}

return { isLit: litSources.size > 0, lightSources: [...litSources] };
```

Notes:

- Update dependency validation to require `getEntitiesInLocation` on the entity manager.
- Keep `lightSources` in the returned structure for compatibility, but populate it from dynamic detection.
- `lightSources` should be unique IDs (deduplicate via `Set`). Order is not specified.
- Limit inventory scan to one level deep (no container traversal).

### 4) Test Updates

Adjust tests to align with the new model. Expected changes include:

- Lighting state service unit tests should cover:
  - Naturally lit locations (no `locations:naturally_dark`).
  - Naturally dark with lit entity in location.
  - Naturally dark with lit entity in inventory of an entity in location.
  - Naturally dark with no lit entities anywhere.
- Rule execution tests should assert only `lighting:is_lit` mutations; remove assertions about `locations:light_sources`.
- Mod manifest and component schema tests should drop `locations:light_sources`.
- Dredgers lighting component tests should no longer assert `locations:light_sources` presence.
- Fixture helpers that build locations with light sources should be removed or replaced.

Primary files to touch:

- `tests/unit/locations/services/lightingStateService.test.js`
- `tests/unit/mods/locations/components/lightingComponents.test.js`
- `tests/integration/mods/locations/modManifestValidation.test.js`
- `tests/integration/mods/dredgers/lightingComponents.integration.test.js`
- `tests/integration/mods/lighting/ignite_light_source_rule_execution.test.js`
- `tests/integration/mods/lighting/extinguish_light_source_rule_execution.test.js`
- `tests/integration/prompting/locationSummaryProviderLighting.integration.test.js`
- `tests/common/mods/lighting/lightingFixtures.js`

## Migration Notes

- Existing content packs that include `locations:light_sources` should remove those components.
- Mods that relied on manually updating `locations:light_sources` can simply add/remove `lighting:is_lit` on the light source entity; the engine will handle lighting state.

## Success Criteria

- `locations:light_sources` component no longer exists in data or manifests.
- `LightingStateService` determines lighting solely from dynamic entity state.
- Ignition/extinguish rules no longer mutate location state.
- All affected unit/integration tests are updated and passing.
