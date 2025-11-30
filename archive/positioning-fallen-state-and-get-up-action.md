# Positioning Mod – Fallen Marker & Push-To-Feet Action

## Context
Characters can lie down or kneel, but we lack a state for being toppled over or sprawled after accidents, grief, or violence. The existing recovery actions (`get_up_from_furniture`, `get_up_from_lying`, `stand_up`) do not address this situation, so we need a marker plus a self-targeted action to return to standing.

## Goals
- Add a state-like marker component for actors who have fallen in a messy way.
- Provide a player-facing action/rule combo to let an actor recover: template "push yourself to your feet" with messaging `{actor} pushes themselves back to their feet.`
- Gate the action on the fallen marker and clear that marker on success.
- Document integration tests to cover action discoverability and rule behavior using `tests/integration/mods/` patterns (see `docs/testing/`).

## Component
- **Path:** `data/mods/positioning/components/fallen.component.json`
- **Type:** Marker component (no fields). Represents an actor who has fallen in a messy way (accident, grief, violence). Use it as a state flag rather than storing pose details.
- **Manifest:** Add to `content.components` in `data/mods/positioning/mod-manifest.json`.

## Action: Push Yourself to Your Feet
- **File:** `data/mods/positioning/actions/push_yourself_to_your_feet.action.json` (name/id `positioning:push_yourself_to_your_feet`).
- **Template:** `push yourself to your feet` (no targets; single-actor action like `stand_up`).
- **Required components (actor):** `positioning:fallen` (and any baseline like `core:position` if needed for location lookups consistent with other positioning actions).
- **Forbidden components:** Mirror patterns from other stand/lie recovery actions if any blockers apply (e.g., ongoing sex states) or leave empty if none apply.
- **Description:** Clarify that it is used when the actor has been knocked down or collapsed messily.
- **Manifest:** Add to `content.actions` and add a matching condition entry `event-is-action-push-yourself-to-your-feet.condition.json` under `content.conditions`.

## Rule: Handle Push-To-Feet
- **File:** `data/mods/positioning/rules/handle_push_yourself_to_your_feet.rule.json` (rule id `handle_push_yourself_to_your_feet`).
- **Event:** `core:attempt_action` filtered by new `positioning:event-is-action-push-yourself-to-your-feet` condition.
- **Guard:** Actor must still have `positioning:fallen`; fail early with a clear message if not.
- **Actions:**
  - Remove `positioning:fallen` from the actor.
  - Regenerate description and unlock movement, matching patterns in `stand_up.rule.json` / `handle_get_up_from_lying.rule.json` for consistency.
  - Dispatch perceptible and success messages `{actor} pushes themselves back to their feet.` (same string for both perceptible event and success log; set `locationId` to actor location and `targetId` null like other self-actions).
  - End turn via standard macro (`core:logSuccessAndEndTurn` or equivalent).
- **Manifest:** Add the new rule and condition to `content.rules`/`content.conditions` respectively.

## Testing (Integration)
- Create an integration suite under `tests/integration/mods/positioning/` covering:
  - **Action discoverability:** Actor with `positioning:fallen` sees `push yourself to your feet`; actor without the component does not. Mirror how `stand_up`/`get_up_from_lying` are asserted for availability.
  - **Rule effects:** Running the action removes `positioning:fallen`, emits the perceptible event with the exact string, ends the turn successfully, and does not regress movement unlocking. Validate via world updates similar to other positioning recovery tests.
- Follow fixtures and harness guidance from `docs/testing/` and existing positioning mod integration tests for setup utilities and expectations.

# Outcome
- Implemented `positioning:fallen` component.
- Implemented `positioning:push_yourself_to_your_feet` action, condition, and rule.
- Added integration tests in `tests/integration/mods/positioning/push_yourself_to_your_feet_action.test.js`.
- Verified all tests pass.
- Ensured "Guard" logic uses `QUERY_COMPONENT` and `IF` construct as `CHECK_COMPONENT` is not supported.
- Validated `positioning:fallen` component against `component.schema.json`.
