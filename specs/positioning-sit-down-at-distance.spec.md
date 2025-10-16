# Positioning "Sit Down At Distance" Action Specification

## Executive Summary

The positioning mod currently forces new sitters to occupy the leftmost available index on furniture that exposes the `positioning:allows_sitting` component. During recent playtesting with an LLM-controlled actor, this produced unnatural results when the actor explicitly requested to sit with a buffer seat between themselves and another occupant. This specification defines the requirements for a new multi-target action and handler rule that allow an actor to intentionally sit two seats away from an existing occupant, without disturbing the existing left-to-right allocation logic of the standard `positioning:sit_down` action.

## Goals

1. Introduce a new positioning action that lets actors sit on qualifying furniture while leaving a one-seat gap between themselves and a chosen occupant.
2. Provide a dedicated scope definition that can identify the correct "rightmost occupant with space" candidate on the targeted furniture.
3. Implement a bespoke rule that processes the new action, reserves the correct seat index, and preserves the current adjacency-based closeness behavior.
4. Deliver an integration test suite that covers action metadata validation, discoverability edge cases, rule execution, and regression coverage to ensure the legacy `sit_down` workflow remains unchanged.

## Non-Goals

- Modifying the existing `positioning:sit_down` action or `handle_sit_down` rule beyond ensuring they remain unaffected by the new feature.
- Altering `establishSittingClosenessHandler.js` or the underlying closeness heuristics (the expectation is that a two-index separation will naturally skip closeness establishment).
- Making UI or gameplay adjustments beyond what is required to expose the new action template `sit down on {primary} at a distance from {secondary}`.

## Implementation Plan

### 1. Action Definition (`data/mods/positioning/actions`)

- Create a new action file (suggested ID: `positioning:sit_down_at_distance`).
- Reuse the existing actor requirements/forbidden components from `positioning:sit_down` to prevent conflicts with other postures.
- Define `targets` as a multi-target object:
  - **Primary**: reference `positioning:available_furniture` to locate furniture with open seats in the actor's location.
  - **Secondary**: reference a new scope (see below) that resolves the appropriate occupant on the selected primary furniture. Ensure the scope runs with `contextFrom: "primary"` so that `target` inside the scope points to the chosen furniture, per the guidance in `docs/scopeDsl/README.md` and `docs/scopeDsl/quick-reference.md`.
- Set the `template` to `"sit down on {primary} at a distance from {secondary}"`.
- Author a concise description that explains the intent of leaving space.
- Confirm that the action schema remains valid by running `npm run scope:lint` and existing JSON schema tooling when implementing.

### 2. Secondary Scope (`data/mods/positioning/scopes`)

- Add a new scope file (proposed name: `actors_sitting_with_space_to_right.scope`).
- Scope semantics:
  - Start from `entities(core:actor)` (or `entities(positioning:sitting_on)` if permitted; confirm in ScopeDSL docs) to enumerate actors currently sitting.
  - Filter to actors whose `positioning:sitting_on.furniture_id` equals the `target.id` (the furniture selected as the primary target).
  - Use `let` bindings (documented in `docs/scopeDsl/README.md`) to capture the sitter's `spot_index` and the furniture's `positioning:allows_sitting.spots` array.
  - Require the occupant's index to be the highest occupied index on the furniture (`none` of the spots with a higher index are non-null). This preserves the "rightmost" constraint.
  - Require that the `spots` array contains at least two positions strictly to the right of the occupant (`>` comparison on length or direct checks).
  - Ensure both `spot_index + 1` and `spot_index + 2` are null so the new actor can leave a gap and still sit.
  - Return the filtered actor IDs so the action targeting UI can offer "distance sitting" only when the furniture satisfies all constraints.
- Add comments inside the scope to aid future maintenance and reference the JSON-logic operators used for dynamic index lookups.

### 3. Rule Definition (`data/mods/positioning/rules`)

- Introduce a new rule file (e.g., `handle_sit_down_at_distance.rule.json`).
- Trigger on `core:attempt_action` with a condition that matches the new action ID (mirror the pattern from `handle_sit_down.rule.json`).
- Implementation steps:
  1. Query the furniture's `positioning:allows_sitting` component and cache the `spots` array.
  2. Resolve the secondary target's current seat index either via its `positioning:sitting_on.spot_index` component or by scanning the `spots` array.
  3. Compute the intended seat index as `secondaryIndex + 2` and re-validate that both `secondaryIndex + 1` and `secondaryIndex + 2` are null (defensive check to avoid race conditions).
  4. Use `ATOMIC_MODIFY_COMPONENT` to claim `spots[secondaryIndex + 2]` for the actor. Abort gracefully if the claim fails.
  5. Add `positioning:sitting_on` to the actor with the computed index and call `LOCK_MOVEMENT` and `ESTABLISH_SITTING_CLOSENESS` exactly as in the base rule. Because the gap index remains empty, no adjacency-based closeness should form.
  6. Compose success logging that references both the furniture (`primary`) and the occupant (`secondary`) to make the reason for the action clear (e.g., "{actorName} sits down on {primaryName}, leaving a gap beside {secondaryName}.").
  7. End the rule with the standard `core:logSuccessAndEndTurn` macro.
- Evaluate whether any helper conditions (e.g., `positioning:event-is-action-sit-down`) should be duplicated or extended, or whether a new condition file is necessary for the new action. If the existing condition is action-specific, create a parallel entry such as `positioning:event-is-action-sit-down-at-distance`.

### 4. Documentation & Manifest Updates

- Update `data/mods/positioning/mod-manifest.json` if the new action or rule list requires explicit registration.
- Add a brief mention to `data/mods/positioning/README.md` describing the new action and its intended gameplay behavior.
- Ensure validation patterns remain satisfied (`data/mods/positioning/VALIDATION_PATTERNS.md`).

## Testing Strategy

Create a focused integration suite under `tests/integration/mods/positioning` (new files as needed) using `ModTestFixture` helpers. The suite should include, at minimum:

1. **Action Metadata Validation**
   - Verify the new action file fields (id, name, description, targets.primary/secondary scopes, template string) and confirm there are no forbidden component regressions.

2. **Positive Discoverability Case**
   - Setup: Furniture with three spots (`["secondaryActor", null, null]`), secondary actor already sitting at index 0, player actor standing.
   - Expectation: `resolveAvailableActions` includes the new action with a label that reflects both targets.
   - Confirm the existing `positioning:sit_down` action is also still available (so players can choose immediate adjacency when desired).

3. **Negative Discoverability Cases**
   - Furniture exposes only two spots (e.g., indexes `[0,1]`): new action should not appear.
   - Furniture has three spots but seat 1 already occupied: new action should not appear because there are not two consecutive empty seats to the right of the rightmost occupant.
   - Furniture has four spots with occupants at indexes 0 and 2: ensure the rightmost occupant with two open seats to the right is not present, so scope resolves to none.

4. **Rule Execution Success Path**
   - Drive `core:attempt_action` for the new action.
   - Assert that:
     - The actor gains `positioning:sitting_on` pointing to the furniture with `spot_index = secondaryIndex + 2`.
     - The intermediate gap index remains null.
     - Furniture's `allows_sitting.spots` reflects the expected occupancy.
     - No unexpected closeness components were created between the actor and the secondary occupant.
     - Log/perception metadata matches expectations.

5. **Rule Defensive Behavior**
   - Simulate a race where the target seat is claimed between scope resolution and rule execution (manually pre-fill `spots[secondaryIndex + 2]`). Ensure the rule handles the failed `ATOMIC_MODIFY_COMPONENT` gracefully (e.g., by aborting without adding `sitting_on` and without emitting misleading logs).

6. **Regression Coverage**
   - Re-run an existing `handle_sit_down` integration scenario to confirm it still seats actors leftmost and remains discoverable alongside the new action. This can either reuse existing fixtures or extend them with assertions about action coexistence.

7. **Scope Resolution Unit Test (Optional but Recommended)**
   - If feasible, add a targeted scope resolution test (similar to those under `tests/integration/mods/positioning/rules`) that directly asserts the new scope returns only the appropriate occupant given various seating arrangements. This provides guardrails for future scope DSL changes.

Run `npm run test:integration -- tests/integration/mods/positioning/<new-test-file>` (and any other affected suites) to confirm full pass once the implementation is complete. Because the user specifically requested a comprehensive suite, ensure coverage across the discovery, execution, and error handling scenarios described above.

## Open Questions & Follow-ups

- Confirm whether an additional localized string entry is required for the new action template or if the inline template is sufficient.
- Validate with narrative designers whether the success log should explicitly mention the preserved empty seat, and adjust copy accordingly.
- After implementation, monitor telemetry or playtest feedback to ensure the new action is being surfaced appropriately to LLM-driven actors.
