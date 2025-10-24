# Caress Cheek Softly Action Specification

## Overview

Introduce a new caressing interaction where the actor gently caresses the target's cheek with a soft, tender touch. Existing caressing actions consistently require actors to be in closeness, reuse the purple visual palette, and tailor scope filters to the gesture being performed, so the new work should extend those conventions while creating an intimate yet simple face-to-face interaction.【F:data/mods/caressing/actions/thumb_wipe_cheek.action.json†L2-L21】【F:data/mods/caressing/actions/cup_chin.action.json†L2-L18】【F:data/mods/caressing/actions/run_fingers_through_hair.action.json†L2-L18】

## Current Patterns and Constraints

- **Target scoping** – Face-to-face caressing gestures use the `caressing:close_actors_facing_each_other` scope to ensure both proximity and mutual facing orientation. This scope filters the actor's `positioning:closeness.partners` array through a `positioning:both-actors-facing-each-other` condition, matching the pattern established by thumb wiping and chin cupping actions.【F:data/mods/caressing/scopes/close_actors_facing_each_other.scope†L1-L5】【F:data/mods/caressing/actions/thumb_wipe_cheek.action.json†L6】【F:data/mods/caressing/actions/cup_chin.action.json†L6】
- **Forbidden components** – To prevent action spam during oral sex scenarios, caressing actions targeting the face typically forbid the `positioning:giving_blowjob` component on the actor. Some actions also block `kissing:kissing` to avoid simultaneous face gestures, but for cheek caressing, only the blowjob restriction is required per design specifications.【F:data/mods/caressing/actions/thumb_wipe_cheek.action.json†L10-L12】
- **Message consistency** – The caressing mod enforces identical perceptible event and successful action messages to ensure narrative coherence, as validated by integration tests that compare both event types.【F:tests/integration/mods/caressing/thumb_wipe_cheek_action.test.js†L39-L58】
- **Visual theming** – All caressing actions share the standard purple color palette (`backgroundColor: #311b92`, `textColor: #d1c4e9`) for UI consistency across intimate gestures.【F:data/mods/caressing/actions/thumb_wipe_cheek.action.json†L15-L20】

## Action Requirements

Author `data/mods/caressing/actions/caress_cheek_softly.action.json` with the standard caressing schema shape and values:

- `$schema`: `schema://living-narrative-engine/action.schema.json`.
- `id`: `caressing:caress_cheek_softly`.
- `name`: `Caress Cheek Softly`.
- `description`: One-sentence summary of tenderly caressing the target's cheek.
- `targets`: `"caressing:close_actors_facing_each_other"` to ensure face-to-face proximity.
- `template`: **Exactly** `caress {target}'s cheek softly` per design request.
- `required_components.actor`: `["positioning:closeness"]`, matching the rest of the caressing suite.【F:data/mods/caressing/actions/thumb_wipe_cheek.action.json†L7-L9】
- `forbidden_components.actor`: `["positioning:giving_blowjob"]` **only**, as specified in the requirements—no kissing restriction for this action.
- `prerequisites`: Empty array `[]` following the minimal structure pattern, or omit entirely.【F:data/mods/caressing/actions/thumb_wipe_cheek.action.json†L14】
- `visual`: Reuse the standard purple color palette (`backgroundColor: #311b92`, `textColor: #d1c4e9`, `hoverBackgroundColor: #4527a0`, `hoverTextColor: #ede7f6`) for UI continuity.【F:data/mods/caressing/actions/thumb_wipe_cheek.action.json†L15-L20】
- Append the action ID to `data/mods/caressing/mod-manifest.json` under the `actions` array.

## Rule Requirements

Follow the storytelling cadence established by `caressing:thumb_wipe_cheek` when implementing the new rule JSON:

1. Place the rule at `data/mods/caressing/rules/handle_caress_cheek_softly.rule.json`.
2. `rule_id`: `handle_caress_cheek_softly` with a descriptive `comment` explaining its purpose.
3. `event_type`: `core:attempt_action`.
4. `condition`: `{ "condition_ref": "caressing:event-is-action-caress-cheek-softly" }`, requiring a new condition file `data/mods/caressing/conditions/event-is-action-caress-cheek-softly.condition.json` mirroring existing patterns.【F:data/mods/caressing/conditions/event-is-action-thumb-wipe-cheek.condition.json†L1-L13】
5. Action sequence:
   - `GET_NAME` for actor, storing `actorName` (for observer message).
   - `GET_NAME` for target, storing `targetName` (for all messages).
   - `QUERY_COMPONENT` for the actor's `core:position` component, storing `actorPosition`.
   - `SET_VARIABLE` `locationId` to `{context.actorPosition.locationId}` for robustness.
   - `SET_VARIABLE` `logMessage` to **exactly** `{context.actorName} caresses {context.targetName}'s cheek softly.` ensuring both perceptible and success logs share identical text.
   - `SET_VARIABLE` `perceptionType` to `action_target_general`.
   - `SET_VARIABLE` `targetId` to `{event.payload.targetId}`.
   - Invoke `{ "macro": "core:logSuccessAndEndTurn" }` to finish the turn, matching the thumb wipe rule flow.【F:data/mods/caressing/rules/thumb_wipe_cheek.rule.json†L2-L66】
6. Register the new rule and condition in `data/mods/caressing/mod-manifest.json` under their respective arrays.

## Condition Requirements

Create `data/mods/caressing/conditions/event-is-action-caress-cheek-softly.condition.json`:

- `$schema`: `schema://living-narrative-engine/condition.schema.json`.
- `id`: `caressing:event-is-action-caress-cheek-softly`.
- `description`: Brief description checking if the event is for the `caressing:caress_cheek_softly` action.
- `logic`: Standard equality check comparing `event.payload.actionId` to `caressing:caress_cheek_softly`.【F:data/mods/caressing/conditions/event-is-action-thumb-wipe-cheek.condition.json†L1-L13】

## Testing Requirements

Create comprehensive integration coverage under `tests/integration/mods/caressing/` using the Test Module Pattern described in the mod testing guide.【F:docs/testing/mod-testing-guide.md†L1-L138】 Build on existing caressing suites to validate both discoverability and rule execution.【F:tests/integration/mods/caressing/cup_chin_action_discovery.test.js†L1-L199】【F:tests/integration/mods/caressing/thumb_wipe_cheek_action.test.js†L1-L59】

### Action Discoverability Test

Create `tests/integration/mods/caressing/caress_cheek_softly_action_discovery.test.js`:

#### Test Structure
- Use `ModTestFixture.forAction('caressing', 'caressing:caress_cheek_softly')` in `beforeEach`.
- Import the action JSON directly for validation assertions.
- Configure action discovery with scope resolver customization if needed.
- Clean up in `afterEach` with `testFixture.cleanup()`.

#### Test Scenarios
1. **Action structure validation**:
   - Verify action ID matches `caressing:caress_cheek_softly`.
   - Confirm template is exactly `caress {target}'s cheek softly`.
   - Assert targets scope is `caressing:close_actors_facing_each_other`.
   - Validate required components include only `positioning:closeness`.
   - Verify forbidden components contain only `positioning:giving_blowjob`.
   - Check visual palette matches caressing standards.

2. **Positive discovery scenarios**:
   - **Available for close actors facing each other**: Create scenario with two actors in closeness and facing each other; verify action appears in available actions.

3. **Negative discovery scenarios**:
   - **Not available without closeness**: Remove `positioning:closeness` from actors; verify action doesn't appear.
   - **Not available when actor faces away**: Add `positioning:facing_away` component with target in `facing_away_from` array; verify action doesn't appear.
   - **Not available when target faces away**: Add `positioning:facing_away` component to target with actor in `facing_away_from` array; verify action doesn't appear.
   - **Not available during blowjob**: Add `positioning:giving_blowjob` component to actor; verify action doesn't appear.

#### Example Test Pattern
```javascript
it('is available for close actors facing each other', () => {
  const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
  configureActionDiscovery();

  const availableActions = testFixture.testEnv.getAvailableActions(
    scenario.actor.id
  );
  const ids = availableActions.map((action) => action.id);

  expect(ids).toContain('caressing:caress_cheek_softly');
});
```

### Rule Behavior Test

Create `tests/integration/mods/caressing/caress_cheek_softly_action.test.js`:

#### Test Structure
- Use `ModTestFixture.forAction('caressing', 'caressing:caress_cheek_softly', ruleFile, conditionFile)` in `beforeEach`.
- Import rule and condition JSON files.
- Clean up in `afterEach` with `testFixture.cleanup()`.

#### Test Scenarios
1. **Successful execution**:
   - Create close actors scenario.
   - Execute action with `await testFixture.executeAction(actorId, targetId)`.
   - Verify `core:display_successful_action_result` event is dispatched.
   - Assert success message is exactly `{actor} caresses {target}'s cheek softly.`

2. **Perceptible event validation**:
   - Create close actors scenario.
   - Execute action.
   - Find both `core:display_successful_action_result` and `core:perceptible_event` events.
   - Assert both events exist.
   - **Critical**: Verify success message exactly matches perceptible description text.

3. **Event metadata validation**:
   - Verify `perceptionType` is `action_target_general`.
   - Confirm `locationId` matches actor's location.
   - Validate `actorId` and `targetId` are correctly populated.

#### Example Test Pattern
```javascript
it('validates perceptible event message matches action success message', async () => {
  const scenario = testFixture.createCloseActors(['Diana', 'Victor'], {
    location: 'library',
  });

  await testFixture.executeAction(scenario.actor.id, scenario.target.id);

  const successEvent = testFixture.events.find(
    (e) => e.eventType === 'core:display_successful_action_result'
  );
  const perceptibleEvent = testFixture.events.find(
    (e) => e.eventType === 'core:perceptible_event'
  );

  expect(successEvent).toBeDefined();
  expect(perceptibleEvent).toBeDefined();
  expect(successEvent.payload.message).toBe(
    perceptibleEvent.payload.descriptionText
  );
});
```

### Test Execution
- Run `npm run test:integration -- tests/integration/mods/caressing/caress_cheek_softly*.test.js` locally to verify both suites pass.
- Ensure tests follow the mod testing guide patterns and use modern fixture APIs.【F:docs/testing/mod-testing-guide.md†L49-L93】
- Update documentation if any new helpers or patterns are introduced.

## Manifest Integration

Update `data/mods/caressing/mod-manifest.json` to register all new artifacts:

1. Add `"caressing:caress_cheek_softly"` to the `actions` array.
2. Add `"handle_caress_cheek_softly"` to the `rules` array.
3. Add `"caressing:event-is-action-caress-cheek-softly"` to the `conditions` array.

Ensure alphabetical ordering within each array for maintainability.

## Acceptance Criteria

- [ ] Action JSON exists at correct path with all required fields and exact template text.
- [ ] Action uses `caressing:close_actors_facing_each_other` scope for targets.
- [ ] Action requires `positioning:closeness` and forbids only `positioning:giving_blowjob`.
- [ ] Action uses standard caressing purple color palette.
- [ ] Rule JSON exists with proper structure and action sequence.
- [ ] Rule message is exactly `{actor} caresses {target}'s cheek softly.` (identical for both perceptible and success events).
- [ ] Condition JSON exists with correct action ID check.
- [ ] All artifacts registered in `mod-manifest.json`.
- [ ] Action discovery test suite covers all positive and negative scenarios.
- [ ] Rule behavior test validates execution, message consistency, and event metadata.
- [ ] Both integration test suites pass locally with `npm run test:integration`.
- [ ] Action validates against schema without errors.
- [ ] Rule and condition validate against their respective schemas.

## Implementation Notes

- The message format differs slightly from `thumb_wipe_cheek` (which uses "gently brushes their thumb across") to provide variety while maintaining the caressing mod's tender tone.
- Unlike some other caressing actions, this action does **not** forbid kissing—only the blowjob position is restricted per specifications.
- The scope `caressing:close_actors_facing_each_other` already exists and requires no modifications.【F:data/mods/caressing/scopes/close_actors_facing_each_other.scope†L1-L5】
- Follow exact message formatting in tests to ensure validation passes—the message must match character-for-character including punctuation and casing.
