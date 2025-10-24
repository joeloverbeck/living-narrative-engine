# Brush Hair Behind Ear Affection Action Specification

## Overview

Add a new gentle, intimate interaction where the actor brushes a stray lock of hair behind the target's ear. This action fits within the **affection** mod because:

- The affection manifest describes the category as *"Caring, supportive physical interactions that can be platonic or romantic"*, which matches the tender gesture of brushing hair behind someone's ear.
- Existing affection actions focus on warm, caring gestures (e.g., `ruffle_hair_playfully`, `place_hands_on_shoulders`) with straightforward closeness requirements, similar to this new action.
- The intimate yet non-sexual nature aligns with affection mod's tone rather than the more sensual caressing mod.

Therefore, implement the new action and supporting files under `data/mods/affection/` while using the positioning mod's `close_actors_or_entity_kneeling_before_actor` scope for target resolution.

## Action Requirements

Create `data/mods/affection/actions/brush_hair_behind_ear.action.json` following existing affection action patterns:

- `$schema`: `schema://living-narrative-engine/action.schema.json`
- `id`: `affection:brush_hair_behind_ear`
- `name`: `Brush hair behind ear`
- `description`: concise, warm explanation (e.g., "Gently brush a stray lock of hair behind the target's ear.")
- `targets`: `positioning:close_actors_or_entity_kneeling_before_actor`
  - This scope allows the action when:
    - Actors are facing each other OR actor is behind target
    - Actor is NOT kneeling before entity (can't reach up from kneeling)
    - Entity CAN be kneeling before actor (head/hair is reachable)
- `required_components.actor`: `["positioning:closeness"]` (same as other affection touch actions)
- No forbidden components unless discovery testing shows a need
- `template`: **exactly** `brush a lock of hair behind {target}'s ear`
- `visual`: reuse affection color palette (background `#6a1b9a`, text `#f3e5f5`, hover `#8e24aa`/`#ffffff`) for consistency

Add the action to the `actions` array inside `data/mods/affection/mod-manifest.json`.

## Condition Requirements

Create `data/mods/affection/conditions/event-is-action-brush-hair-behind-ear.condition.json` mirroring the naming and structure of other affection conditions, checking for the `affection:brush_hair_behind_ear` action ID.

**Structure**:
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "affection:event-is-action-brush-hair-behind-ear",
  "description": "Checks if the event represents the brush hair behind ear action.",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "affection:brush_hair_behind_ear"
    ]
  }
}
```

Include the new condition filename in the manifest's `conditions` array.

## Rule Requirements

Create `data/mods/affection/rules/handle_brush_hair_behind_ear.rule.json` using the standard affection rule pattern:

- `rule_id`: `handle_brush_hair_behind_ear`
- `comment`: "Handles the 'affection:brush_hair_behind_ear' action. Dispatches descriptive text and ends the turn."
- `event_type`: `core:attempt_action`
- `condition`: `{ "condition_ref": "affection:event-is-action-brush-hair-behind-ear" }`
- Actions sequence:
  1. `GET_NAME` actor → `actorName`
  2. `GET_NAME` target → `targetName`
  3. `QUERY_COMPONENT` actor `core:position` → `actorPosition`
  4. `SET_VARIABLE` `logMessage` to **exact** string: `{actor} brushes a stray lock of hair behind {target}'s ear.` implemented as `"{context.actorName} brushes a stray lock of hair behind {context.targetName}'s ear."`
  5. `SET_VARIABLE` `perceptionType`: `action_target_general`
  6. `SET_VARIABLE` `locationId`: `{context.actorPosition.locationId}`
  7. `SET_VARIABLE` `targetId`: `{event.payload.targetId}`
  8. `{ "macro": "core:logSuccessAndEndTurn" }`

**Critical**: Both the successful action message and the perceptible event message must use the identical sentence to ensure narrative consistency across different event types.

Add the rule filename to the manifest's `rules` array.

## Testing Specification

Implement comprehensive integration tests alongside existing affection tests to cover both discoverability and rule behavior. Reference the mod testing guide in `docs/testing/MOD_TESTING_GUIDE.md` for detailed patterns and best practices.

### 1. Action Discoverability Test

Create `tests/integration/mods/affection/brush_hair_behind_ear_action_discovery.test.js` using `ModTestFixture.forAction('affection', 'affection:brush_hair_behind_ear')`.

**Test Structure**:
```javascript
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import brushHairBehindEarAction from '../../../../data/mods/affection/actions/brush_hair_behind_ear.action.json';

const ACTION_ID = 'affection:brush_hair_behind_ear';
```

**Required Test Suites**:

#### Suite 1: Action Structure Validation
- Validate the action JSON structure (id, template, targets, required components, visual palette)
- Verify `id` equals `affection:brush_hair_behind_ear`
- Verify `template` equals `"brush a lock of hair behind {target}'s ear"`
- Verify `targets` equals `'positioning:close_actors_or_entity_kneeling_before_actor'`
- Verify `required_components.actor` contains `['positioning:closeness']`
- Verify `visual` object matches affection color palette

#### Suite 2: Positive Discovery Scenarios
Test cases should use `testFixture.createCloseActors()` to build scenarios and call `testFixture.testEnv.getAvailableActions(actorId)` to assert action availability:

1. **Face-to-face availability**: Action appears when actors are close and facing each other
   ```javascript
   it('is available for close actors facing each other', () => {
     const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
     configureActionDiscovery();

     const availableActions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
     const ids = availableActions.map(action => action.id);

     expect(ids).toContain(ACTION_ID);
   });
   ```

2. **Actor behind target availability**: Action appears when actor stands behind target
   ```javascript
   it('is available when the actor stands behind the target', () => {
     const scenario = testFixture.createCloseActors(['Maya', 'Noah']);
     scenario.target.components['positioning:facing_away'] = {
       facing_away_from: [scenario.actor.id]
     };

     const room = ModEntityScenarios.createRoom('room1', 'Test Room');
     testFixture.reset([room, scenario.actor, scenario.target]);
     configureActionDiscovery();

     const availableActions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
     const ids = availableActions.map(action => action.id);

     expect(ids).toContain(ACTION_ID);
   });
   ```

3. **Target kneeling before actor availability**: Action appears when target kneels before actor (hair/head is reachable)
   ```javascript
   it('is available when the target is kneeling before the actor', () => {
     const scenario = testFixture.createCloseActors(['Sophia', 'Liam']);
     scenario.target.components['positioning:kneeling_before'] = {
       entityId: scenario.actor.id
     };

     const room = ModEntityScenarios.createRoom('room1', 'Test Room');
     testFixture.reset([room, scenario.actor, scenario.target]);
     configureActionDiscovery();

     const availableActions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
     const ids = availableActions.map(action => action.id);

     expect(ids).toContain(ACTION_ID);
   });
   ```

#### Suite 3: Negative Discovery Scenarios
Test cases verifying the action is properly blocked when requirements aren't met:

1. **No closeness blocking**: Action absent when `positioning:closeness` is removed
   ```javascript
   it('is not available when actors are not in closeness', () => {
     const scenario = testFixture.createCloseActors(['Ivy', 'Liam']);
     delete scenario.actor.components['positioning:closeness'];
     delete scenario.target.components['positioning:closeness'];

     const room = ModEntityScenarios.createRoom('room1', 'Test Room');
     testFixture.reset([room, scenario.actor, scenario.target]);
     configureActionDiscovery();

     const availableActions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
     const ids = availableActions.map(action => action.id);

     expect(ids).not.toContain(ACTION_ID);
   });
   ```

2. **Actor facing away blocking**: Action absent when actor faces away from target
   ```javascript
   it('is not available when the actor faces away from the target', () => {
     const scenario = testFixture.createCloseActors(['Chloe', 'Evan']);
     scenario.actor.components['positioning:facing_away'] = {
       facing_away_from: [scenario.target.id]
     };

     const room = ModEntityScenarios.createRoom('room1', 'Test Room');
     testFixture.reset([room, scenario.actor, scenario.target]);
     configureActionDiscovery();

     const availableActions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
     const ids = availableActions.map(action => action.id);

     expect(ids).not.toContain(ACTION_ID);
   });
   ```

3. **Actor kneeling before target blocking**: Action absent when actor is kneeling (can't reach up)
   ```javascript
   it('is not available when the actor is kneeling before the target', () => {
     const scenario = testFixture.createCloseActors(['Emma', 'Oliver']);
     scenario.actor.components['positioning:kneeling_before'] = {
       entityId: scenario.target.id
     };

     const room = ModEntityScenarios.createRoom('room1', 'Test Room');
     testFixture.reset([room, scenario.actor, scenario.target]);
     configureActionDiscovery();

     const availableActions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
     const ids = availableActions.map(action => action.id);

     expect(ids).not.toContain(ACTION_ID);
   });
   ```

**Implementation Details**:
- Use `configureActionDiscovery()` helper to set up custom scope resolution that mirrors the `positioning:close_actors_or_entity_kneeling_before_actor` logic
- Mock the scope resolver to handle kneeling scenarios and facing directions
- Use `ModEntityScenarios` helpers for creating consistent test entities
- Follow the pattern from `ruffle_hair_playfully_action_discovery.test.js` for scope resolver setup

### 2. Rule Behavior Test

Create `tests/integration/mods/affection/brush_hair_behind_ear_action.test.js` (mirroring other affection action tests).

**Test Structure**:
```javascript
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import handleBrushHairBehindEarRule from '../../../../data/mods/affection/rules/handle_brush_hair_behind_ear.rule.json';
import eventIsActionBrushHairBehindEar from '../../../../data/mods/affection/conditions/event-is-action-brush-hair-behind-ear.condition.json';

const ACTION_ID = 'affection:brush_hair_behind_ear';
```

**Required Test Cases**:

1. **Message accuracy verification**: Both success and perceptible events use exact message
   ```javascript
   it('emits matching success and perceptible messages when executed', async () => {
     const scenario = testFixture.createCloseActors(['Amelia', 'Jonah'], {
       location: 'garden'
     });

     await testFixture.executeAction(scenario.actor.id, scenario.target.id);

     const successEvent = testFixture.events.find(
       event => event.eventType === 'core:display_successful_action_result'
     );
     const perceptibleEvent = testFixture.events.find(
       event => event.eventType === 'core:perceptible_event'
     );

     expect(successEvent).toBeDefined();
     expect(perceptibleEvent).toBeDefined();

     const expectedMessage = "Amelia brushes a stray lock of hair behind Jonah's ear.";
     expect(successEvent.payload.message).toBe(expectedMessage);
     expect(perceptibleEvent.payload.descriptionText).toBe(expectedMessage);
   });
   ```

2. **Event payload validation**: Verify perception type, location, and target
   ```javascript
   it('includes correct metadata in perceptible event', async () => {
     const scenario = testFixture.createCloseActors(['Isabella', 'Lucas'], {
       location: 'library'
     });

     await testFixture.executeAction(scenario.actor.id, scenario.target.id);

     const perceptibleEvent = testFixture.events.find(
       event => event.eventType === 'core:perceptible_event'
     );

     expect(perceptibleEvent.payload.perceptionType).toBe('action_target_general');
     expect(perceptibleEvent.payload.locationId).toBe('library');
     expect(perceptibleEvent.payload.targetId).toBe(scenario.target.id);
   });
   ```

3. **Action specificity verification**: Rule only triggers for this action
   ```javascript
   it('only triggers for brush_hair_behind_ear action', async () => {
     const scenario = testFixture.createCloseActors(['Ava', 'Mason'], {
       location: 'study'
     });

     // Execute different action
     await testFixture.executeAction(
       scenario.actor.id,
       scenario.target.id,
       'affection:ruffle_hair_playfully'
     );

     const ruleEvents = testFixture.events.filter(
       event => event.payload?.logMessage?.includes('brushes a stray lock')
     );

     expect(ruleEvents).toHaveLength(0);
   });
   ```

4. **Optional: Event filtering verification**: No extraneous events
   ```javascript
   it('produces only expected events', async () => {
     const scenario = testFixture.createCloseActors(['Charlotte', 'Ethan'], {
       location: 'park'
     });

     await testFixture.executeAction(scenario.actor.id, scenario.target.id);

     testFixture.assertOnlyExpectedEvents([
       'core:display_successful_action_result',
       'core:perceptible_event',
       'core:turn_ended'
     ]);
   });
   ```

**Implementation Details**:
- Use `ModTestFixture.forAction` with auto-loaded rule and condition
- Execute action via `executeAction` helper method
- Assert on event payloads using `testFixture.events` array
- Optionally use `testFixture.assertOnlyExpectedEvents` for comprehensive validation
- Follow pattern from `ruffle_hair_playfully_action.test.js` for consistency

### Test Coverage Requirements

Both test files must provide **real assertions** with actual expected values:
- ❌ **Never use**: `expect(true).toBe(true)` or placeholder tests
- ✅ **Always use**: Specific value checks, message verification, component validation

Run `npm run test:integration` after implementation to ensure all integration tests pass.

## Testing Documentation References

Consult these resources for detailed testing patterns:
- `docs/testing/MOD_TESTING_GUIDE.md` - Comprehensive mod testing guide
- `tests/common/mods/ModTestFixture.js` - Test fixture usage and helpers
- `tests/common/mods/ModEntityBuilder.js` - Entity creation helpers and scenarios
- Existing affection tests in `tests/integration/mods/affection/` - Real-world examples

## Scope DSL Reference

The target scope `positioning:close_actors_or_entity_kneeling_before_actor` is defined as:

```
positioning:close_actors_or_entity_kneeling_before_actor :=
  actor.components.positioning:closeness.partners[][{
    "and": [
      {
        "or": [
          {"condition_ref": "positioning:both-actors-facing-each-other"},
          {"condition_ref": "positioning:actor-is-behind-entity"}
        ]
      },
      {"!": {"condition_ref": "positioning:actor-kneeling-before-entity"}}
    ]
  }]
```

This scope:
- Iterates over actors in closeness with the actor
- Filters to those where EITHER actors face each other OR actor is behind entity
- Excludes cases where actor is kneeling before entity (can't reach up)
- Implicitly allows cases where entity is kneeling before actor (head/hair reachable)

## Manifest & Documentation Updates

Update `data/mods/affection/mod-manifest.json` to register all new files:

1. Add action file to `actions` array
2. Add condition file to `conditions` array
3. Add rule file to `rules` array

Ensure all entries follow the manifest's existing structure and ordering conventions.

## Acceptance Criteria

- ✅ New action, condition, and rule files reside in the affection mod
- ✅ All files follow established schema patterns and validate successfully
- ✅ Action appears in manifest's `actions`, `conditions`, and `rules` arrays
- ✅ Discoverability tests cover all positive and negative scenarios
- ✅ Rule integration tests verify exact message matching
- ✅ Both successful action and perceptible event messages exactly match: `{actor} brushes a stray lock of hair behind {target}'s ear.`
- ✅ Tests use real assertions, not placeholders
- ✅ All tests in `npm run test:integration` pass successfully
- ✅ Action uses correct target scope: `positioning:close_actors_or_entity_kneeling_before_actor`
- ✅ Action requires `positioning:closeness` component
- ✅ Visual styling matches affection mod color palette

## Implementation Checklist

- [ ] Create `data/mods/affection/actions/brush_hair_behind_ear.action.json`
- [ ] Create `data/mods/affection/conditions/event-is-action-brush-hair-behind-ear.condition.json`
- [ ] Create `data/mods/affection/rules/handle_brush_hair_behind_ear.rule.json`
- [ ] Update `data/mods/affection/mod-manifest.json` with all three files
- [ ] Create `tests/integration/mods/affection/brush_hair_behind_ear_action_discovery.test.js`
- [ ] Create `tests/integration/mods/affection/brush_hair_behind_ear_action.test.js`
- [ ] Run `npm run test:integration` and verify all tests pass
- [ ] Validate schema compliance for all JSON files
- [ ] Verify in-game behavior matches specification

## Notes for Implementers

1. **Message Consistency**: The phrase "brushes a stray lock of hair" must appear identically in both the rule's `logMessage` variable and the resulting perceptible event text.

2. **Scope Behavior**: The `close_actors_or_entity_kneeling_before_actor` scope handles complex positioning logic. Test thoroughly to ensure:
   - Actor can reach target's head/hair from face-to-face position
   - Actor can reach target's head/hair from behind
   - Target kneeling before actor allows action (head is accessible)
   - Actor kneeling before target blocks action (can't reach up)

3. **Test Fixture Usage**: `ModTestFixture.forAction` automatically loads mod dependencies and sets up the test environment. Use `createCloseActors()` helper for consistent entity creation.

4. **Color Palette**: The affection mod uses a consistent purple palette. All affection actions should share this visual identity for UI coherence.

5. **Validation**: Always run schema validation after creating JSON files. The build process includes validation that will catch schema violations early.
