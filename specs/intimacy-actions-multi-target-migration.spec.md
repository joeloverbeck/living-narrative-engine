# Intimacy Actions Multi-Target Format Migration Specification

## Overview

This specification documents the migration of all intimacy mod actions from the legacy single-target `scope` format to the new multi-target `targets` format. This migration is part of the broader effort to standardize action definitions across the Living Narrative Engine.

## Background

The action schema (`data/schemas/action.schema.json`) supports two formats:

1. **Legacy Format**: Uses the deprecated `scope` property for single-target actions
2. **New Format**: Uses the `targets` property supporting both single and multi-target actions

The `adjust_clothing` action has already been migrated to demonstrate multi-target support. The remaining 24 actions need migration.

## Migration Scope

### Actions to Migrate (24 of 25 total)

The intimacy mod contains 25 actions total. One action (`adjust_clothing`) has already been migrated to the new `targets` format. The remaining 24 actions are currently single-target using the legacy `scope` format and need to be migrated to use the `targets` string format:

| Action ID                               | Current Scope                                                           | Template                                      |
| --------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------- |
| `intimacy:accept_kiss_passively`        | `intimacy:current_kissing_partner`                                      | `accept {target}'s kiss passively`            |
| `intimacy:break_kiss_gently`            | `intimacy:current_kissing_partner`                                      | `break kiss with {target} gently`             |
| `intimacy:brush_hand`                   | `positioning:close_actors`                                              | `brush {target}'s hand lightly`               |
| `intimacy:cup_face_while_kissing`       | `intimacy:current_kissing_partner`                                      | `cup {target}'s face while kissing`           |
| `intimacy:explore_mouth_with_tongue`    | `intimacy:current_kissing_partner`                                      | `explore {target}'s mouth with your tongue`   |
| `intimacy:feel_arm_muscles`             | `intimacy:actors_with_muscular_arms_facing_each_other_or_behind_target` | `feel {target}'s arm muscles`                 |
| `intimacy:fondle_ass`                   | `intimacy:actors_with_ass_cheeks_facing_each_other_or_behind_target`    | `fondle {target}'s ass`                       |
| `intimacy:kiss_back_passionately`       | `intimacy:current_kissing_partner`                                      | `kiss {target} back passionately`             |
| `intimacy:kiss_cheek`                   | `intimacy:close_actors_facing_each_other`                               | `kiss {target}'s cheek`                       |
| `intimacy:kiss_neck_sensually`          | `intimacy:actors_with_arms_facing_each_other_or_behind_target`          | `kiss {target}'s neck sensually`              |
| `intimacy:lean_in_for_deep_kiss`        | `intimacy:actors_with_mouth_facing_each_other`                          | `lean in for a deep kiss with {target}`       |
| `intimacy:lick_lips`                    | `intimacy:close_actors_facing_each_other`                               | `lick lips while looking at {target}`         |
| `intimacy:massage_back`                 | `intimacy:close_actors_facing_away`                                     | `massage {target}'s back`                     |
| `intimacy:massage_shoulders`            | `intimacy:actors_with_arms_facing_each_other_or_behind_target`          | `massage {target}'s shoulders`                |
| `intimacy:nibble_earlobe_playfully`     | `intimacy:close_actors_facing_each_other_or_behind_target`              | `nibble {target}'s earlobe playfully`         |
| `intimacy:nibble_lower_lip`             | `intimacy:current_kissing_partner`                                      | `nibble {target}'s lower lip`                 |
| `intimacy:nuzzle_face_into_neck`        | `intimacy:close_actors_facing_each_other`                               | `nuzzle face into {target}'s neck`            |
| `intimacy:peck_on_lips`                 | `intimacy:close_actors_facing_each_other`                               | `peck {target} on the lips`                   |
| `intimacy:place_hand_on_waist`          | `positioning:close_actors`                                              | `place a hand on {target}'s waist`            |
| `intimacy:pull_back_breathlessly`       | `intimacy:current_kissing_partner`                                      | `pull back from {target}'s kiss breathlessly` |
| `intimacy:pull_back_in_revulsion`       | `intimacy:current_kissing_partner`                                      | `pull back from {target} in revulsion`        |
| `intimacy:suck_on_neck_to_leave_hickey` | `intimacy:close_actors_facing_each_other_or_behind_target`              | `suck on {target}'s neck to leave a hickey`   |
| `intimacy:suck_on_tongue`               | `intimacy:current_kissing_partner`                                      | `suck on {target}'s tongue`                   |
| `intimacy:thumb_wipe_cheek`             | `intimacy:close_actors_facing_each_other`                               | `wipe {target}'s cheek with your thumb`       |

## Migration Patterns

### Action File Migration

Each action file needs the following changes:

#### Before (Legacy Format)

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "intimacy:kiss_cheek",
  "name": "Kiss Cheek",
  "description": "Lean in and softly kiss the target on the cheek.",
  "scope": "intimacy:close_actors_facing_each_other",
  "required_components": {
    "actor": ["positioning:closeness"]
  },
  "forbidden_components": {
    "actor": ["intimacy:kissing"]
  },
  "template": "kiss {target}'s cheek",
  "prerequisites": []
}
```

#### After (New Format - String Variant)

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "intimacy:kiss_cheek",
  "name": "Kiss Cheek",
  "description": "Lean in and softly kiss the target on the cheek.",
  "targets": "intimacy:close_actors_facing_each_other",
  "required_components": {
    "actor": ["positioning:closeness"]
  },
  "forbidden_components": {
    "actor": ["intimacy:kissing"]
  },
  "template": "kiss {target}'s cheek",
  "prerequisites": []
}
```

### Alternative: Object Format

While the string format is simpler for single-target actions, the object format can also be used:

```json
{
  "targets": {
    "primary": {
      "scope": "intimacy:close_actors_facing_each_other",
      "placeholder": "target",
      "description": "Actor to kiss on the cheek"
    }
  }
}
```

**Recommendation**: Use the simpler string format for all single-target actions to maintain consistency with other mods (core, positioning).

## Rule Compatibility

### No Changes Required

The existing rules will continue to work without modification because:

1. **Single-target actions** continue to use `targetId` in the event payload
2. **Entity references** continue to use `"target"` for single-target actions
3. **Conditions** only check the `actionId`, not the action definition

Example rule (no changes needed):

```json
{
  "actions": [
    {
      "type": "GET_NAME",
      "parameters": {
        "entity_ref": "target",
        "result_variable": "targetName"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "targetId",
        "value": "{event.payload.targetId}"
      }
    }
  ]
}
```

## Test Compatibility

### No Changes Required

Existing tests should continue to pass without modification because:

1. **Action IDs** remain unchanged
2. **Event structure** remains unchanged for single-target actions
3. **Rule behavior** remains unchanged

Tests that may need attention:

- Schema validation tests that directly check for the `scope` property
- Integration tests that construct action objects programmatically

## Action Tracing Configuration

The Living Narrative Engine includes an action tracing system (`src/configuration/actionTraceConfigLoader.js`) that can trace action execution for debugging purposes. This system:

- Supports wildcard patterns for tracing specific actions or mods
- Works with both legacy `scope` and new `targets` formats
- Does not require changes as part of this migration
- Can be used to verify that migrated actions execute correctly

Example trace configuration that would trace all intimacy actions:

```json
{
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["intimacy:*"],
    "outputDirectory": "./traces/actions",
    "verbosity": "detailed"
  }
}

## Implementation Steps

### Phase 1: Action Migration
1. For each of the 24 action files:
   - Replace `"scope": "..."` with `"targets": "..."`
   - Ensure no file contains both properties
   - Validate against the action schema

### Phase 2: Validation
1. Run schema validation: `npm run validate:schemas`
2. Run unit tests: `npm run test:unit`
3. Run integration tests: `npm run test:integration`
4. Run E2E tests: `npm run test:e2e`

### Phase 3: Documentation
1. Update any documentation referencing the legacy format
2. Add migration notes to the changelog

## Validation Checklist

### Current State (Before Migration)
- [x] 1 action (`adjust_clothing`) already migrated to `targets` format
- [x] 24 actions still using legacy `scope` format
- [x] All actions pass current schema validation (both formats are supported)
- [x] All existing rules work with current implementation

### Migration Tasks
- [ ] All 24 remaining action files migrated from `scope` to `targets`
- [ ] No action file contains both `scope` and `targets` properties
- [ ] All migrated actions pass schema validation
- [ ] All existing rules continue to work without modification
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] Documentation updated if needed

## Future Considerations

### Potential Multi-Target Enhancements

While this migration focuses on maintaining single-target compatibility, some actions could benefit from multi-target support in the future:

1. **Actions that could specify body parts**: e.g., `kiss_neck_sensually` could have a secondary target for specific neck areas
2. **Actions involving items**: Some intimate actions might involve props or items as secondary targets
3. **Group actions**: Future intimate actions involving multiple participants

These enhancements would require:
- Updating the action definitions to use the object format
- Modifying rules to handle multiple target IDs
- Updating UI to support multi-target selection

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tests fail due to schema changes | High | Run full test suite before committing |
| Rules reference wrong target | High | Verify event payload structure remains unchanged |
| UI breaks due to format change | Medium | Test action discovery and display |
| Performance impact | Low | New format is already optimized in the engine |

## Success Criteria

1. All 24 intimacy actions migrated to new format
2. Zero test failures after migration
3. Action discovery continues to work correctly
4. UI displays actions correctly
5. Rules execute without errors

## File Structure

The intimacy mod action files are located at:
```

data/mods/intimacy/actions/
├── accept_kiss_passively.action.json
├── adjust_clothing.action.json # Already migrated to targets format
├── break_kiss_gently.action.json
├── brush_hand.action.json
├── cup_face_while_kissing.action.json
├── explore_mouth_with_tongue.action.json
├── feel_arm_muscles.action.json
├── fondle_ass.action.json
├── kiss_back_passionately.action.json
├── kiss_cheek.action.json
├── kiss_neck_sensually.action.json
├── lean_in_for_deep_kiss.action.json
├── lick_lips.action.json
├── massage_back.action.json
├── massage_shoulders.action.json
├── nibble_earlobe_playfully.action.json
├── nibble_lower_lip.action.json
├── nuzzle_face_into_neck.action.json
├── peck_on_lips.action.json
├── place_hand_on_waist.action.json
├── pull_back_breathlessly.action.json
├── pull_back_in_revulsion.action.json
├── suck_on_neck_to_leave_hickey.action.json
├── suck_on_tongue.action.json
└── thumb_wipe_cheek.action.json

```

Associated scope definitions are located at:
```

data/mods/intimacy/scopes/

````

Scope files use the `.scope` extension (not `.scope.json`) and contain DSL expressions for target resolution.

## Appendix: Already Migrated

The `adjust_clothing` action has already been migrated and serves as a reference for multi-target format:

```json
{
  "targets": {
    "primary": {
      "scope": "intimacy:close_actors_facing_each_other_with_torso_clothing",
      "placeholder": "primary",
      "description": "Person whose clothing to adjust"
    },
    "secondary": {
      "scope": "clothing:target_topmost_torso_upper_clothing",
      "placeholder": "secondary",
      "description": "Specific garment to adjust",
      "contextFrom": "primary"
    }
  }
}
````

This action demonstrates:

- Multi-target support with primary and secondary targets
- Context dependency with `contextFrom`
- Custom placeholders for template substitution
