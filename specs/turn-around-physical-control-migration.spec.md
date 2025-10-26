# Turn Around Action Migration to Physical-Control Mod

## Overview

The `positioning:turn_around` action currently lives in the positioning mod even though it represents one actor forcibly manipulating another actor's body orientation. This specification documents the plan to migrate the entire action bundle into the `physical-control` mod, aligning it with actions such as `physical-control:force_to_knees` that already manage forced repositioning.

## Current State Analysis

- **Action definition** (`data/mods/positioning/actions/turn_around.action.json`)
  - ID: `positioning:turn_around`
  - Targets the `positioning:close_actors_facing_each_other_or_behind_target` scope with closeness requirement and forbids `positioning:biting_neck`.
  - Requires `movement:actor-can-move` and `core:actor-mouth-available` prerequisites.
  - Uses the legacy positioning visual palette (burnt orange gradient).
- **Rule implementation** (`data/mods/positioning/rules/turn_around.rule.json`)
  - Handles `core:attempt_action` events for `positioning:turn_around`.
  - Adds/removes the `positioning:facing_away` component on the target and dispatches `positioning:actor_turned_around` events.
- **Condition** (`data/mods/positioning/conditions/event-is-action-turn-around.condition.json`)
  - JsonLogic equality check binding the rule to the action ID.
- **Event definition** (`data/mods/positioning/events/actor_turned_around.event.json`)
  - Exclusive payload schema for the rule's dispatched event; unused elsewhere.
- **Tests and utilities**
  - Integration/unit/E2E suites import the action JSON directly from the positioning mod (e.g., `tests/integration/mods/positioning/turn_around_action.test.js`, `tests/e2e/mods/positioning/facingAwareActions.e2e.test.js`).
  - Movement validation tests reference the action path for cross-mod dependency checks.
  - Documentation and helper scripts still describe the action under the positioning namespace.

The `physical-control:force_to_knees` action demonstrates the target mod's conventions: matching Ironclad Slate color palette, `physical-control` namespace IDs, manifest registration, and dedicated integration tests in `tests/integration/mods/physical-control/`.

## Migration Goals

1. **Relocate and rename the action bundle**
   - Move the action JSON to `data/mods/physical-control/actions/turn_around.action.json` and rename its ID to `physical-control:turn_around`.
   - Update visuals to the Ironclad Slate palette to match existing physical-control actions.
   - Ensure prerequisites/requirements remain intact and continue referencing movement/core conditions.
2. **Move supporting logic**
   - Relocate the rule and condition files into the physical-control mod, renaming them to `handle_turn_around.rule.json` and `event-is-action-turn-around.condition.json` with IDs/comments updated to the new namespace.
   - Migrate the exclusive `actor_turned_around` event into `data/mods/physical-control/events/` and rename it to `physical-control:actor_turned_around` unless downstream consumers require the positioning namespace (current analysis shows no other consumers).
3. **Update mod manifests and dependencies**
   - Remove the action/rule/condition/event entries from `data/mods/positioning/mod-manifest.json` and add the new filenames under the appropriate `content` sections in `data/mods/physical-control/mod-manifest.json`.
   - Expand the physical-control manifest's `dependencies` to include `core` and `movement`, since the migrated action references `core:actor-mouth-available` and `movement:actor-can-move`.
4. **Clean up positioning mod references**
   - Delete the obsolete files from the positioning mod directory tree.
   - Update `data/mods/positioning/README.md` and any other docs/specs referencing `positioning:turn_around` to reflect the new home or remove the entry.
   - Remove the action from `VALIDATION_PATTERNS.md` and any helper scripts like `scripts/validate-turn-around-migration.js` that hard-code its path (decide whether to retire or repoint the script).
5. **Refresh documentation & specs**
   - Update existing specs and reports (e.g., `specs/positioning-facing-away-kneel-fix.spec.md`, migration reports) to use the new namespace.
   - Document the new action location within any cross-mod interaction guides.

## Test and Tooling Updates

- **Integration/unit tests**
  - Move or duplicate the positioning-specific integration tests into `tests/integration/mods/physical-control/` (e.g., `turn_around_action.test.js`, `turn_around_action_discovery.test.js`) with imports pointing at the new paths and IDs.
  - Update rule integration suites to sit under the physical-control namespace and ensure emitted events use the migrated ID.
  - Adjust unit tests such as `tests/unit/mods/positioning/actions/turnAroundAction.test.js` to either follow the new path (relocated under a physical-control directory) or create new test modules for the physical-control action set.
- **System/E2E tests**
  - `tests/e2e/mods/positioning/facingAwareActions.e2e.test.js` and similar suites must dispatch `physical-control:turn_around` and import the action from the physical-control directory.
  - Cross-mod validation tests under `tests/integration/validation/` need their fixture expectations updated from `positioning:turn_around` to `physical-control:turn_around` and the new file paths.
- **Shared utilities and mocks**
  - Adjust helper fixtures (`tests/integration/common/actionMatchers.integration.test.js`, `tests/unit/common/actionMatchers.test.js`, etc.) to reference the new namespace and ensure any hard-coded error messages or enumerations reflect the change.

## Acceptance Criteria

- No files under `data/mods/positioning/` reference the `turn_around` action, rule, condition, or event after the migration.
- `data/mods/physical-control/` contains the full action bundle (action, rule, condition, event) registered in its manifest with correct dependencies.
- All references throughout the codebase (actions, tests, docs, scripts, specs) use `physical-control:turn_around` and the new file paths.
- Test suites covering action discovery, execution, rule behavior, and cross-mod validation pass with the updated namespace.
- Ironclad Slate visual palette is applied to the migrated action to maintain mod-level consistency.
