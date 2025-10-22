# Scoot Closer Right Action Specification

## Overview

This specification outlines the work required to introduce a rightward variant of the existing `positioning:scoot_closer` action. The new action enables an actor who is seated to the left of another occupant on the same piece of furniture to slide one spot to the right toward that occupant. Functionally, it mirrors `scoot_closer.action.json`, except it targets the closest **rightmost** occupant instead of the closest **leftmost** occupant.

## Current Implementation Reference Points

The following artifacts describe the current leftward scoot behavior and should be treated as implementation references:

- **Action definition**: `data/mods/positioning/actions/scoot_closer.action.json` (uses `positioning:closest_leftmost_occupant`).
- **Condition**: `data/mods/positioning/conditions/event-is-action-scoot-closer.condition.json`.
- **Rule**: `data/mods/positioning/rules/handle_scoot_closer.rule.json` (moves the actor one index to the left).
- **Supporting logic**: `src/logic/operators/isClosestLeftOccupantOperator.js` powers the `positioning:closest_leftmost_occupant` scope in `data/mods/positioning/scopes/closest_leftmost_occupant.scope`.
- **Integration tests**: `tests/integration/mods/positioning/scoot_closer_action_discovery.test.js`, `tests/integration/mods/positioning/scoot_closer_action.test.js`, and scenario coverage in `tests/integration/mods/positioning/scoot_closer_marla_scenario.test.js` validate discovery and execution for the leftward action.

## Requirements for the Rightward Variant

### 1. Action Definition

Create a new action JSON under `data/mods/positioning/actions/`, e.g. `scoot_closer_right.action.json`:

- Copy the structure of `scoot_closer.action.json`.
- Update the `id`, `name`, `description`, and template copy to communicate rightward movement.
- Set the `secondary` target `scope` to **`positioning:closest_rightmost_occupant`** (new scope described below). Keep `contextFrom`, required/forbidden components, prerequisites, and visual metadata identical to the original action so the UX is consistent.

Update `data/mods/positioning/mod-manifest.json` so the new action is registered next to the existing `scoot_closer` entry.

### 2. Scope & Operator Support

Introduce a new scope at `data/mods/positioning/scopes/closest_rightmost_occupant.scope` that mirrors `closest_leftmost_occupant.scope` but filters using a new JSON Logic operator such as `isClosestRightOccupant`. The scope should accept the furniture context from the action’s primary target.

Implement the supporting operator in `src/logic/operators/` by adapting `isClosestLeftOccupantOperator.js`:

- Flip the directional checks so that the candidate must be to the right of the acting actor.
- Ensure the operator confirms the immediate spot to the right is empty before allowing a move (parallel to the leftward validation in the existing operator).
- Reuse `BaseFurnitureOperator` utilities for component lookups and logging.
- Wire the operator into the mod JSON Logic registry if required by the existing initialization code path (follow patterns used when `isClosestLeftOccupant` was introduced).

### 3. Condition and Rule

Add a condition `data/mods/positioning/conditions/event-is-action-scoot-closer-right.condition.json` that checks for the new action ID.

Create a rule `data/mods/positioning/rules/handle_scoot_closer_right.rule.json` by adapting `handle_scoot_closer.rule.json`:

- Trigger on the same `core:attempt_action` event and guard with the new condition.
- Query the actor’s `positioning:sitting_on` component, calculate `newIndex` as `currentIndex + 1`, and check that the furniture spot to the right is empty before moving.
- Maintain the same component updates, closeness establishment, and logging, but adjust copy if needed to mention “scoots closer to the right”.
- Reference the secondary target (the rightmost occupant) the same way the leftward rule does so perceptions and closeness relationships remain accurate.

Register the new rule in `data/mods/positioning/mod-manifest.json` alongside the existing `handle_scoot_closer` rule entry.

### 4. Discoverability and Execution Wiring

Ensure that any action indexing or helper registries that expect explicit action IDs (for example, fixtures in `tests/common/mods` or diagnostic utilities) are updated to include the new rightward action so discoverability works in tooling and tests.

## Testing Requirements

Comprehensive automated coverage is required:

1. **Integration tests** – Mirror the existing leftward action suites under `tests/integration/mods/positioning/`:
   - Add discovery coverage that proves the action appears when an actor has an empty spot to the right and a rightmost neighbor, and disappears when the prerequisites fail (e.g., the actor is already the rightmost occupant or the spot to the right is occupied).
   - Add execution coverage validating that the rule moves the actor one spot to the right, updates components, and emits success logs.
   - Where relevant, add scenario-based tests similar to `scoot_closer_marla_scenario.test.js` to exercise edge cases (multiple empty spots, asymmetrical seating, etc.).

2. **Unit tests** – Create or extend tests for the new JSON Logic operator in `tests/unit/logic/operators/` to assert directional checks, empty-spot validation, and failure modes (mirroring `isClosestLeftOccupantOperator.test.js`).

3. **Discoverability tooling tests** – If `tests/common/mods` helpers or fixtures require explicit action IDs, add targeted unit tests (following patterns in `tests/unit/common/mods/actionValidationProxy.test.js`) to ensure validation continues to pass with the new action.

Follow the mod testing guidelines in `docs/testing/` (especially the integration testing methodology) when building these suites, and ensure all relevant Jest test groups pass locally (`npm run test:integration` at minimum) before submission.

## Acceptance Criteria

- New action, scope, condition, and rule files exist and are registered in the positioning mod manifest.
- The rightward operator correctly identifies the closest occupant to the right and only allows scooting when the adjacent seat is vacant.
- Integration and unit tests fully cover action discoverability and rule execution, providing parity with the existing leftward action coverage.
- Documentation or developer tooling that references available positioning actions includes the new rightward action where appropriate.
