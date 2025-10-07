# Ruffle Hair Playful Affection Action Specification

## Overview

Add a new gentle, playful interaction where the actor ruffles the target's hair. After reviewing existing content in the **caressing** and **affection** mods, this action fits best in the **affection** mod because:

- The affection manifest describes the category as *"Caring, supportive physical interactions that can be platonic or romantic"*, which matches a playful hair ruffle. 【F:data/mods/affection/mod-manifest.json†L1-L44】
- Existing affection actions focus on warm, comforting gestures (e.g., `brush_hand`, `hold_hand`) with straightforward closeness requirements, similar to ruffling hair. 【F:data/mods/affection/actions/brush_hand.action.json†L1-L20】
- Caressing actions lean more sensual/intimate (e.g., `run_fingers_through_hair`, `fondle_ass`), and their rule messages emphasize sensuality beyond the playful tone requested. 【F:data/mods/caressing/actions/run_fingers_through_hair.action.json†L1-L18】【F:data/mods/caressing/rules/handle_run_fingers_through_hair.rule.json†L1-L40】

Therefore, implement the new action and supporting files under `data/mods/affection/` while reusing its existing scope definitions (especially `affection:close_actors_facing_each_other_or_behind_target`). 【F:data/mods/affection/scopes/close_actors_facing_each_other_or_behind_target.scope†L1-L7】

## Action Requirements

Create `data/mods/affection/actions/ruffle_hair_playfully.action.json` following existing affection action patterns:

- `$schema`: `schema://living-narrative-engine/action.schema.json`
- `id`: `affection:ruffle_hair_playfully`
- `name`: `Ruffle hair playfully`
- `description`: concise, warm explanation (e.g., "Playfully tousle the target's hair to show affection.")
- `targets`: `affection:close_actors_facing_each_other_or_behind_target`
- `required_components.actor`: `["positioning:closeness"]` (same as other affection touch actions). 【F:data/mods/affection/actions/brush_hand.action.json†L7-L13】
- No forbidden components unless discovery testing shows a need.
- `template`: **exactly** `ruffle {target}'s hair playfully`
- `visual`: reuse affection color palette (background `#6a1b9a`, text `#f3e5f5`, hover `#8e24aa`/`#ffffff`) for consistency.

Add the action to the `actions` array inside `data/mods/affection/mod-manifest.json`.

## Condition Requirements

Create `data/mods/affection/conditions/event-is-action-ruffle-hair-playfully.condition.json` mirroring the naming and structure of other affection conditions, checking for the `affection:ruffle_hair_playfully` action ID. 【F:data/mods/affection/conditions/event-is-action-brush-hand.condition.json†L1-L11】

Include the new condition filename in the manifest's `conditions` array.

## Rule Requirements

Create `data/mods/affection/rules/handle_ruffle_hair_playfully.rule.json` using the standard affection rule pattern: 【F:data/mods/affection/rules/brush_hand.rule.json†L1-L33】

- `rule_id`: `handle_ruffle_hair_playfully`
- `comment`: Follow existing phrasing ("Handles the 'affection:ruffle_hair_playfully' action..." ).
- `event_type`: `core:attempt_action`
- `condition`: `{ "condition_ref": "affection:event-is-action-ruffle-hair-playfully" }`
- Actions sequence:
  1. `GET_NAME` actor → `actorName`
  2. `GET_NAME` target → `targetName`
  3. `QUERY_COMPONENT` actor `core:position` → `actorPosition`
  4. `SET_VARIABLE` `logMessage` to **exact** string: `{actor} ruffles {target}'s hair playfully.` implemented as `"{context.actorName} ruffles {context.targetName}'s hair playfully."`
  5. `SET_VARIABLE` `perceptionType`: `action_target_general`
  6. `SET_VARIABLE` `locationId`: `{context.actorPosition.locationId}`
  7. `SET_VARIABLE` `targetId`: `{event.payload.targetId}`
  8. `{ "macro": "core:logSuccessAndEndTurn" }`

Add the rule filename to the manifest's `rules` array.

## Testing Specification

Implement integration tests alongside existing affection tests to cover both discoverability and rule behavior.

### 1. Action Discoverability Test

Create `tests/integration/mods/affection/ruffle_hair_playfully_action_discovery.test.js` using `ModTestFixture.forAction('affection', 'affection:ruffle_hair_playfully')`. Test cases should:

- Validate the action JSON structure (id, template, targets, required components, visual palette) similar to `brush_hand_action.test.js`. 【F:tests/integration/mods/affection/brush_hand_action.test.js†L1-L47】
- Use `testFixture.createCloseActors()` to build scenarios.
- Call `testFixture.testEnv.getAvailableActions(actorId)` (provided by `createRuleTestEnvironment`) to assert that the new action appears when actors are close and correctly oriented, and is absent when requirements fail (e.g., remove `positioning:closeness`, or adjust facing to away using `ModEntityBuilder` helpers). 【F:tests/common/engine/systemLogicTestEnv.js†L760-L807】【F:tests/common/mods/ModEntityBuilder.js†L1-L220】
- Cover at least: face-to-face availability, actor behind target availability, lack of closeness blocking, facing-away blocking.

### 2. Rule Behavior Test

Create `tests/integration/mods/affection/ruffle_hair_playfully_action.test.js` (mirroring other affection action tests) that:

- Uses `ModTestFixture.forAction` with auto-loaded rule/condition.
- Executes the action via `executeAction` and asserts the success event message equals `{actor} ruffles {target}'s hair playfully.` and matches the perceptible event description. 【F:tests/integration/mods/caressing/run_fingers_through_hair_action.test.js†L34-L62】
- Confirms `core:perceptible_event` exists with `targetId` set to the target.
- Optionally uses `testFixture.assertOnlyExpectedEvents` to ensure no extraneous events.

Run `npm run test:integration` after implementation to ensure all integration tests pass.

## Manifest & Documentation Updates

- Update `data/mods/affection/mod-manifest.json` to list the new action, condition, and rule.
- If mod documentation exists elsewhere, note the new action and ensure schema validation passes.

## Acceptance Criteria

- New action and rule files reside in the affection mod and follow established schema patterns.
- Discoverability and rule integration tests provide real assertions (no placeholder `expect(true).toBe(true)` blocks) verifying availability and messaging behavior.
- Successful action and perceptible event messages exactly match `{actor} ruffles {target}'s hair playfully.`
- Test suite `npm run test:integration` passes.
