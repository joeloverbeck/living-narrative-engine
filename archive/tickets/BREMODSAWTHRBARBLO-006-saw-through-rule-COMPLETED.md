# BREMODSAWTHRBARBLO-006: Add saw through barred blocker rule

Goal: implement rule handling for the saw-through barred blocker action outcomes, including progress tracking, tool drop on fumble, and perceptible events. Do not expand beyond this rule.

# Corrected assumptions (as of current repo)
- The breaching mod already defines the action, scope, and condition needed for saw-through discovery.
- The action schema in `data/mods/breaching/actions/saw_through_barred_blocker.action.json` uses `targets.scope`/`placeholder` and a `chanceBased.enabled` structure, not the spec's `scopeRef`/`key` and `chanceBased.outcomes` format.
- The condition uses `logic` instead of `expression` in `data/mods/breaching/conditions/event-is-action-saw-through-barred-blocker.condition.json`.
- There is no `data/mods/breaching/rules/` directory yet; this ticket will add it.
- The rules system uses `RESOLVE_OUTCOME`, `ADD_COMPONENT`, and `MODIFY_COMPONENT` (no `RESOLVE_CHANCE_BASED_ACTION`, no `upsert`/`incrementValue` fields).
- Perceptible events use `alternate_descriptions.auditory` (not `hearing_only`).
- Registering a new rule requires listing it in `data/mods/breaching/mod-manifest.json`, and the rule's use of `skills:craft_skill` requires adding the `skills` dependency.

# Scope
- Add `data/mods/breaching/rules/handle_saw_through_barred_blocker.rule.json` and register it in the breaching manifest.
- Update `data/mods/breaching/mod-manifest.json` dependencies to include `skills`.
- Add/extend integration tests to validate the rule structure and outcome handling.
- No changes to actions, scopes, conditions, components, manifests, or docs.

# File list it expects to touch
- data/mods/breaching/rules/handle_saw_through_barred_blocker.rule.json
- tests/integration/mods/breaching/saw_through_barred_blocker_rule_execution.test.js
- data/mods/breaching/mod-manifest.json

# Acceptance criteria
## Specific tests that must pass
- npm run test:integration -- tests/integration/mods/breaching/saw_through_barred_blocker_rule_execution.test.js
- npm run validate:fast

## Invariants that must remain true
- Progress increments use `core:progress_tracker` with `ADD_COMPONENT` then `MODIFY_COMPONENT` increment when present.
- FUMBLE outcome unwields and drops the tool at the actor's location.
- Perceptible events include sight-focused descriptions plus `alternate_descriptions.auditory`.

# Status
- Completed

# Outcome
Implemented the saw-through barred blocker rule using existing `RESOLVE_OUTCOME` and component operations, registered the rule in the breaching manifest, and added a focused integration test validating outcome branches. Updated manifest dependencies to include `skills` to satisfy validation.
