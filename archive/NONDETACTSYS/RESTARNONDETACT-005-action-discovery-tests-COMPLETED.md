# RESTARNONDETACT-005: Restrain Action Discovery Tests

## Status

Completed.

## Description

`physical-control:restrain_target` already exists with required grappling skill + two-free-grabbing-appendages prerequisite, and discovery coverage currently only checks that already-restrained targets are excluded (`tests/integration/mods/physical-control/restrain_target_action_discovery.test.js`). Rule wiring/outcomes are already validated by `restrain_target_rule_validation.test.js`. This ticket now focuses on adding missing discovery scenarios for actor prerequisites (skills + appendages) while keeping the existing forbidden-component check.

Reference: `specs/restrain-target-non-deterministic-action.md`.

## Current Findings

- The action JSON includes `required_components.actor: skills:grappling_skill` and a prerequisite using `anatomy:actor-has-two-free-grabbing-appendages`.
- The existing discovery test file validates forbidden targets but does not cover actor requirements; the expected new file name in the original ticket is incorrect (file already exists as `restrain_target_action_discovery.test.js`).
- Rule/outcome coverage already exists; no runtime or content changes are needed for this ticket.

## Scope (Updated)

- Extend `tests/integration/mods/physical-control/restrain_target_action_discovery.test.js` with discovery cases that: (a) include the action when the actor has grappling skill and two free grabbing appendages in the same location as a free target; (b) exclude the action when the grappling skill is missing; (c) exclude the action when fewer than two free grabbing appendages remain (e.g., locked hands).
- Preserve the existing forbidden-target coverage in the same file.

## Out of Scope

- Changes to mod JSON (action/rule/condition/component) or runtime logic; this ticket is test-only.
- New helper modules; reuse existing mod test fixtures and builders.

## Acceptance Criteria

- Discovery tests assert availability when prerequisites are satisfied and absence when grappling skill is missing or grabbing appendages are not free.
- Uses existing fixtures/helpers consistent with other physical-control discovery tests; no new helpers introduced.
- Commands: `npm run test:integration -- tests/integration/mods/physical-control/restrain_target_action_discovery.test.js` (targeted) passes; lint scoped to touched files as needed.

### Invariants

- Swing-at-target and other physical-control discovery tests remain unchanged and passing.
- No new files beyond updates to the existing discovery test.

## Outcome

- Extended `tests/integration/mods/physical-control/restrain_target_action_discovery.test.js` with positive and negative discovery scenarios for grappling skill presence and two free grabbing appendages while keeping the forbidden-target coverage.
- No runtime or data changes required.
- Commands run: `npm run test:integration -- --runInBand tests/integration/mods/physical-control/restrain_target_action_discovery.test.js` (passes; global coverage thresholds reported as unmet due to single-suite run). Coverage warnings acknowledged per project guidance for targeted runs.
