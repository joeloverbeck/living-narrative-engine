# Specification: Bite Neck Carefully Action (Vampirism Mod)

**Status**: Design
**Mod**: vampirism
**Created**: 2025-10-25
**Version**: 1.0

---

## Overview

This specification defines a new action/rule combo for the vampirism mod that enables a vampire character to bite another character's neck carefully. This is a more controlled version of neck biting compared to aggressive alternatives.

### Context

The action leverages existing vampirism components (`vampirism:biting_neck`, `vampirism:being_bitten_in_neck`) to establish a biting relationship between two actors. The action is designed to be available when actors are in close proximity, either facing each other or with the actor positioned behind the target.

---

## 1. Action Definition

**File**: `data/mods/vampirism/actions/bite_neck_carefully.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "vampirism:bite_neck_carefully",
  "name": "Bite Neck Carefully",
  "description": "Carefully sink your fangs into the target's neck to feed",
  "targets": "positioning:close_actors_facing_each_other_or_behind_target",
  "required_components": {
    "actor": ["positioning:closeness"]
  },
  "forbidden_components": {
    "actor": ["vampirism:biting_neck", "positioning:giving_blowjob"],
    "primary": ["vampirism:being_bitten_in_neck"]
  },
  "template": "bite {target}'s neck carefully",
  "visual": {
    "backgroundColor": "#6c0f36",
    "textColor": "#ffe6ef",
    "hoverBackgroundColor": "#861445",
    "hoverTextColor": "#fff2f7"
  }
}
```

### Design Decisions

- **Targets Scope**: `positioning:close_actors_facing_each_other_or_behind_target`
  - Allows biting from face-to-face position
  - Allows biting from behind position
  - Excludes kneeling scenarios (incompatible vertical positioning)

- **Required Components (Actor)**:
  - `positioning:closeness` - Ensures actors are in established proximity

- **Forbidden Components (Actor)**:
  - `vampirism:biting_neck` - Prevents simultaneous biting of multiple targets
  - `positioning:giving_blowjob` - Prevents action during incompatible mouth engagement

- **Forbidden Components (Primary Target)**:
  - `vampirism:being_bitten_in_neck` - Prevents multiple vampires biting the same target simultaneously

- **Visual Scheme**: Matches `bare_fangs.action.json`
  - Burgundy/dark red theme appropriate for vampiric actions
  - Consistent with existing vampirism mod aesthetics

---

## 2. Component Schemas

### 2.1 Biting Neck Component

**File**: `data/mods/vampirism/components/biting_neck.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "vampirism:biting_neck",
  "description": "Indicates the entity is actively biting another entity's neck",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["target_id"],
    "properties": {
      "target_id": {
        "description": "The entity ID of the target being bitten",
        "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId"
      }
    }
  }
}
```

### 2.2 Being Bitten in Neck Component

**File**: `data/mods/vampirism/components/being_bitten_in_neck.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "vampirism:being_bitten_in_neck",
  "description": "Indicates the entity is having their neck bitten by another entity",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["biter_id"],
    "properties": {
      "biter_id": {
        "description": "The entity ID of the vampire biting this entity",
        "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId"
      }
    }
  }
}
```

---

## 3. Rule Definition

**File**: `data/mods/vampirism/rules/handle_bite_neck_carefully.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_bite_neck_carefully",
  "comment": "Handles the 'vampirism:bite_neck_carefully' action. Adds biting components to actor and target, dispatches descriptive perceptible event and ends turn.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "vampirism:event-is-action-bite-neck-carefully"
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
      "type": "ADD_COMPONENT",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "vampirism:biting_neck",
        "value": {
          "target_id": "{event.payload.targetId}"
        }
      }
    },
    {
      "type": "ADD_COMPONENT",
      "parameters": {
        "entity_ref": "target",
        "component_type": "vampirism:being_bitten_in_neck",
        "value": {
          "biter_id": "{event.payload.actorId}"
        }
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} sinks their fangs in {context.targetName}'s neck carefully."
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

### Rule Operation Sequence

1. **Name Retrieval**: Get actor and target display names for message formatting
2. **Position Query**: Retrieve actor's position for location context
3. **Component Addition (Actor)**: Add `vampirism:biting_neck` with target reference
4. **Component Addition (Target)**: Add `vampirism:being_bitten_in_neck` with biter reference
5. **Message Construction**: Format perceptible event and success messages
6. **Event Dispatch**: Use `logSuccessAndEndTurn` macro for standard completion

---

## 4. Condition Definition

**File**: `data/mods/vampirism/conditions/event-is-action-bite-neck-carefully.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "vampirism:event-is-action-bite-neck-carefully",
  "description": "Matches events where the action is 'vampirism:bite_neck_carefully'",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "vampirism:bite_neck_carefully"
    ]
  }
}
```

---

## 5. Test Suite Specifications

### 5.1 Action Discovery Tests

**File**: `tests/integration/mods/vampirism/bite_neck_carefully_action_discovery.test.js`

#### Test Coverage Requirements

The discovery test suite must validate the following scenarios:

##### ✅ Positive Discovery Cases

1. **Base Case: Close Actors Facing Each Other**
   - Actor and target in same location
   - Both have `positioning:closeness` with each other as partners
   - Actors are facing each other
   - Action should be discovered

2. **Positioning Variation: Actor Behind Target**
   - Actor and target in same location
   - Both have `positioning:closeness`
   - Actor has `positioning:standing_behind` component with target reference
   - Action should be discovered

##### ❌ Negative Discovery Cases

3. **Missing Closeness Component**
   - Actors in same location but no `positioning:closeness`
   - Action should NOT be discovered

4. **Actor Already Biting**
   - Actor has `vampirism:biting_neck` component
   - Action should NOT be discovered

5. **Actor Giving Blowjob**
   - Actor has `positioning:giving_blowjob` component
   - Action should NOT be discovered

6. **Target Already Being Bitten**
   - Target has `vampirism:being_bitten_in_neck` component
   - Action should NOT be discovered

7. **Actors Not in Proximity**
   - Actors in different locations
   - Action should NOT be discovered

8. **Kneeling Scenarios**
   - Actor kneeling before target (excluded by scope)
   - Target kneeling before actor (excluded by scope)
   - Action should NOT be discovered

#### Test Structure Template

```javascript
/**
 * @file Action discovery tests for vampirism:bite_neck_carefully
 * @description Validates action availability under various component and positioning configurations
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { createActionDiscoveryBed } from '../../../common/actions/actionDiscoveryServiceTestBed.js';
import '../../../common/actionMatchers.js';

const ACTION_ID = 'vampirism:bite_neck_carefully';

describe('vampirism:bite_neck_carefully - Action Discovery', () => {
  let testBed;

  beforeEach(() => {
    testBed = createActionDiscoveryBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Positive Discovery Cases', () => {
    it('discovers action when actors are close and facing each other', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        closeProximity: true,
      });

      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).toHaveAction(ACTION_ID);
    });

    it('discovers action when actor is behind target', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        closeProximity: true,
      });

      // Add standing_behind component
      actor.components['positioning:standing_behind'] = {
        target_id: target.id,
      };

      testBed.reset([actor, target]);

      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).toHaveAction(ACTION_ID);
    });
  });

  describe('Negative Discovery Cases', () => {
    it('does not discover when closeness component is missing', async () => {
      const { actor } = testBed.createActorTargetScenario({
        closeProximity: false,
      });

      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).not.toHaveAction(ACTION_ID);
    });

    it('does not discover when actor already has biting_neck component', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        closeProximity: true,
      });

      actor.components['vampirism:biting_neck'] = {
        target_id: 'other_entity',
      };

      testBed.reset([actor, target]);

      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).not.toHaveAction(ACTION_ID);
    });

    it('does not discover when actor has giving_blowjob component', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        closeProximity: true,
      });

      actor.components['positioning:giving_blowjob'] = {
        target_id: target.id,
      };

      testBed.reset([actor, target]);

      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).not.toHaveAction(ACTION_ID);
    });

    it('does not discover when target has being_bitten_in_neck component', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        closeProximity: true,
      });

      target.components['vampirism:being_bitten_in_neck'] = {
        biter_id: 'other_vampire',
      };

      testBed.reset([actor, target]);

      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).not.toHaveAction(ACTION_ID);
    });

    it('does not discover when actors are not in proximity', async () => {
      const actor = testBed.createActorWithValidation('actor1', {
        name: 'Dracula',
      });
      const target = testBed.createActorWithValidation('target1', {
        name: 'Jonathan',
      });

      // Different locations, no closeness
      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).not.toHaveAction(ACTION_ID);
    });
  });

  describe('Discovery Diagnostics', () => {
    it('provides diagnostic information when discovery fails', async () => {
      const { actor } = testBed.createActorTargetScenario({
        closeProximity: false,
      });

      const { diagnostics } = await testBed.discoverActionsWithDiagnostics(
        actor,
        { includeDiagnostics: true }
      );

      expect(diagnostics).toBeDefined();
      // Validate diagnostic structure if needed for debugging
    });
  });
});
```

---

### 5.2 Rule Execution Tests

**File**: `tests/integration/mods/vampirism/bite_neck_carefully_action.test.js`

#### Test Coverage Requirements

The rule execution test suite must validate:

##### Component Addition Tests

1. **Successful Component Addition**
   - Execute action between valid actor and target
   - Verify actor receives `vampirism:biting_neck` component with correct `target_id`
   - Verify target receives `vampirism:being_bitten_in_neck` component with correct `biter_id`

2. **Component Data Validation**
   - Validate component data schemas match specifications
   - Confirm entity references are correctly populated

##### Event Generation Tests

3. **Perceptible Event Message**
   - Verify message format: `{actor} sinks their fangs in {target}'s neck carefully.`
   - Validate actual names are substituted correctly

4. **Success Action Message**
   - Verify success message matches perceptible message
   - Confirm message format consistency

5. **Event Metadata**
   - Validate `locationId` matches actor's location
   - Confirm `perceptionType` is `action_target_general`
   - Verify `actorId` and `targetId` are correct

##### Turn Management Tests

6. **Turn End Validation**
   - Confirm `core:turn_ended` event is dispatched
   - Verify turn success status is `true`
   - Validate `entityId` matches actor

##### Multiple Execution Scenarios

7. **Different Actor/Target Combinations**
   - Test with various actor and target names
   - Verify message formatting handles different name lengths
   - Confirm component references remain accurate

#### Test Structure Template

```javascript
/**
 * @file Integration tests for vampirism:bite_neck_carefully action and rule
 * @description Validates component addition, event generation, and messaging for the bite neck carefully action
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import '../../../common/mods/domainMatchers.js';
import biteNeckCarefullyRule from '../../../../data/mods/vampirism/rules/handle_bite_neck_carefully.rule.json';
import eventIsActionBiteNeckCarefully from '../../../../data/mods/vampirism/conditions/event-is-action-bite-neck-carefully.condition.json';

const ACTION_ID = 'vampirism:bite_neck_carefully';
const EXPECTED_MESSAGE_TEMPLATE =
  '{actor} sinks their fangs in {target}\'s neck carefully.';

describe('vampirism:bite_neck_carefully - Rule Execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'vampirism',
      ACTION_ID,
      biteNeckCarefullyRule,
      eventIsActionBiteNeckCarefully
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Component Addition', () => {
    it('adds biting_neck component to actor with correct target reference', async () => {
      const scenario = testFixture.createCloseActors(['Dracula', 'Jonathan'], {
        location: 'castle_hall',
      });

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const actorInstance = testFixture.entityManager.getEntityInstance(
        scenario.actor.id
      );

      expect(actorInstance).toHaveComponentData('vampirism:biting_neck', {
        target_id: scenario.target.id,
      });
    });

    it('adds being_bitten_in_neck component to target with correct biter reference', async () => {
      const scenario = testFixture.createCloseActors(['Dracula', 'Mina'], {
        location: 'bedroom',
      });

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const targetInstance = testFixture.entityManager.getEntityInstance(
        scenario.target.id
      );

      expect(targetInstance).toHaveComponentData(
        'vampirism:being_bitten_in_neck',
        {
          biter_id: scenario.actor.id,
        }
      );
    });

    it('adds both components in single action execution', async () => {
      const scenario = testFixture.createCloseActors(['Nosferatu', 'Ellen'], {
        location: 'ship_cabin',
      });

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const actorInstance = testFixture.entityManager.getEntityInstance(
        scenario.actor.id
      );
      const targetInstance = testFixture.entityManager.getEntityInstance(
        scenario.target.id
      );

      expect(actorInstance).toHaveComponent('vampirism:biting_neck');
      expect(targetInstance).toHaveComponent('vampirism:being_bitten_in_neck');
    });
  });

  describe('Event Generation', () => {
    it('generates correct perceptible event message', async () => {
      const scenario = testFixture.createCloseActors(['Vampire', 'Victim'], {
        location: 'crypt',
      });

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const expectedMessage = EXPECTED_MESSAGE_TEMPLATE.replace(
        '{actor}',
        'Vampire'
      ).replace('{target}', 'Victim');

      testFixture.assertPerceptibleEvent({
        descriptionText: expectedMessage,
        locationId: 'crypt',
        actorId: scenario.actor.id,
        targetId: scenario.target.id,
        perceptionType: 'action_target_general',
      });
    });

    it('generates matching success action message', async () => {
      const scenario = testFixture.createCloseActors(['Alucard', 'Seras'], {
        location: 'underground_chamber',
      });

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const expectedMessage = EXPECTED_MESSAGE_TEMPLATE.replace(
        '{actor}',
        'Alucard'
      ).replace('{target}', 'Seras');

      testFixture.assertActionSuccess(expectedMessage);
    });

    it('includes correct event metadata', async () => {
      const scenario = testFixture.createCloseActors(['Lestat', 'Louis'], {
        location: 'theatre',
      });

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      testFixture.assertPerceptibleEvent({
        locationId: 'theatre',
        actorId: scenario.actor.id,
        targetId: scenario.target.id,
        perceptionType: 'action_target_general',
      });
    });

    it('generates consistent perceptible and success messages', async () => {
      const scenario = testFixture.createCloseActors(['Count', 'Victim'], {
        location: 'tower',
      });

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const expectedMessage = EXPECTED_MESSAGE_TEMPLATE.replace(
        '{actor}',
        'Count'
      ).replace('{target}', 'Victim');

      testFixture.assertActionSuccess(expectedMessage);
      testFixture.assertPerceptibleEvent({
        descriptionText: expectedMessage,
        perceptionType: 'action_target_general',
        locationId: 'tower',
        actorId: scenario.actor.id,
        targetId: scenario.target.id,
      });
    });
  });

  describe('Turn Management', () => {
    it('ends turn with success status', async () => {
      const scenario = testFixture.createCloseActors(['Vampire', 'Human'], {
        location: 'dungeon',
      });

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const turnEndedEvent = testFixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );

      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.entityId).toBe(scenario.actor.id);
      expect(turnEndedEvent.payload.success).toBe(true);
    });
  });

  describe('Multiple Execution Scenarios', () => {
    it('handles different actor and target names correctly', async () => {
      const scenarios = [
        { actor: 'Count Orlok', target: 'Ellen Hutter', location: 'ship' },
        { actor: 'Carmilla', target: 'Laura', location: 'castle' },
        { actor: 'Varney', target: 'Flora', location: 'manor' },
      ];

      for (const { actor, target, location } of scenarios) {
        const scenario = testFixture.createCloseActors([actor, target], {
          location,
        });

        await testFixture.executeAction(scenario.actor.id, scenario.target.id);

        const expectedMessage = EXPECTED_MESSAGE_TEMPLATE.replace(
          '{actor}',
          actor
        ).replace('{target}', target);

        testFixture.assertActionSuccess(expectedMessage);

        // Reset for next iteration
        testFixture.clearEvents();
      }
    });

    it('maintains component integrity across multiple executions', async () => {
      const scenario1 = testFixture.createCloseActors(['V1', 'T1'], {
        location: 'loc1',
      });

      await testFixture.executeAction(scenario1.actor.id, scenario1.target.id);

      const actor1 = testFixture.entityManager.getEntityInstance(
        scenario1.actor.id
      );
      const target1 = testFixture.entityManager.getEntityInstance(
        scenario1.target.id
      );

      expect(actor1).toHaveComponentData('vampirism:biting_neck', {
        target_id: scenario1.target.id,
      });
      expect(target1).toHaveComponentData('vampirism:being_bitten_in_neck', {
        biter_id: scenario1.actor.id,
      });
    });
  });

  describe('Rule Isolation', () => {
    it('does not fire for different actions', async () => {
      const scenario = testFixture.createCloseActors(['Vampire', 'Mortal'], {
        location: 'cemetery',
      });

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
});
```

---

## 6. Implementation Checklist

### File Creation

- [ ] `data/mods/vampirism/actions/bite_neck_carefully.action.json`
- [ ] `data/mods/vampirism/components/biting_neck.component.json`
- [ ] `data/mods/vampirism/components/being_bitten_in_neck.component.json`
- [ ] `data/mods/vampirism/rules/handle_bite_neck_carefully.rule.json`
- [ ] `data/mods/vampirism/conditions/event-is-action-bite-neck-carefully.condition.json`

### Test Creation

- [ ] `tests/integration/mods/vampirism/bite_neck_carefully_action_discovery.test.js`
- [ ] `tests/integration/mods/vampirism/bite_neck_carefully_action.test.js`

### Validation

- [ ] Run action discovery tests: `npm run test:integration -- bite_neck_carefully_action_discovery.test.js`
- [ ] Run rule execution tests: `npm run test:integration -- bite_neck_carefully_action.test.js`
- [ ] Validate JSON schemas with project validators
- [ ] Run full vampirism mod test suite
- [ ] Manual gameplay testing for edge cases

### Documentation

- [ ] Update `data/mods/vampirism/mod-manifest.json` with new action reference
- [ ] Verify action appears in available actions during gameplay
- [ ] Test discovery under all specified conditions

---

## 7. References

### Existing Implementation Patterns

- **Action Structure**: `data/mods/vampirism/actions/bare_fangs.action.json`
- **Component Addition**: `data/mods/hugging/rules/handle_hug_tight.rule.json`
- **Test Patterns**: `tests/integration/mods/vampirism/bare_fangs_action.test.js`
- **Discovery Testing**: `tests/integration/mods/hugging/hug_tight_action.test.js`

### Testing Documentation

- **Mod Testing Guide**: `docs/testing/mod-testing-guide.md`
- **Action Discovery Toolkit**: `docs/testing/action-discovery-testing-toolkit.md`
- **Test Migration Guide**: `docs/testing/MODTESTROB-009-migration-guide.md`

### Engine Documentation

- **Action Schema**: `data/schemas/action.schema.json`
- **Component Schema**: `data/schemas/component.schema.json`
- **Rule Schema**: `data/schemas/rule.schema.json`
- **Condition Schema**: `data/schemas/condition.schema.json`

---

## 8. Notes and Considerations

### Design Rationale

1. **Closeness Requirement**: Ensures actors must establish proximity before biting, preventing unrealistic long-distance actions

2. **Mutual Exclusivity**:
   - `biting_neck` forbidden on actor prevents biting multiple targets
   - `being_bitten_in_neck` forbidden on target prevents multiple vampires biting same target
   - `giving_blowjob` forbidden ensures mouth is available for biting

3. **Visual Consistency**: Matches `bare_fangs` action to maintain mod aesthetic coherence

4. **Message Clarity**: "carefully" modifier distinguishes from aggressive bite variants (if implemented later)

### Future Enhancements

- **Release Bite Action**: Counterpart action to remove components (similar to `release_hug`)
- **Blood Feeding Mechanics**: Additional rules to track feeding progress
- **Target Consent**: Optional consent mechanism for consensual vampire scenarios
- **Multiple Bite Locations**: Expand to wrist, shoulder, etc.

### Testing Strategy

The test suite follows the modern fixture pattern established in the mod testing guide:

- **Discovery Tests**: Use `createActionDiscoveryBed()` for lightweight discovery validation
- **Execution Tests**: Use `ModTestFixture.forAction()` for full integration testing
- **Component Validation**: Leverage `toHaveComponent()` and `toHaveComponentData()` matchers
- **Event Validation**: Use `assertPerceptibleEvent()` and `assertActionSuccess()` helpers

---

## Appendix A: Component Relationship Diagram

```
┌─────────────────────────┐
│   Actor (Vampire)       │
│  + vampirism:biting_neck│◄──────────┐
│    - target_id          │           │
└─────────────────────────┘           │
                                      │
                                      │ Bidirectional
                                      │ Component
                                      │ Reference
                                      │
┌─────────────────────────────────────┴───┐
│   Target (Victim)                       │
│  + vampirism:being_bitten_in_neck       │
│    - biter_id                           │
└─────────────────────────────────────────┘
```

---

## Appendix B: Scope Resolution Flow

```
Action Discovery Request
        ↓
positioning:close_actors_facing_each_other_or_behind_target
        ↓
Resolve actor.components.positioning:closeness.partners[]
        ↓
Apply Filters:
  - Both facing each other OR actor behind target
  - NOT entity kneeling before actor
  - NOT actor kneeling before entity
        ↓
For each potential target:
  - Check actor required components: positioning:closeness
  - Check actor forbidden components: biting_neck, giving_blowjob
  - Check target forbidden components: being_bitten_in_neck
        ↓
Return discovered actions
```

---

**End of Specification**
