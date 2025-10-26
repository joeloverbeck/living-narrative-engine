# Positioning Mod Multi-Target Migration Specification

## Executive Summary

This specification outlines the migration of the positioning mod actions from the legacy single-target format to the new multi-target format. The migration affects 5 action files in the positioning mod, with 3 actions requiring format updates and 2 actions already compatible with the new format.

## Migration Status Overview

### Actions Requiring Migration (Current State)

1. **positioning:turn_around_to_face** - Uses deprecated `scope` property and contains deprecated `commandVerb` field
2. **physical-control:turn_around** (formerly `positioning:turn_around`) - Uses deprecated `scope` property (has `prerequisites` array already)
3. **positioning:get_close** - Uses deprecated `scope` property (has `prerequisites` array already)
4. **positioning:step_back** - Uses deprecated `scope` property with "none" value (has `prerequisites` array already)

### Actions Already Migrated

1. **positioning:kneel_before** - Already uses multi-target format correctly with `targets` object

## Detailed Migration Plan

### 1. positioning:turn_around_to_face

**Current Structure:**

```json
{
  "scope": "positioning:actors_im_facing_away_from",
  "required_components": {
    "actor": ["positioning:closeness", "positioning:facing_away"]
  },
  "template": "turn around to face {target}"
}
```

**Migrated Structure:**

```json
{
  "targets": {
    "primary": {
      "scope": "positioning:actors_im_facing_away_from",
      "placeholder": "target",
      "description": "Actor to turn around and face"
    }
  },
  "required_components": {
    "actor": ["positioning:closeness", "positioning:facing_away"]
  },
  "template": "turn around to face {target}",
  "prerequisites": []
}
```

**Additional Changes:**

- Remove deprecated `commandVerb` field
- Add empty `prerequisites` array for consistency

### 2. physical-control:turn_around (formerly positioning:turn_around)

**Current Structure:**

```json
{
  "scope": "positioning:close_actors_facing_each_other_or_behind_target",
  "required_components": {
    "actor": ["positioning:closeness"]
  },
  "forbidden_components": {
    "actor": ["intimacy:kissing"]
  },
  "template": "turn {target} around"
}
```

**Migrated Structure:**

```json
{
  "targets": {
    "primary": {
      "scope": "positioning:close_actors_facing_each_other_or_behind_target",
      "placeholder": "target",
      "description": "Actor to turn around"
    }
  },
  "required_components": {
    "actor": ["positioning:closeness"]
  },
  "forbidden_components": {
    "actor": ["intimacy:kissing"]
  },
  "template": "turn {target} around",
  "prerequisites": []
}
```

### 3. positioning:get_close

**Current Structure:**

```json
{
  "scope": "core:actors_in_location",
  "required_components": {},
  "template": "get close to {target}",
  "prerequisites": [...]
}
```

**Migrated Structure:**

```json
{
  "targets": {
    "primary": {
      "scope": "core:actors_in_location",
      "placeholder": "target",
      "description": "Actor to get close to"
    }
  },
  "required_components": {},
  "template": "get close to {target}",
  "prerequisites": [...]
}
```

### 4. positioning:step_back

**Current Structure:**

```json
{
  "scope": "none",
  "required_components": {
    "actor": ["positioning:closeness"]
  },
  "template": "step back"
}
```

**Migrated Structure:**

```json
{
  "targets": "none",
  "required_components": {
    "actor": ["positioning:closeness"]
  },
  "template": "step back",
  "prerequisites": []
}
```

**Note:** Actions with no targets can use the string format `"targets": "none"` as seen in the schema examples.

### 5. positioning:kneel_before

**Status:** Already correctly migrated to multi-target format. No changes needed.

## Rules and Conditions Updates

The existing rules and conditions do not require modification as they:

1. Reference actions by their ID (e.g., `positioning:turn_around_to_face`)
2. Access event payload data that remains unchanged
3. The multi-target format maintains backward compatibility for single-target actions

**No changes required for:**

- `data/mods/positioning/rules/*.rule.json`
- `data/mods/positioning/conditions/*.condition.json`

## Test Suite Updates

The following test files will need to be verified after migration but should not require changes due to backward compatibility:

### Integration Tests

- `tests/integration/mods/positioning/turn_around_action.test.js`
- `tests/integration/mods/positioning/turn_around_to_face_action.test.js`
- `tests/integration/mods/positioning/kneel_before_action.test.js`
- `tests/integration/rules/turnAroundRule.integration.test.js`
- `tests/integration/rules/turnAroundToFaceRule.integration.test.js`
- `tests/integration/rules/getCloseRule.integration.test.js`
- `tests/integration/rules/stepBackRule.integration.test.js`
- `tests/integration/rules/closenessActionAvailability.integration.test.js`
- `tests/integration/actions/pipeline/kneelBeforeResolution.test.js`

### Unit Tests

- `tests/unit/mods/positioning/actions/turnAroundAction.test.js`
- `tests/unit/actions/actionIndex.allComponents.test.js`
- `tests/unit/entities/multiTarget/attemptActionSchemaFixVerification.test.js`
- `tests/unit/domUI/actionButtonsRenderer.namespaceGrouping.test.js`

### End-to-End Tests

- `tests/e2e/actions/CrossModActionIntegration.e2e.test.js`

## Scope Files

No changes required for scope files. The following scope files exist and remain compatible with the new format:

- `data/mods/positioning/scopes/actors_im_facing_away_from.scope`
- `data/mods/positioning/scopes/close_actors_facing_each_other_or_behind_target.scope`
- `data/mods/positioning/scopes/close_actors.scope`

These scopes are referenced in the mod manifest and work correctly with both the legacy and new multi-target formats.

## Implementation Checklist

- [ ] Update `positioning:turn_around_to_face.action.json`
  - [ ] Replace `scope` with `targets` object
  - [ ] Remove deprecated `commandVerb` field (currently "turn-around-to-face")
  - [ ] Add `prerequisites` array (currently missing)
- [ ] Update `positioning:turn_around.action.json`
  - [ ] Replace `scope` with `targets` object
  - [ ] Prerequisites array already exists (empty)
- [ ] Update `positioning:get_close.action.json`
  - [ ] Replace `scope` with `targets` object
  - [ ] Prerequisites array already exists (with condition)
- [ ] Update `positioning:step_back.action.json`
  - [ ] Replace `scope: "none"` with `targets: "none"` (string format)
  - [ ] Prerequisites array already exists (empty)
- [ ] Run all positioning mod tests to verify backward compatibility
- [ ] Run full test suite to ensure no regressions

## Migration Benefits

1. **Consistency**: All actions use the same modern format
2. **Future-proofing**: Ready for potential multi-target expansions
3. **Deprecation removal**: Eliminates use of deprecated `scope` property
4. **Schema compliance**: Full compliance with current action.schema.json

## Risk Assessment

**Low Risk Migration** - The changes are:

- Schema-compliant
- Backward compatible
- Well-tested with existing test coverage
- Straightforward property renaming/restructuring
- No logic changes required

## Validation Steps

1. Run JSON schema validation on all modified action files
2. Execute positioning mod test suite
3. Verify action discovery works correctly in-game
4. Test each action manually to ensure proper behavior
5. Check that rules still trigger correctly

## Notes

- The `{target}` placeholder in templates remains unchanged
- The multi-target format supports both object and string formats for `targets`
- The `commandVerb` field is completely deprecated and not used anywhere in the source code
- Actions with `"targets": "none"` or `"targets": "self"` don't require target resolution
- The migration maintains full backward compatibility with existing game logic
