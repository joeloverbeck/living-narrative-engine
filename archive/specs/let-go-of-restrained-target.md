# Let Go of Restrained Target (physical-control)

## Background and references

- Existing capture flow: `data/mods/physical-control/actions/restrain_target.action.json` and `rules/handle_restrain_target.rule.json` add `positioning:restraining` to the actor, `positioning:being_restrained` to the target, and lock both grabbing appendages. Outcome text comes from the rule branches; action discovery is covered in `tests/integration/mods/physical-control/restrain_target_action_discovery.test.js`, wiring in `restrain_target_rule_validation.test.js`, and outcome branching in `restrainTargetOutcomeResolution.test.js` plus pruning logic in `restrain_target_pruning.integration.test.js`.
- Positioning components: `data/mods/positioning/components/restraining.component.json` stores `restrained_entity_id` and `initiated`; `being_restrained.component.json` stores `restraining_entity_id`. These IDs are the canonical link and should drive target resolution for release rather than proximity scopes.
- Scope patterns: `data/mods/positioning/scopes/actors_im_facing_away_from.scope` filters a subset of close actors, while `.../actor_im_straddling.scope` resolves a single entity ID straight from component data. The new action should mirror the latter—direct component-based resolution from the actor’s restraining component.
- Mod test style: physical-control integration tests live under `tests/integration/mods/physical-control/` and rely on `ModActionTestFixture`, `ModEntityBuilder`, and scope overrides when necessary. Reuse these patterns for the new deterministic release.

## Goals

- Add a deterministic (non-chance) physical-control action/rule pair that lets an actor deliberately release the entity they are restraining.
- Action template: `let go of {target}` (no `% chance` text). The action succeeds deterministically and should not run an outcome contest.
- Actor requirement: must have `positioning:restraining` (no forbidden components). The target resolves to the `restrained_entity_id` stored on that component.
- Rule effect: remove `positioning:restraining` from the actor and `positioning:being_restrained` from the target, then `REGENERATE_DESCRIPTION` for both. Perceptible event and success log message must be `{actor} lets go of {target}, leaving them unrestrained.`
- Clean up grabbing locks the restrain rule created: include `UNLOCK_GRABBING` for the acting actor (count 2, `item_id` = target) so hands become free once the restraint is released.
- Add comprehensive action discoverability tests and rule behavior tests, following the restrain_target suites and other physical-control integration patterns.

## Action: `physical-control:let_go_of_restrained_target`

- File: `data/mods/physical-control/actions/let_go_of_restrained_target.action.json`; add to `mod-manifest.json` content list.
- Metadata: `name` “Let Go of Restrained Target”; `description` explains deliberately releasing a restrained actor; `template` exactly `let go of {target}`; `generateCombinations`: false.
- `required_components.actor`: `["positioning:restraining"]`; no forbidden components. No prerequisites or chance-based section (omit `chanceBased` entirely or set `enabled: false`).
- Targets: single `primary` target whose `scope` is the entity referenced by `actor.components.positioning:restraining.restrained_entity_id`; placeholder `target`, description notes the restrained actor being released.
- Visual: reuse the restrained action palette (`backgroundColor` `#2f2f2f`, etc.) for consistency.

## Scope: resolve restrained target from actor

- File: `data/mods/physical-control/scopes/restrained_entity_i_am_holding.scope` (or similar concise name); add to manifest.
- Logic: return a Set containing `actor.components.positioning:restraining.restrained_entity_id` when present; otherwise return an empty Set. Mirror the direct-component style of `actor_im_straddling.scope` rather than location scans. Optionally drop the entity if it no longer exists or if its `being_restrained.restraining_entity_id` does not point back to the actor to avoid stale links.

## Condition

- File: `data/mods/physical-control/conditions/event-is-action-let-go-of-restrained-target.condition.json`; add to manifest.
- Logic: `event.payload.actionId === "physical-control:let_go_of_restrained_target"` (flat equality as in the restrain condition).

## Rule: `rules/handle_let_go_of_restrained_target.rule.json`

- Event: `core:attempt_action` gated by the new condition.
- Setup actions: `GET_NAME` for actor/target; `QUERY_COMPONENT` for actor position (to get `locationId`); set shared variables `locationId`, `perceptionType` = `action_target_general`, `targetId` = `{event.payload.targetId}`. No `RESOLVE_OUTCOME` because the action is deterministic.
- Single success branch (no IF on outcome):
  - `REMOVE_COMPONENT` `positioning:restraining` from `actor`.
  - `REMOVE_COMPONENT` `positioning:being_restrained` from `target`.
  - `UNLOCK_GRABBING` with `actor_id` = `{event.payload.actorId}`, `count` = 2, `item_id` = `{event.payload.targetId}` to mirror the two-hand lock created by restraining.
  - `REGENERATE_DESCRIPTION` for `actor` and `target`.
  - `DISPATCH_PERCEPTIBLE_EVENT` and `SET_VARIABLE logMessage` with `{actor} lets go of {target}, leaving them unrestrained.`
  - End turn with `core:logSuccessOutcomeAndEndTurn`.
- Robustness: tolerate missing components (no-op removals) so releasing after an external cleanup does not fail.

## Tests (under `tests/integration/mods/physical-control/`)

- **Action discovery (`let_go_of_restrained_target_action_discovery.test.js`):**
  - Action available when actor has `positioning:restraining` pointing to an existing target in the same room.
  - Not available if the actor lacks `positioning:restraining`, if the component points to a non-existent entity, or if the target is missing `positioning:being_restrained` pointing back (mirror scope guard). No chance-based fields should appear.
  - Verify target pruning keeps the action available if multiple actors are present but only the restrained target matches the scope (use patterns from `restrain_target_pruning.integration.test.js`).
- **Rule wiring (`let_go_of_restrained_target_rule_validation.test.js`):**
  - Assert rule/condition IDs, event type, manifest entries, variable setup, and absence of `RESOLVE_OUTCOME`/chance config.
  - Ensure the perceptible/log message matches `{actor} lets go of {target}, leaving them unrestrained.`
- **Outcome behavior (`letGoOfRestrainedTargetOutcome.test.js`):**
  - Execute the then-actions list: components removed from actor/target, grabbing unlocked with `count: 2` and `item_id` target, descriptions regenerated.
  - Confirm no additional branches and that the success macro is present.
  - Edge case: when components are already missing, the rule still dispatches the message and completes successfully.

## Implementation checklist

- Add new files (action, rule, condition, scope) and register them in `data/mods/physical-control/mod-manifest.json`.
- Keep schema IDs aligned with positioning components; keep all IDs/prefixes `physical-control:*`.
- Follow ESLint/Prettier defaults and existing integration test harness conventions (use `ModActionTestFixture`, `ModEntityBuilder`, etc.).
- Document any UNLOCK_GRABBING parameters with existing schema rules; mirror the template usage from `handle_restrain_target` and weapons grabbing tests.
