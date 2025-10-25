# Violence: Tear Out Throat Action & Rule Specification

## Overview

This document defines a new violent action and rule for the violence mod that intersects with the vampirism mod's positioning components. The action allows an actor (vampire or non-vampire) who is currently biting a target's neck to violently tear out their throat. This is an extreme violent action that should result in severe consequences, removing the biting relationship and providing graphic narrative feedback consistent with the violence mod's aesthetic.

## Feature Summary

- **Feature Name**: Tear Out Throat
- **Mod**: `violence`
- **Action ID**: `violence:tear_out_throat`
- **Rule ID**: `handle_tear_out_throat`
- **Purpose**: Allow an actor biting a target's neck to violently tear out their throat, ending the bite and causing severe trauma
- **State Impact**: Removes the biting/being-bitten relationship components from both actors
- **Cross-Mod Integration**: Uses positioning components from vampirism mod (`positioning:biting_neck`, `positioning:being_bitten_in_neck`)

## Action Design

### Targets Scope
- Use `positioning:actor_being_bitten_by_me`
  - This scope is defined in the positioning mod and used by vampirism actions
  - Returns entities that the actor is currently biting
  - See `data/mods/vampirism/actions/drink_blood.action.json` for precedent

### Required Components
- `actor`: `["positioning:biting_neck"]`
  - Ensures the actor is actively biting someone's neck before they can tear it out
  - Component structure:
    ```json
    {
      "bitten_entity_id": "string",
      "initiated": "boolean",
      "consented": "boolean"
    }
    ```

### Forbidden Components
None specified. Unlike vampirism actions, this violence action does not forbid `positioning:being_bitten_in_neck` on the actor, as the violence is unilateral.

### Template & Visuals
- **Template**: `tear out {target}'s throat`
  - Uses possessive form for target's throat
  - Clear, direct language consistent with violence mod

- **Visual Scheme**: Match the violence mod's dark red palette from `grab_neck.action.json`:
  ```json
  {
    "backgroundColor": "#8b0000",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#b71c1c",
    "hoverTextColor": "#ffebee"
  }
  ```
  - Dark red background (#8b0000) for violence category
  - White text for high contrast and readability
  - Brighter red hover state (#b71c1c) for interaction feedback

### Metadata
- **Name**: "Tear Out Throat"
- **Description**: "Violently tear out the throat of the target you are currently biting, causing severe trauma and ending the bite."
- **Schema**: Ensure action schema fields align with `schema://living-narrative-engine/action.schema.json`

### Complete Action JSON Structure
Location: `data/mods/violence/actions/tear_out_throat.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "violence:tear_out_throat",
  "name": "Tear Out Throat",
  "description": "Violently tear out the throat of the target you are currently biting, causing severe trauma and ending the bite.",
  "targets": "positioning:actor_being_bitten_by_me",
  "required_components": {
    "actor": ["positioning:biting_neck"]
  },
  "template": "tear out {target}'s throat",
  "visual": {
    "backgroundColor": "#8b0000",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#b71c1c",
    "hoverTextColor": "#ffebee"
  }
}
```

## Rule Design

### Trigger Condition
- Mirror existing rule patterns from both violence and vampirism mods
- Bind to the action via a dedicated condition file
- Condition ID: `violence:event-is-action-tear_out_throat`

### Condition JSON Structure
Location: `data/mods/violence/conditions/event-is-action-tear_out_throat.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "violence:event-is-action-tear_out_throat",
  "description": "True when the event is an attempt to perform the tear_out_throat action",
  "condition": {
    "==": [
      { "var": "event.payload.actionId" },
      "violence:tear_out_throat"
    ]
  }
}
```

### Rule Effects

The rule must perform the following operations in order:

1. **Name Retrieval**: Get actor and target names for messaging
2. **Position Query**: Get actor's location for perceptible event
3. **Component Query**: Retrieve both positioning components to validate state
4. **Conditional Component Removal**:
   - Remove `positioning:biting_neck` from actor IF the component's `bitten_entity_id` matches the target
   - Remove `positioning:being_bitten_in_neck` from target IF the component's `biting_entity_id` matches the actor
   - This conditional logic prevents removing unrelated biting relationships
5. **Message Generation**: Set the violent, graphic message
6. **Event Dispatch**: Fire perceptible event and end turn

### Messaging
- **Perceptible Event Message**: `{actor} tears out {target}'s throat savagely, and arterial blood shoots out from the wound.`
- **Successful Action Message**: `{actor} tears out {target}'s throat savagely, and arterial blood shoots out from the wound.`
- **Perception Type**: `action_target_general`
- **Location**: Actor's current location ID

### Turn Handling
- End the actor's turn after state updates using the `core:logSuccessAndEndTurn` macro
- Align with violence mod conventions (see `handle_grab_neck.rule.json`)

### Complete Rule JSON Structure
Location: `data/mods/violence/rules/handle_tear_out_throat.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_tear_out_throat",
  "comment": "Handles the 'violence:tear_out_throat' action. Removes reciprocal neck-biting components, dispatches violent descriptive messaging, and ends the turn.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "violence:event-is-action-tear_out_throat"
  },
  "actions": [
    {
      "type": "GET_NAME",
      "parameters": { "entity_ref": "actor", "result_variable": "actorName" }
    },
    {
      "type": "GET_NAME",
      "parameters": { "entity_ref": "target", "result_variable": "targetName" }
    },
    {
      "type": "QUERY_COMPONENT",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "core:position",
        "result_variable": "actorPosition"
      }
    },
    {
      "type": "QUERY_COMPONENT",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "positioning:biting_neck",
        "result_variable": "actorBitingComponent"
      }
    },
    {
      "type": "QUERY_COMPONENT",
      "parameters": {
        "entity_ref": "target",
        "component_type": "positioning:being_bitten_in_neck",
        "result_variable": "targetBeingBittenComponent"
      }
    },
    {
      "type": "IF",
      "parameters": {
        "condition": {
          "and": [
            { "var": "context.actorBitingComponent" },
            {
              "==": [
                { "var": "context.actorBitingComponent.bitten_entity_id" },
                { "var": "event.payload.targetId" }
              ]
            }
          ]
        },
        "then_actions": [
          {
            "type": "REMOVE_COMPONENT",
            "parameters": {
              "entity_ref": "actor",
              "component_type": "positioning:biting_neck"
            }
          }
        ]
      }
    },
    {
      "type": "IF",
      "parameters": {
        "condition": {
          "and": [
            { "var": "context.targetBeingBittenComponent" },
            {
              "==": [
                { "var": "context.targetBeingBittenComponent.biting_entity_id" },
                { "var": "event.payload.actorId" }
              ]
            }
          ]
        },
        "then_actions": [
          {
            "type": "REMOVE_COMPONENT",
            "parameters": {
              "entity_ref": "target",
              "component_type": "positioning:being_bitten_in_neck"
            }
          }
        ]
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} tears out {context.targetName}'s throat savagely, and arterial blood shoots out from the wound."
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "perceptionType",
        "value": "action_target_general"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "locationId",
        "value": "{context.actorPosition.locationId}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "targetId",
        "value": "{event.payload.targetId}"
      }
    },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

## Testing Requirements

### Test File Organization
- **Discovery Test**: `tests/integration/mods/violence/tear_out_throat_action_discovery.test.js`
- **Execution Test**: `tests/integration/mods/violence/tear_out_throat_action.test.js`

### Action Discovery Tests

Create comprehensive integration tests under `tests/integration/mods/violence/` to verify action discoverability.

#### Test Suite Structure
```javascript
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import tearOutThroatAction from '../../../../data/mods/violence/actions/tear_out_throat.action.json';

const ACTION_ID = 'violence:tear_out_throat';

describe('violence:tear_out_throat action discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('violence', ACTION_ID);
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  // Test cases below
});
```

#### Required Test Cases

1. **Action Structure Validation**
   - Verify action ID matches `violence:tear_out_throat`
   - Verify template is `tear out {target}'s throat`
   - Verify targets scope is `positioning:actor_being_bitten_by_me`
   - Verify required components include `positioning:biting_neck`
   - Verify visual scheme matches violence mod palette

2. **Positive Discovery Scenarios**
   - Action is available when actor has `positioning:biting_neck` component referencing the target
   - Action is available when target has `positioning:being_bitten_in_neck` component referencing the actor
   - Scope `positioning:actor_being_bitten_by_me` correctly yields the target entity

3. **Negative Discovery Scenarios**
   - Action is hidden when actor lacks `positioning:biting_neck` component
   - Action is hidden when actor's `biting_neck` component references a different entity
   - Action is hidden when target lacks `positioning:being_bitten_in_neck` component
   - Action is hidden when entities are not in a biting relationship

4. **Edge Cases**
   - Multiple biting relationships (actor biting multiple targets)
   - Reciprocal biting (both actors biting each other)
   - Component data mismatches (IDs don't align)

#### Example Test Implementation
```javascript
it('is available when actor is biting the target\'s neck', () => {
  // Create actor and target with biting relationship
  const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

  // Add biting components
  scenario.actor.components['positioning:biting_neck'] = {
    bitten_entity_id: scenario.target.id,
    initiated: true,
    consented: false
  };

  scenario.target.components['positioning:being_bitten_in_neck'] = {
    biting_entity_id: scenario.actor.id,
    consented: false
  };

  const room = ModEntityScenarios.createRoom('room1', 'Test Room');
  testFixture.reset([room, scenario.actor, scenario.target]);

  const availableActions = testFixture.testEnv.getAvailableActions(
    scenario.actor.id
  );
  const ids = availableActions.map((action) => action.id);

  expect(ids).toContain(ACTION_ID);
});

it('is not available when actor is not biting anyone', () => {
  const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

  // No biting components
  const room = ModEntityScenarios.createRoom('room1', 'Test Room');
  testFixture.reset([room, scenario.actor, scenario.target]);

  const availableActions = testFixture.testEnv.getAvailableActions(
    scenario.actor.id
  );
  const ids = availableActions.map((action) => action.id);

  expect(ids).not.toContain(ACTION_ID);
});
```

### Rule Execution Tests

Create integration tests to verify rule behavior and state changes.

#### Test Suite Structure
```javascript
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import { ActionValidationError } from '../../../common/mods/actionExecutionValidator.js';
import tearOutThroatRule from '../../../../data/mods/violence/rules/handle_tear_out_throat.rule.json';
import eventIsActionTearOutThroat from '../../../../data/mods/violence/conditions/event-is-action-tear_out_throat.condition.json';

describe('Violence Mod: Tear Out Throat Action Integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'violence',
      'violence:tear_out_throat',
      tearOutThroatRule,
      eventIsActionTearOutThroat
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  // Test cases below
});
```

#### Required Test Cases

1. **Successful Execution**
   - Action executes successfully when preconditions are met
   - Both positioning components are removed from both entities
   - Success message matches expected text exactly
   - Perceptible event is dispatched with correct structure

2. **Component Removal Validation**
   - `positioning:biting_neck` is removed from actor
   - `positioning:being_bitten_in_neck` is removed from target
   - Components are only removed when IDs match (reciprocal validation)
   - No other components are modified

3. **Message Generation**
   - Perceptible event message is: `{actor} tears out {target}'s throat savagely, and arterial blood shoots out from the wound.`
   - Success message matches perceptible event message
   - Actor and target names are correctly substituted
   - Location ID is correct
   - Perception type is `action_target_general`

4. **Error Handling**
   - Action rejects when actor lacks `positioning:biting_neck`
   - Action rejects when target doesn't exist
   - Action rejects when component IDs don't match
   - Pre-flight validation catches missing entities

5. **Rule Isolation**
   - Rule doesn't fire for different action IDs
   - Only expected events are generated
   - No side effects on unrelated entities

#### Example Test Implementation
```javascript
describe('Action Execution', () => {
  it('performs tear out throat action successfully', async () => {
    const scenario = testFixture.createStandardActorTarget(['Alice', 'Beth']);

    // Setup biting relationship
    scenario.actor.components['positioning:biting_neck'] = {
      bitten_entity_id: scenario.target.id,
      initiated: true,
      consented: false
    };

    scenario.target.components['positioning:being_bitten_in_neck'] = {
      biting_entity_id: scenario.actor.id,
      consented: false
    };

    const room = ModEntityScenarios.createRoom('room1', 'Test Room');
    testFixture.reset([room, scenario.actor, scenario.target]);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    testFixture.assertActionSuccess(
      "Alice tears out Beth's throat savagely, and arterial blood shoots out from the wound."
    );
  });

  it('removes both positioning components', async () => {
    const scenario = testFixture.createStandardActorTarget(['Vampire', 'Victim']);

    scenario.actor.components['positioning:biting_neck'] = {
      bitten_entity_id: scenario.target.id,
      initiated: true,
      consented: false
    };

    scenario.target.components['positioning:being_bitten_in_neck'] = {
      biting_entity_id: scenario.actor.id,
      consented: false
    };

    const room = ModEntityScenarios.createRoom('room1', 'Test Room');
    testFixture.reset([room, scenario.actor, scenario.target]);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    // Verify components removed
    const actorInstance = testFixture.entityManager.getEntityInstance(
      scenario.actor.id
    );
    const targetInstance = testFixture.entityManager.getEntityInstance(
      scenario.target.id
    );

    expect(actorInstance.components['positioning:biting_neck']).toBeUndefined();
    expect(targetInstance.components['positioning:being_bitten_in_neck']).toBeUndefined();
  });
});

describe('Event Generation', () => {
  it('generates correct perceptible event message', async () => {
    const scenario = testFixture.createStandardActorTarget(['Alice', 'Beth']);

    scenario.actor.components['positioning:biting_neck'] = {
      bitten_entity_id: scenario.target.id,
      initiated: true,
      consented: false
    };

    scenario.target.components['positioning:being_bitten_in_neck'] = {
      biting_entity_id: scenario.actor.id,
      consented: false
    };

    const room = ModEntityScenarios.createRoom('room1', 'Test Room');
    testFixture.reset([room, scenario.actor, scenario.target]);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    testFixture.assertPerceptibleEvent({
      descriptionText: "Alice tears out Beth's throat savagely, and arterial blood shoots out from the wound.",
      locationId: 'room1',
      actorId: scenario.actor.id,
      targetId: scenario.target.id,
      perceptionType: 'action_target_general',
    });
  });
});

describe('Error Handling', () => {
  it('handles missing target gracefully', async () => {
    const scenario = testFixture.createStandardActorTarget(['Alice', 'Beth']);

    scenario.actor.components['positioning:biting_neck'] = {
      bitten_entity_id: 'nonexistent',
      initiated: true,
      consented: false
    };

    const room = ModEntityScenarios.createRoom('room1', 'Test Room');
    testFixture.reset([room, scenario.actor, scenario.target]);

    await expect(async () => {
      await testFixture.executeAction(scenario.actor.id, 'nonexistent');
    }).rejects.toThrow(ActionValidationError);
  });

  it('does not fire rule for different action', async () => {
    const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

    const payload = {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'core:wait',
      originalInput: 'wait',
    };

    await testFixture.eventBus.dispatch('core:attempt_action', payload);

    testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
  });
});
```

### Regression Coverage

Include negative tests to ensure robustness:

1. **Component Mismatch Scenarios**
   - Actor's `biting_neck.bitten_entity_id` doesn't match target
   - Target's `being_bitten_in_neck.biting_entity_id` doesn't match actor
   - Components should remain unchanged in mismatch cases

2. **Forbidden Component Violations**
   - Any additional guard conditions are properly enforced
   - Pre-validation catches violations before rule execution

3. **Concurrent Relationships**
   - Multiple biting relationships on the same actor
   - Only the specified relationship is affected

### Testing Framework Notes

- **Follow Latest Guidelines**: Use patterns documented in `docs/testing/mod-testing-guide.md`
- **Fixture Usage**: Always use `ModTestFixture.forAction()` pattern
- **Scenario Helpers**: Use `createStandardActorTarget()` and related helpers
- **Domain Matchers**: Import and use matchers from `tests/common/mods/domainMatchers.js`
- **Cleanup**: Always call `testFixture.cleanup()` in `afterEach`
- **Test Organization**: Group related tests in describe blocks

### Test Execution Commands

```bash
# Run all violence mod tests
npm run test:integration -- tests/integration/mods/violence/

# Run specific test file
npm run test:integration -- tests/integration/mods/violence/tear_out_throat_action.test.js

# Run with coverage
npm run test:integration -- --coverage tests/integration/mods/violence/

# Run in watch mode for development
npm run test:single -- tests/integration/mods/violence/tear_out_throat_action.test.js
```

## Implementation Checklist

### Phase 1: Data Files

- [ ] Create `data/mods/violence/actions/tear_out_throat.action.json`
  - Use exact JSON structure from this spec
  - Validate against action schema

- [ ] Create `data/mods/violence/conditions/event-is-action-tear_out_throat.condition.json`
  - Use exact JSON structure from this spec
  - Validate against condition schema

- [ ] Create `data/mods/violence/rules/handle_tear_out_throat.rule.json`
  - Use exact JSON structure from this spec
  - Validate against rule schema

- [ ] Update `data/mods/violence/mod-manifest.json`
  - Add action, condition, and rule to appropriate arrays
  - Ensure dependency on positioning mod if not already present

### Phase 2: Validation

- [ ] Run schema validation
  ```bash
  npm run validate:mod:violence
  ```

- [ ] Run lint checks on JSON files
  ```bash
  npm run lint
  ```

- [ ] Verify no TypeScript errors
  ```bash
  npm run typecheck
  ```

### Phase 3: Test Implementation

- [ ] Create `tests/integration/mods/violence/tear_out_throat_action_discovery.test.js`
  - Implement all discovery test cases from this spec
  - Include positive, negative, and edge case scenarios

- [ ] Create `tests/integration/mods/violence/tear_out_throat_action.test.js`
  - Implement all execution test cases from this spec
  - Include component removal, messaging, and error handling tests

- [ ] Run tests to verify implementation
  ```bash
  npm run test:integration -- tests/integration/mods/violence/tear_out_throat*
  ```

### Phase 4: Integration Testing

- [ ] Test in actual game environment
  - Load game with violence mod
  - Set up biting scenario (requires vampirism mod loaded)
  - Verify action appears in action list
  - Execute action and verify visual feedback
  - Verify components are removed correctly

- [ ] Cross-mod compatibility testing
  - Test with vampirism mod loaded
  - Test with positioning mod only
  - Verify no conflicts with other violence actions

- [ ] Performance testing
  - Verify no performance regression
  - Check action discovery performance
  - Verify rule execution performance

### Phase 5: Documentation

- [ ] Add action to violence mod documentation (if exists)
- [ ] Update any mod interaction documentation
- [ ] Add to CHANGELOG.md with version notes
- [ ] Document any new fixtures or test utilities introduced

### Phase 6: Code Review Preparation

- [ ] Ensure all tests pass
  ```bash
  npm run test:ci
  ```

- [ ] Verify code quality
  ```bash
  npm run lint
  npm run format
  ```

- [ ] Prepare PR description with:
  - Link to this specification
  - Summary of changes
  - Test coverage metrics
  - Screenshots/videos of action in game

## Design Rationale

### Why Violence Mod vs Vampirism Mod?

The action is placed in the violence mod because:

1. **Primary Intent**: The action is fundamentally a violent assault, not a vampiric ability
2. **Universal Applicability**: Any actor (vampire or not) can perform this action while biting
3. **Visual Design**: Uses violence mod's red color scheme, not vampirism's crimson
4. **Mod Separation**: Keeps vampirism focused on vampiric abilities, violence focused on violent actions
5. **Code Organization**: Violence mod already has neck-related violence actions (`grab_neck`, `squeeze_neck_with_both_hands`)

### Component Removal Logic

The conditional removal pattern is borrowed from `handle_pull_out_fangs.rule.json` to ensure:

1. **Safety**: Only remove components when IDs actually match
2. **Robustness**: Handle edge cases where components might be stale or mismatched
3. **Predictability**: Prevent unintended side effects on unrelated biting relationships
4. **Maintainability**: Use proven patterns that work across the codebase

### Message Design

The graphic message is intentionally violent and detailed because:

1. **Tone Consistency**: Matches the severity of the action
2. **Narrative Impact**: Creates memorable, impactful moments
3. **Player Clarity**: Makes consequences immediately clear
4. **Mod Identity**: Aligns with violence mod's aesthetic

### Testing Strategy

The comprehensive testing approach ensures:

1. **Discoverability**: Action appears only when it should
2. **Correctness**: Components are removed properly
3. **Safety**: Edge cases and errors are handled gracefully
4. **Regression Prevention**: Future changes don't break this feature
5. **Documentation**: Tests serve as implementation examples

## Future Considerations

### Potential Enhancements

1. **Health/Damage System**: If implemented, this action could cause significant damage or death
2. **Bleeding Component**: Could add a bleeding status effect to the target
3. **Relationship Impact**: Could affect relationship components between entities
4. **Crime/Consequence System**: Could trigger law enforcement or social consequences
5. **Animation/Sound**: Could add specific visual or audio feedback

### Related Features

This action pairs well with:

- **Vampirism bite actions**: Natural progression from biting
- **Violence escalation**: Part of a violence progression tree
- **Medical system**: Could require healing/treatment
- **Social systems**: Could affect reputation/relationships

### Compatibility Notes

- Requires positioning mod for component definitions
- Works with vampirism mod but doesn't require it
- Compatible with all existing violence mod actions
- No conflicts with other mods identified

## Appendix: Reference Files

### Analyzed Reference Actions

- `data/mods/violence/actions/grab_neck.action.json` - Visual scheme source
- `data/mods/vampirism/actions/pull_out_fangs.action.json` - Scope pattern reference
- `data/mods/vampirism/actions/drink_blood.action.json` - Component requirements reference

### Analyzed Reference Rules

- `data/mods/violence/rules/handle_grab_neck.rule.json` - Simple violence rule pattern
- `data/mods/vampirism/rules/handle_pull_out_fangs.rule.json` - Complex component removal pattern

### Analyzed Reference Tests

- `tests/integration/mods/violence/grab_neck_action.test.js` - Execution test patterns
- `tests/integration/mods/violence/grab_neck_action_discovery.test.js` - Discovery test patterns

### Documentation References

- `docs/testing/mod-testing-guide.md` - Primary testing reference
- `CLAUDE.md` - Project conventions and patterns

---

**Specification Version**: 1.0
**Created**: 2025-10-25
**Status**: Ready for Implementation
