# Physical Control Mod: Forceful Bend-Over Action & Rule

## Summary
- Add a new multi-target physical control action that forces a nearby actor to bend over a compatible surface.
- Implement the matching rule that applies positioning state, updates facing information, and narrates the outcome.
- Expand the physical-control mod manifest and condition set so the new action and rule are discoverable in game.
- Build comprehensive integration tests that cover action discoverability constraints and rule side effects, following the latest mod testing guidance.

## Background & References
- `data/mods/positioning/actions/bend_over.action.json` is the voluntary single-target baseline that only checks for a surface target and applies the bending state to the actor.
- `data/mods/positioning/actions/place_yourself_behind.action.json` demonstrates how facing-away state is established and maintained when an actor positions themselves behind a target.
- `data/mods/physical-control/actions/push_onto_lying_furniture.action.json` shows the expected structure for a physical-control multi-target action, including `generateCombinations`, scope usage, combination templates, and narration handled by `handle_push_onto_lying_furniture.rule.json`.

## Action Requirements
- Create `data/mods/physical-control/actions/force_bend_over.action.json`.
  - Use `$schema` `schema://living-narrative-engine/action.schema.json` and assign an id in the `physical-control` namespace (e.g. `physical-control:force_bend_over`).
  - Enable `generateCombinations: true` so the UI offers all valid primary/secondary pairings.
  - Define multi-target scopes:
    - `primary` uses `scope": "positioning:close_actors_facing_each_other_or_behind_target"` (matches existing close-quarters control patterns).
    - `secondary` uses `scope": "positioning:available_surfaces"` so only bendable surfaces appear.
  - `required_components.actor` must contain exactly `["positioning:closeness"]`.
  - `forbidden_components.actor` must include `positioning:biting_neck`, `positioning:kneeling_before`, `positioning:straddling_waist`, `positioning:hugging`, `positioning:being_hugged`, `positioning:receiving_blowjob`, and `positioning:giving_blowjob`.
  - `forbidden_components.primary` must include `positioning:kneeling_before` and `positioning:sitting_on`.
  - Use the action template `"bend {primary} over {secondary}"` and align the visual styling with other physical-control actions.
  - No additional prerequisites are required beyond scope/component gating.

## Supporting Condition & Manifest Updates
- Add `data/mods/physical-control/conditions/event-is-action-force-bend-over.condition.json` that checks for the new action id. Mirror the format used by `event-is-action-push-onto-lying-furniture.condition.json`.
- Update `data/mods/physical-control/mod-manifest.json` to register the new action, rule, and condition entries.

## Rule Requirements
- Create `data/mods/physical-control/rules/handle_force_bend_over.rule.json` listening to `core:attempt_action` and using the new condition.
- Action sequence expectations:
  1. Gather the display names for actor, primary, and secondary to reuse in narration.
  2. Capture the actor's `core:position` so location-scoped events can be dispatched correctly.
  3. Apply `positioning:bending_over` to the primary target with `surface_id` referencing the secondary target entity. Reuse the component schema from `data/mods/positioning/components/bending_over.component.json`.
  4. Update or add the `positioning:facing_away` component on the primary target so they face away from the acting actor. Follow the push/behind rules to either append the actor id to an existing `facing_away_from` array or create it fresh with the actor id.
  5. Regenerate descriptions for both the primary target and the actor to keep activity summaries accurate after the state change.
  6. Set both the perceptible event message and the log success message to `{actor} forcefully bends {primary} over {secondary}` before invoking `core:logSuccessAndEndTurn`.
- If the rule needs to adjust closeness or other state (e.g., break closeness), only do so if required by validation; otherwise keep the interaction focused on bending over.

## Testing Strategy
- Introduce new integration suites under `tests/integration/mods/physical-control/`:
  - An action discoverability suite that asserts the new action appears only when:
    - The actor has `positioning:closeness` with the primary target.
    - Neither actor nor primary hold any forbidden components.
    - The surface carries the `positioning:allows_bending_over` component.
    - The primary target is not already bending over another surface.
  - A rule behavior suite that validates:
    - `positioning:bending_over` is applied to the primary target with the secondary surface id.
    - `positioning:facing_away` is created or updated with the actor id.
    - Entity descriptions regenerate (verify description timestamps or cached descriptions align with `REGENERATE_DESCRIPTION` expectations using helpers in existing positioning/physical-control tests).
    - The action and perceptible messages match the required string exactly.
- Follow the latest mod testing patterns described in `docs/testing/` (especially mod integration testing helpers) and mirror the setup/fixtures from `tests/integration/mods/physical-control/handle_push_onto_lying_furniture.test.js` or similar existing suites.
- Ensure new tests run as part of `npm run test:integration` and document any new helpers or fixtures needed.

## Out of Scope
- No changes to the voluntary `positioning:bend_over` action or its rule.
- No adjustments to movement locking or escape mechanics beyond what is explicitly required for the new forceful bend-over flow.
