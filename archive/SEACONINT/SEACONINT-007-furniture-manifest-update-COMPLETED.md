# SEACONINT-007: Update Furniture Mod Manifest

**Status**: ✅ COMPLETED
**Priority**: MEDIUM
**Estimated Effort**: 15-20 minutes
**Dependencies**: SEACONINT-001, SEACONINT-003, SEACONINT-004, SEACONINT-005
**Blocks**: None (final integration step)

## Outcome

### What Was Originally Planned
Update the furniture mod manifest to register all new content created by the SEACONINT feature:
- 1 component
- 2 actions
- 2 conditions
- 2 rules
- 1 scope

### What Was Actually Changed
**Exactly as planned.** The manifest was updated with:
- `components`: Added `near_furniture.component.json`
- `actions`: Added `put_on_nearby_surface.action.json`, `take_from_nearby_surface.action.json`
- `conditions`: Added `event-is-action-put-on-nearby-surface.condition.json`, `event-is-action-take-from-nearby-surface.condition.json`
- `rules`: Added `handle_put_on_nearby_surface.rule.json`, `handle_take_from_nearby_surface.rule.json`
- `scopes`: Added `open_containers_on_nearby_furniture.scope`

### Assumptions Validated
All ticket assumptions were correct:
- All referenced files existed on disk before the manifest update
- The manifest structure matched expectations
- No discrepancies between ticket scope and actual requirements

### Verification Results
- ✅ `npm run validate` - PASSED (0 violations)
- ✅ `tests/integration/loaders/modsLoader.integration.test.js` - 7 tests passed
- ✅ `tests/integration/mods/furniture/` - 4 tests passed
- ✅ `tests/unit/logic/operators/isOnNearbyFurnitureOperator.test.js` - 13 tests passed

---

## Original Ticket Content

## Objective

Update the furniture mod manifest to register all new content created by the SEACONINT feature.

## Files To Create

None.

## Files To Modify

| File | Change |
|------|--------|
| `data/mods/furniture/mod-manifest.json` | Add components, actions, conditions, rules, and scopes |

## Out of Scope

- **DO NOT** modify the fantasy mod manifest
- **DO NOT** modify the items mod manifest
- **DO NOT** modify any other mod manifests
- **DO NOT** change the mod version (unless explicitly requested)
- **DO NOT** add new dependencies

## Implementation Details

### Current Manifest Structure

```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "furniture",
  "version": "1.0.0",
  "name": "Furniture",
  "description": "Provides reusable furniture entity definitions including beds, sofas, chairs, and benches with positioning capabilities.",
  "author": "Living Narrative Engine",
  "gameVersion": ">=0.0.1",
  "dependencies": [
    { "id": "core", "version": "^1.0.0" },
    { "id": "items", "version": "^1.0.0" },
    { "id": "positioning", "version": "^1.0.0" }
  ],
  "content": {
    "components": [],
    "actions": [],
    "conditions": [],
    "rules": [],
    "entities": {
      "definitions": [/* existing definitions */],
      "instances": []
    },
    "events": [],
    "macros": [],
    "scopes": []
  }
}
```

### Updated Manifest

```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "furniture",
  "version": "1.0.0",
  "name": "Furniture",
  "description": "Provides reusable furniture entity definitions including beds, sofas, chairs, and benches with positioning capabilities.",
  "author": "Living Narrative Engine",
  "gameVersion": ">=0.0.1",
  "dependencies": [
    { "id": "core", "version": "^1.0.0" },
    { "id": "items", "version": "^1.0.0" },
    { "id": "positioning", "version": "^1.0.0" }
  ],
  "content": {
    "components": [
      "near_furniture.component.json"
    ],
    "actions": [
      "take_from_nearby_surface.action.json",
      "put_on_nearby_surface.action.json"
    ],
    "conditions": [
      "event-is-action-take-from-nearby-surface.condition.json",
      "event-is-action-put-on-nearby-surface.condition.json"
    ],
    "rules": [
      "handle_take_from_nearby_surface.rule.json",
      "handle_put_on_nearby_surface.rule.json"
    ],
    "entities": {
      "definitions": [/* unchanged */],
      "instances": []
    },
    "events": [],
    "macros": [],
    "scopes": [
      "open_containers_on_nearby_furniture.scope"
    ]
  }
}
```

### Summary of Changes

| Content Type | Files Added |
|--------------|-------------|
| components | `near_furniture.component.json` |
| actions | `take_from_nearby_surface.action.json`, `put_on_nearby_surface.action.json` |
| conditions | `event-is-action-take-from-nearby-surface.condition.json`, `event-is-action-put-on-nearby-surface.condition.json` |
| rules | `handle_take_from_nearby_surface.rule.json`, `handle_put_on_nearby_surface.rule.json` |
| scopes | `open_containers_on_nearby_furniture.scope` |

## Acceptance Criteria

### Tests That Must Pass

1. `npm run validate` passes for the manifest ✅
2. Mod manifest schema validation passes ✅
3. All referenced files exist in their respective directories ✅
4. The furniture mod loads successfully at runtime ✅

### Invariants That Must Remain True

1. Mod ID remains `furniture` ✅
2. Mod version remains unchanged ✅
3. Existing dependencies remain unchanged ✅
4. Existing entity definitions remain in the manifest ✅
5. Manifest remains valid JSON ✅

## Verification Commands

```bash
# Validate manifest and all referenced files
npm run validate

# Run mod loading tests
npm run test:integration -- --testPathPattern="modsLoader"

# Ensure no regressions
npm run test:ci
```

## Directory Structure After Changes

```
data/mods/furniture/
├── mod-manifest.json           # Updated
├── components/
│   └── near_furniture.component.json   # New
├── actions/
│   ├── take_from_nearby_surface.action.json    # New
│   └── put_on_nearby_surface.action.json       # New
├── conditions/
│   ├── event-is-action-take-from-nearby-surface.condition.json  # New
│   └── event-is-action-put-on-nearby-surface.condition.json     # New
├── rules/
│   ├── handle_take_from_nearby_surface.rule.json    # New
│   └── handle_put_on_nearby_surface.rule.json       # New
├── scopes/
│   └── open_containers_on_nearby_furniture.scope    # New
└── entities/
    └── definitions/
        └── (existing files unchanged)
```
