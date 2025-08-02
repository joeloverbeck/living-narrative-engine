# Positioning Mod Migration Report

## Executive Summary

This report analyzes the migration of positioning-related files from the `intimacy` mod to the `positioning` mod. The migration includes actions, rules, components, conditions, and scopes that deal with physical positioning rather than intimate interactions.

## Files to Be Moved

### Core Files Identified for Migration

#### Actions

1. **`data/mods/intimacy/actions/get_close.action.json`**
   - ID: `intimacy:get_close`
   - Description: Move closer to the target, entering their personal space
   - Dependencies: Only requires `core:actor-can-move` condition

2. **`data/mods/intimacy/actions/step_back.action.json`**
   - ID: `intimacy:step_back`
   - Description: Step back from current intimate partner, ending the closeness
   - Dependencies: Requires `intimacy:closeness` component

#### Rules

1. **`data/mods/intimacy/rules/get_close.rule.json`**
   - Handles the `intimacy:get_close` action
   - Implements closeness circle merging algorithm

2. **`data/mods/intimacy/rules/step_back.rule.json`**
   - Handles the `intimacy:step_back` action
   - Implements closeness circle removal algorithm

#### Components

1. **`data/mods/intimacy/components/closeness.component.json`**
   - ID: `intimacy:closeness`
   - Description: Tracks actors in a closeness circle
   - Pure positioning data structure

### Additional Positioning-Related Files Identified

#### Components

1. **`data/mods/intimacy/components/facing_away.component.json`**
   - ID: `intimacy:facing_away`
   - Description: Tracks which actors this entity is facing away from
   - Pure positioning/orientation data

#### Actions (Turn-Related)

1. **`data/mods/intimacy/actions/turn_around.action.json`**
   - ID: `intimacy:turn_around`
   - Description: Turn the target around or have them face you again
   - Manipulates `facing_away` component

2. **`data/mods/intimacy/actions/turn_around_to_face.action.json`**
   - ID: `intimacy:turn_around_to_face`
   - Description: Turn around to face someone you are currently facing away from
   - Requires both `closeness` and `facing_away` components

#### Rules (Turn-Related)

1. **`data/mods/intimacy/rules/turn_around.rule.json`**
   - Handles the `intimacy:turn_around` action
   - Manipulates `facing_away` component

2. **`data/mods/intimacy/rules/turn_around_to_face.rule.json`**
   - Handles the `intimacy:turn_around_to_face` action
   - Removes actor from `facing_away` component

#### Conditions

1. **`data/mods/intimacy/conditions/event-is-action-get-close.condition.json`**
   - Checks if event is for `intimacy:get_close` action

2. **`data/mods/intimacy/conditions/event-is-action-step-back.condition.json`**
   - Checks if event is for `intimacy:step_back` action

3. **`data/mods/intimacy/conditions/actor-is-in-closeness.condition.json`**
   - Checks if actor has the `closeness` component

4. **`data/mods/intimacy/conditions/event-is-action-turn-around.condition.json`**
   - Checks if event is for `intimacy:turn_around` action

5. **`data/mods/intimacy/conditions/event-is-action-turn-around-to-face.condition.json`**
   - Checks if event is for `intimacy:turn_around_to_face` action

6. **`data/mods/intimacy/conditions/entity-in-facing-away.condition.json`**
   - Checks if entity is in actor's `facing_away` list

7. **`data/mods/intimacy/conditions/entity-not-in-facing-away.condition.json`**
   - Checks if entity is NOT in actor's `facing_away` list

8. **`data/mods/intimacy/conditions/actor-in-entity-facing-away.condition.json`**
   - Checks if actor is in entity's `facing_away` list

9. **`data/mods/intimacy/conditions/actor-is-behind-entity.condition.json`**
   - Checks if actor is behind entity (in their `facing_away` list)

10. **`data/mods/intimacy/conditions/both-actors-facing-each-other.condition.json`**
    - Checks if both actors are facing each other (neither in other's `facing_away`)

#### Events

1. **`data/mods/intimacy/events/actor_turned_around.event.json`**
   - Event fired when an actor turns around

2. **`data/mods/intimacy/events/actor_faced_forward.event.json`**
   - Event fired when an actor faces forward

3. **`data/mods/intimacy/events/actor_faced_everyone.event.json`**
   - Event fired when an actor faces everyone

#### Scopes

1. **`data/mods/intimacy/scopes/close_actors.scope`**
   - Returns actors in closeness circle
   - Definition: `actor.components.intimacy:closeness.partners[]`

2. **`data/mods/intimacy/scopes/actors_im_facing_away_from.scope`**
   - Returns actors the entity is facing away from
   - Uses `facing_away` component

## Files That Reference Components to Be Moved

### Code References

#### Test Files

1. **Integration Tests**
   - `tests/integration/rules/closenessActionAvailability.integration.test.js` - Tests get_close action
   - `tests/integration/rules/stepBackRule.integration.test.js` - Tests step_back action and rule
   - `tests/integration/rules/getCloseRule.integration.test.js` - Tests get_close rule
   - `tests/integration/rules/turnAroundRule.integration.test.js` - Tests turn_around rule
   - `tests/integration/rules/turnAroundToFaceRule.integration.test.js` - Tests turn_around_to_face rule

2. **Unit Tests**
   - `tests/unit/schemas/closeness.schema.test.js` - Tests closeness component schema
   - `tests/unit/mods/intimacy/components/facingAwayComponent.test.js` - Tests facing_away component

3. **E2E Tests**
   - `tests/e2e/actions/CrossModActionIntegration.e2e.test.js` - Tests cross-mod action integration

#### Source Code

1. **Operation Handlers**
   - `src/logic/operationHandlers/removeFromClosenessCircleHandler.js` - Handles closeness circle removal
   - `src/logic/operationHandlers/mergeClosenessCircleHandler.js` - Handles closeness circle merging

2. **Services**
   - `src/logic/services/closenessCircleService.js` - Service for closeness circle operations

### Actions That Depend on Closeness Component

These actions require the `intimacy:closeness` component and will need their dependencies updated:

1. `lick_lips.action.json`
2. `lean_in_for_deep_kiss.action.json`
3. `thumb_wipe_cheek.action.json`
4. `adjust_clothing.action.json`
5. `massage_back.action.json`
6. `place_hand_on_waist.action.json`
7. `feel_arm_muscles.action.json`
8. `kiss_cheek.action.json`
9. `suck_on_neck_to_leave_hickey.action.json`
10. `massage_shoulders.action.json`
11. `brush_hand.action.json`
12. `fondle_ass.action.json`
13. `nibble_earlobe_playfully.action.json`
14. `nuzzle_face_into_neck.action.json`
15. `kiss_neck_sensually.action.json`
16. `peck_on_lips.action.json`
17. `turn_around.action.json`

### Actions That Depend on Facing Away Component

These actions require or manipulate the `intimacy:facing_away` component:

1. `massage_back.action.json` - Forbidden when facing away
2. `place_hand_on_waist.action.json` - Forbidden when facing away
3. `turn_around_to_face.action.json` - Requires facing away

### Scopes That Reference Closeness Component

The following scopes use the `intimacy:closeness` component in their definitions:

1. `close_actors_facing_away.scope`
2. `close_actors_facing_each_other.scope`
3. `actors_with_arms_facing_each_other_or_behind_target.scope`
4. `actors_with_arms_in_intimacy.scope`
5. `close_actors_facing_each_other_with_torso_clothing.scope`
6. `actors_with_arms_facing_each_other.scope`
7. `actors_with_ass_cheeks_in_intimacy.scope`
8. `actors_with_muscular_arms_facing_each_other_or_behind_target.scope`
9. `close_actors_facing_each_other_or_behind_target.scope`
10. `actors_with_ass_cheeks_facing_each_other_or_behind_target.scope`
11. `actors_with_ass_cheeks_facing_each_other.scope`
12. `actors_with_mouth_facing_each_other.scope`

## Required Updates After Migration

### 1. Namespace Updates

All references to moved components must be updated from `intimacy:` to `positioning:`:

- `intimacy:get_close` → `positioning:get_close`
- `intimacy:step_back` → `positioning:step_back`
- `intimacy:closeness` → `positioning:closeness`
- `intimacy:facing_away` → `positioning:facing_away`
- `intimacy:turn_around` → `positioning:turn_around`
- `intimacy:turn_around_to_face` → `positioning:turn_around_to_face`

### 2. Mod Manifest Updates

#### Intimacy Mod (`data/mods/intimacy/mod-manifest.json`)

- Remove moved files from content sections
- Add dependency on `positioning` mod:
  ```json
  {
    "id": "positioning",
    "version": "^1.0.0"
  }
  ```

#### Positioning Mod (`data/mods/positioning/mod-manifest.json`)

- Add all moved files to appropriate content sections
- Update description to reflect expanded scope

### 3. Test Updates

All test files that import or reference the moved files need updates:

- Update import paths
- Update component/action IDs in test data
- Update schema validation tests

### 4. Documentation Updates

- Update any documentation referencing these components
- Update architecture reports that mention the intimacy mod structure

## Migration Order

To ensure a smooth migration, follow this order:

1. **Phase 1: Core Positioning Components**
   - Move `closeness.component.json`
   - Move `facing_away.component.json`
   - Update positioning mod manifest

2. **Phase 2: Basic Actions and Rules**
   - Move `get_close` action and rule
   - Move `step_back` action and rule
   - Move turn-related actions and rules

3. **Phase 3: Conditions and Events**
   - Move all positioning-related conditions
   - Move positioning-related events

4. **Phase 4: Scopes**
   - Move `close_actors.scope`
   - Move `actors_im_facing_away_from.scope`

5. **Phase 5: Update References**
   - Update all namespace references
   - Update test imports and references
   - Update intimacy mod manifest
   - Run all tests to verify

## Impact Analysis

### Positive Impacts

1. **Better Separation of Concerns**: Physical positioning logic separated from intimate interactions
2. **Reusability**: Violence mod and other mods can use positioning without intimacy dependencies
3. **Cleaner Architecture**: More logical grouping of related functionality

### Risks and Mitigations

1. **Breaking Changes**: All mods depending on these components will break
   - Mitigation: Comprehensive testing and gradual migration
2. **Test Coverage**: Many tests will need updates
   - Mitigation: Update tests in parallel with code changes
3. **Runtime Errors**: Missing dependency errors possible
   - Mitigation: Add proper dependency declarations in mod manifests

## Conclusion

This migration will move 31 files from the intimacy mod to the positioning mod, creating a cleaner separation between physical positioning mechanics and intimate interactions. The positioning mod will become a foundational mod that other mods (including intimacy and violence) can depend on for spatial relationship management.

The migration is technically feasible but requires careful coordination to update all references across the codebase. Following the phased approach outlined above will minimize disruption and ensure a successful migration.
