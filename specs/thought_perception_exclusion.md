# Thought Perception Self-Exclusion

## Context

The `core:entity_thought` rule emits a `DISPATCH_PERCEPTIBLE_EVENT` with the text "{name} is lost in thought." so other actors can perceive that a character is thinking. Per the intent described in `docs/modding/sense-aware-perception.md`, perception logs should respect routing rules so that actors do not receive redundant third-person messages about their own internal actions, especially when a first-person or UI-specific thought entry already exists.

## Current Behavior

- `data/mods/core/rules/entity_thought.rule.json` dispatches a perceptible event with `contextual_data` containing only `{ thoughts: ... }`.
- `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js` normalizes `contextual_data.recipientIds` and `contextual_data.excludedActorIds` to empty arrays when not provided.
- `src/logic/operationHandlers/addPerceptionLogEntryHandler.js` uses `RecipientSetBuilder` to broadcast to all entities in the location when no recipients or exclusions are specified.

Result: the thinking actor receives the "is lost in thought" perception log entry despite also getting their own thought via `DISPATCH_THOUGHT`.

## Root Cause

The `entity_thought` rule does not supply `contextual_data.excludedActorIds`, so the broadcast includes the acting actor. The routing logic is functioning as designed; the rule is missing the exclusion needed for thoughts-only perceptible events.

## Proposed Change

Add an explicit self-exclusion for thought perceptible events in `data/mods/core/rules/entity_thought.rule.json`:

- Extend `contextual_data` for the `DISPATCH_PERCEPTIBLE_EVENT` action to include `excludedActorIds: ["{event.payload.entityId}"]` while preserving the existing `thoughts` field.
- This leverages the existing routing path:
  - `DispatchPerceptibleEventHandler` will normalize the exclusion.
  - `log_perceptible_events.rule.json` will pass it to `ADD_PERCEPTION_LOG_ENTRY`.
  - `RecipientSetBuilder` will remove the actor from the recipient set.

No changes are required in `dispatchPerceptibleEventHandler.js` or other handlers; the issue is in rule configuration.

## Tests

Add integration coverage that validates the new routing behavior.

### 1) New integration test for entity thoughts

File: `tests/integration/core/rules/entityThoughtRule.integration.test.js`

Structure: mirror `tests/integration/core/rules/entitySpeechRule.integration.test.js` but use the thought rule.

Test case: "excludes thinker from lost-in-thought perception log"

- Arrange:
  - Register `entity_thought.rule.json` and `log_perceptible_events.rule.json` in `createRuleTestEnvironment`.
  - Create a location entity and two perceivers in the same location:
    - `thinker` with `core:name`, `core:position`, `core:perception_log`.
    - `observer` with `core:name`, `core:position`, `core:perception_log`.
- Act:
  - Dispatch `ENTITY_THOUGHT_ID` with `entityId: thinker` and `thoughts: 'I should be careful.'`.
- Assert:
  - `observer` perception log contains a descriptionText of "{thinkerName} is lost in thought.".
  - `thinker` perception log does **not** contain the "is lost in thought" entry (empty log or no matching descriptionText).

This proves the exclusion is applied in end-to-end rule processing.

### 2) Optional regression guard (if needed)

If the above is considered too broad, add a targeted assertion that the dispatched perceptible event includes the exclusion:

- Inspect the `core:perceptible_event` payload captured by the test environment, and assert:
  - `contextualData.excludedActorIds` contains the thinker ID.

This keeps the test focused on routing without depending on log format.

## Acceptance Criteria

- Thinking actors no longer receive the "{name} is lost in thought" perception log entry.
- Other actors in the same location still receive the entry.
- No changes to sense-aware filtering or actor/target descriptions for other perceptible event types.
