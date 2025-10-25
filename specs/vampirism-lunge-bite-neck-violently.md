# Vampirism Mod: "Lunge and Bite Neck Violently" Action Specification

## Overview

### Feature Description
This specification defines a new predatory vampire attack action for the vampirism mod. Unlike the careful, intimate `bite_neck_carefully` action which requires closeness, this action represents a violent, predatory lunge attack that can be performed on any actor in the same location, regardless of distance.

### Key Differentiator
- **`bite_neck_carefully`**: Requires `positioning:close_actors_facing_each_other_or_behind_target` scope (intimate feeding)
- **`lunge_bite_neck_violently`**: Uses `core:actors_in_location` scope (distance attack, no closeness required)

### Files to Create

1. **Action Definition**: `data/mods/vampirism/actions/lunge_bite_neck_violently.action.json`
2. **Rule Definition**: `data/mods/vampirism/rules/handle_lunge_bite_neck_violently.rule.json`
3. **Condition Definition**: `data/mods/vampirism/conditions/event-is-action-lunge-bite-neck-violently.condition.json`
4. **Discovery Test**: `tests/integration/mods/vampirism/lunge_bite_neck_violently_action_discovery.test.js`
5. **Rule Test**: `tests/integration/mods/vampirism/lunge_bite_neck_violently_action.test.js`

---

## Action Definition Specification

### File: `data/mods/vampirism/actions/lunge_bite_neck_violently.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "vampirism:lunge_bite_neck_violently",
  "name": "Lunge and Bite Neck Violently",
  "description": "Lunge at a target across the room and sink your fangs into their neck predatorily",
  "targets": "core:actors_in_location",
  "required_components": {
    "actor": ["vampirism:is_vampire"]
  },
  "forbidden_components": {
    "actor": ["positioning:biting_neck", "positioning:giving_blowjob"],
    "primary": ["positioning:being_bitten_in_neck"]
  },
  "template": "bite {target}'s neck violently",
  "visual": {
    "backgroundColor": "#6c0f36",
    "textColor": "#ffe6ef",
    "hoverBackgroundColor": "#861445",
    "hoverTextColor": "#fff2f7"
  }
}
```

### Field Descriptions

| Field | Value | Rationale |
|-------|-------|-----------|
| `id` | `vampirism:lunge_bite_neck_violently` | Namespaced identifier following mod conventions |
| `name` | "Lunge and Bite Neck Violently" | Descriptive name emphasizing violent nature |
| `description` | Describes predatory lunge | Explains distance attack capability |
| `targets` | `core:actors_in_location` | **Key differentiator** - no closeness requirement |
| `required_components.actor` | `vampirism:is_vampire` | Only vampires can perform this action |
| `forbidden_components.actor` | `positioning:biting_neck`, `positioning:giving_blowjob` | Prevent simultaneous conflicting actions |
| `forbidden_components.primary` | `positioning:being_bitten_in_neck` | Target cannot already be bitten |
| `template` | `bite {target}'s neck violently` | User-facing action text emphasizing violence |
| `visual` | Dark red/pink theme | Consistent with other vampirism actions (refs: `bare_fangs.action.json:14-19`, `bite_neck_carefully.action.json:15-20`) |

---

## Condition Definition Specification

### File: `data/mods/vampirism/conditions/event-is-action-lunge-bite-neck-violently.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "vampirism:event-is-action-lunge-bite-neck-violently",
  "description": "Matches events where the action is 'vampirism:lunge_bite_neck_violently'",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "vampirism:lunge_bite_neck_violently"
    ]
  }
}
```

### Pattern Reference
This follows the exact pattern from `event-is-action-bite-neck-carefully.condition.json:1-11`.

---

## Rule Definition Specification

### File: `data/mods/vampirism/rules/handle_lunge_bite_neck_violently.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_lunge_bite_neck_violently",
  "comment": "Handles the 'vampirism:lunge_bite_neck_violently' action. Adds biting components to actor and target, dispatches descriptive perceptible event with predatory message, and ends turn.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "vampirism:event-is-action-lunge-bite-neck-violently"
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
        "component_type": "positioning:biting_neck",
        "value": {
          "bitten_entity_id": "{event.payload.targetId}",
          "initiated": true
        }
      }
    },
    {
      "type": "ADD_COMPONENT",
      "parameters": {
        "entity_ref": "target",
        "component_type": "positioning:being_bitten_in_neck",
        "value": {
          "biting_entity_id": "{event.payload.actorId}"
        }
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} lunges at {context.targetName} and sinks their teeth on {context.targetName}'s neck predatorily."
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

### Rule Structure Analysis

This rule follows the exact pattern from `handle_bite_neck_carefully.rule.json:1-77` with the following key differences:

1. **Rule ID**: `handle_lunge_bite_neck_violently` (line 2)
2. **Condition Reference**: `vampirism:event-is-action-lunge-bite-neck-violently` (line 6)
3. **Log Message**: Changed to emphasize predatory nature (line 48)
   - **Careful**: `"{context.actorName} sinks their fangs in {context.targetName}'s neck carefully."`
   - **Violent**: `"{context.actorName} lunges at {context.targetName} and sinks their teeth on {context.targetName}'s neck predatorily."`

All other operations remain identical to ensure consistent component management and event dispatching.

---

## Test Suite Specifications

### Test Suite 1: Action Discovery Tests

#### File: `tests/integration/mods/vampirism/lunge_bite_neck_violently_action_discovery.test.js`

#### Purpose
Validate that the action is correctly discovered under appropriate conditions and blocked when requirements are not met.

#### Test Structure

```javascript
/**
 * @file Action discovery tests for vampirism:lunge_bite_neck_violently
 * @description Validates action availability for distance vampire attacks (no closeness required)
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { createActionDiscoveryBed } from '../../../common/actions/actionDiscoveryServiceTestBed.js';
import '../../../common/actionMatchers.js';
import lungeBiteNeckViolentlyAction from '../../../../data/mods/vampirism/actions/lunge_bite_neck_violently.action.json';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';

const ACTION_ID = 'vampirism:lunge_bite_neck_violently';

describe('vampirism:lunge_bite_neck_violently - Action Discovery', () => {
  let testBed;

  beforeEach(() => {
    testBed = createActionDiscoveryBed();

    // Use SimpleEntityManager for integration tests
    const simpleEntityManager = new SimpleEntityManager();
    testBed.mocks.entityManager = simpleEntityManager;
    testBed.entityManager = simpleEntityManager;
    if (testBed.service) {
      testBed.service.entityManager = simpleEntityManager;
    }

    // Mock action index to return our action
    testBed.mocks.actionIndex.getCandidateActions.mockImplementation(() => [
      lungeBiteNeckViolentlyAction,
    ]);

    // Mock target resolution service
    testBed.mocks.targetResolutionService.resolveTargets.mockImplementation(
      (_scopeName, actorEntity) => {
        // Check actor required components first
        const actorRequired = lungeBiteNeckViolentlyAction.required_components?.actor ?? [];
        for (const comp of actorRequired) {
          if (!actorEntity.components?.[comp]) {
            return ActionResult.success([]);
          }
        }

        // Check actor forbidden components
        const actorForbidden = lungeBiteNeckViolentlyAction.forbidden_components?.actor ?? [];
        for (const comp of actorForbidden) {
          if (actorEntity.components?.[comp]) {
            return ActionResult.success([]);
          }
        }

        // Get all actors in same location (NO closeness requirement)
        const entityManager = testBed.mocks.entityManager;
        const getEntity = entityManager.getEntityInstance
          ? entityManager.getEntityInstance.bind(entityManager)
          : entityManager.getEntity.bind(entityManager);

        const actorPosition = actorEntity.components?.['core:position'];
        if (!actorPosition?.locationId) {
          return ActionResult.success([]);
        }

        const allEntities = Array.from(entityManager.entities.values());
        const validTargets = allEntities.reduce((acc, targetEntity) => {
          if (targetEntity.id === actorEntity.id) {
            return acc; // Skip self
          }

          const targetPosition = targetEntity.components?.['core:position'];
          if (targetPosition?.locationId !== actorPosition.locationId) {
            return acc; // Different location
          }

          // Check target forbidden components
          const targetForbidden = lungeBiteNeckViolentlyAction.forbidden_components?.primary ?? [];
          for (const comp of targetForbidden) {
            if (targetEntity.components?.[comp]) {
              return acc;
            }
          }

          acc.add(targetEntity.id);
          return acc;
        }, new Set());

        return ActionResult.success(Array.from(validTargets));
      }
    );
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Positive Discovery Cases', () => {
    it('discovers action when vampire and target are in same location without closeness', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        closeProximity: false, // Key: NO closeness required
      });

      // Add vampire marker to actor
      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'vampirism:is_vampire',
        {}
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).toHaveAction(ACTION_ID);
    });

    it('discovers action when vampire and multiple targets are in same location', async () => {
      const actor = testBed.createActorWithValidation('vampire1', {
        name: 'Predator',
      });
      const target1 = testBed.createActorWithValidation('victim1', {
        name: 'Victim 1',
      });
      const target2 = testBed.createActorWithValidation('victim2', {
        name: 'Victim 2',
      });

      // Place all in same location, no closeness
      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'core:position',
        { locationId: 'dark_alley' }
      );
      await testBed.mocks.entityManager.addComponent(
        target1.id,
        'core:position',
        { locationId: 'dark_alley' }
      );
      await testBed.mocks.entityManager.addComponent(
        target2.id,
        'core:position',
        { locationId: 'dark_alley' }
      );

      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'vampirism:is_vampire',
        {}
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).toHaveAction(ACTION_ID);
    });

    it('discovers action even when actors are at opposite ends of location', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        closeProximity: false,
      });

      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'vampirism:is_vampire',
        {}
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).toHaveAction(ACTION_ID);
    });
  });

  describe('Negative Discovery Cases', () => {
    it('does not discover when actor is not a vampire', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        closeProximity: false,
      });

      // Actor has target in location but NOT vampirism:is_vampire
      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).not.toHaveAction(ACTION_ID);
    });

    it('does not discover when vampire actor already has biting_neck component', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        closeProximity: false,
      });

      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'vampirism:is_vampire',
        {}
      );
      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'positioning:biting_neck',
        { bitten_entity_id: 'other_entity', initiated: true }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).not.toHaveAction(ACTION_ID);
    });

    it('does not discover when vampire actor has giving_blowjob component', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        closeProximity: false,
      });

      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'vampirism:is_vampire',
        {}
      );
      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'positioning:giving_blowjob',
        { target_id: target.id }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).not.toHaveAction(ACTION_ID);
    });

    it('does not discover when target has being_bitten_in_neck component', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        closeProximity: false,
      });

      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'vampirism:is_vampire',
        {}
      );
      await testBed.mocks.entityManager.addComponent(
        target.id,
        'positioning:being_bitten_in_neck',
        { biting_entity_id: 'other_vampire' }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).not.toHaveAction(ACTION_ID);
    });

    it('does not discover when no other actors in location', async () => {
      const actor = testBed.createActorWithValidation('lone_vampire', {
        name: 'Lone Vampire',
      });

      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'vampirism:is_vampire',
        {}
      );
      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'core:position',
        { locationId: 'empty_room' }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).not.toHaveAction(ACTION_ID);
    });

    it('does not discover when actors in different locations', async () => {
      const actor = testBed.createActorWithValidation('vampire1', {
        name: 'Vampire',
      });
      const target = testBed.createActorWithValidation('victim1', {
        name: 'Victim',
      });

      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'vampirism:is_vampire',
        {}
      );
      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'core:position',
        { locationId: 'room_a' }
      );
      await testBed.mocks.entityManager.addComponent(
        target.id,
        'core:position',
        { locationId: 'room_b' }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).not.toHaveAction(ACTION_ID);
    });
  });

  describe('Discovery Diagnostics', () => {
    it('provides diagnostic information when discovery fails', async () => {
      const actor = testBed.createActorWithValidation('actor1', {
        name: 'Non-Vampire',
      });

      const { diagnostics } = await testBed.discoverActionsWithDiagnostics(
        actor,
        { includeDiagnostics: true }
      );

      expect(diagnostics).toBeDefined();
    });
  });
});
```

#### Key Test Patterns (refs: `bite_neck_carefully_action_discovery.test.js`)

1. **Setup** (lines 18-110): Use `createActionDiscoveryBed()` with `SimpleEntityManager`
2. **Target Resolution Mock** (lines 34-109): Returns actors in same location (NO closeness check)
3. **Positive Cases** (lines 116-153): Verify distance attack capability
4. **Negative Cases** (lines 155-299): Test all forbidden component combinations
5. **Cleanup** (lines 112-114): Always cleanup in `afterEach`

---

### Test Suite 2: Rule Execution Tests

#### File: `tests/integration/mods/vampirism/lunge_bite_neck_violently_action.test.js`

#### Purpose
Validate that the rule correctly adds components, generates events, and manages turn state.

#### Test Structure

```javascript
/**
 * @file Integration tests for vampirism:lunge_bite_neck_violently action and rule
 * @description Validates component addition, event generation, and messaging for the violent lunge bite action
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import '../../../common/mods/domainMatchers.js';
import lungeBiteNeckViolentlyRule from '../../../../data/mods/vampirism/rules/handle_lunge_bite_neck_violently.rule.json';
import eventIsActionLungeBiteNeckViolently from '../../../../data/mods/vampirism/conditions/event-is-action-lunge-bite-neck-violently.condition.json';

const ACTION_ID = 'vampirism:lunge_bite_neck_violently';
const EXPECTED_MESSAGE_TEMPLATE =
  '{actor} lunges at {target} and sinks their teeth on {target}\'s neck predatorily.';

describe('vampirism:lunge_bite_neck_violently - Rule Execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'vampirism',
      ACTION_ID,
      lungeBiteNeckViolentlyRule,
      eventIsActionLungeBiteNeckViolently
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Component Addition', () => {
    it('adds biting_neck component to vampire actor with correct target reference', async () => {
      const scenario = testFixture.createActorsInLocation(
        ['Nosferatu', 'Ellen'],
        { location: 'ship_deck' }
      );

      // Add vampire marker to actor
      scenario.actors[0].components['vampirism:is_vampire'] = {};
      testFixture.reset([scenario.room, ...scenario.actors]);

      await testFixture.executeAction(
        scenario.actors[0].id,
        scenario.actors[1].id
      );

      const actorInstance = testFixture.entityManager.getEntityInstance(
        scenario.actors[0].id
      );

      expect(actorInstance).toHaveComponentData('positioning:biting_neck', {
        bitten_entity_id: scenario.actors[1].id,
        initiated: true,
      });
    });

    it('adds being_bitten_in_neck component to target with correct vampire reference', async () => {
      const scenario = testFixture.createActorsInLocation(
        ['Vampire', 'Victim'],
        { location: 'dark_alley' }
      );

      scenario.actors[0].components['vampirism:is_vampire'] = {};
      testFixture.reset([scenario.room, ...scenario.actors]);

      await testFixture.executeAction(
        scenario.actors[0].id,
        scenario.actors[1].id
      );

      const targetInstance = testFixture.entityManager.getEntityInstance(
        scenario.actors[1].id
      );

      expect(targetInstance).toHaveComponentData(
        'positioning:being_bitten_in_neck',
        {
          biting_entity_id: scenario.actors[0].id,
        }
      );
    });

    it('adds both components in single predatory attack execution', async () => {
      const scenario = testFixture.createActorsInLocation(
        ['Predator', 'Prey'],
        { location: 'forest_clearing' }
      );

      scenario.actors[0].components['vampirism:is_vampire'] = {};
      testFixture.reset([scenario.room, ...scenario.actors]);

      await testFixture.executeAction(
        scenario.actors[0].id,
        scenario.actors[1].id
      );

      const actorInstance = testFixture.entityManager.getEntityInstance(
        scenario.actors[0].id
      );
      const targetInstance = testFixture.entityManager.getEntityInstance(
        scenario.actors[1].id
      );

      expect(actorInstance).toHaveComponent('positioning:biting_neck');
      expect(targetInstance).toHaveComponent('positioning:being_bitten_in_neck');
    });

    it('rejects the action when actor is not a vampire', async () => {
      const scenario = testFixture.createActorsInLocation(
        ['Human', 'Mortal'],
        { location: 'village_square' }
      );

      await expect(
        testFixture.executeAction(scenario.actors[0].id, scenario.actors[1].id)
      ).rejects.toThrow(/required component/i);
    });
  });

  describe('Event Generation', () => {
    it('generates correct perceptible event message with predatory language', async () => {
      const scenario = testFixture.createActorsInLocation(
        ['Dracula', 'Jonathan'],
        { location: 'castle_hall' }
      );

      scenario.actors[0].components['vampirism:is_vampire'] = {};
      testFixture.reset([scenario.room, ...scenario.actors]);

      await testFixture.executeAction(
        scenario.actors[0].id,
        scenario.actors[1].id
      );

      const expectedMessage = EXPECTED_MESSAGE_TEMPLATE.replace(
        '{actor}',
        'Dracula'
      ).replace(/{target}/g, 'Jonathan');

      testFixture.assertPerceptibleEvent({
        descriptionText: expectedMessage,
        locationId: 'castle_hall',
        actorId: scenario.actors[0].id,
        targetId: scenario.actors[1].id,
        perceptionType: 'action_target_general',
      });
    });

    it('generates matching success action message with predatory language', async () => {
      const scenario = testFixture.createActorsInLocation(
        ['Lestat', 'Louis'],
        { location: 'theatre_box' }
      );

      scenario.actors[0].components['vampirism:is_vampire'] = {};
      testFixture.reset([scenario.room, ...scenario.actors]);

      await testFixture.executeAction(
        scenario.actors[0].id,
        scenario.actors[1].id
      );

      const expectedMessage = EXPECTED_MESSAGE_TEMPLATE.replace(
        '{actor}',
        'Lestat'
      ).replace(/{target}/g, 'Louis');

      testFixture.assertActionSuccess(expectedMessage);
    });

    it('includes correct event metadata for predatory bite', async () => {
      const scenario = testFixture.createActorsInLocation(
        ['Vampire', 'Mortal'],
        { location: 'crypt' }
      );

      scenario.actors[0].components['vampirism:is_vampire'] = {};
      testFixture.reset([scenario.room, ...scenario.actors]);

      await testFixture.executeAction(
        scenario.actors[0].id,
        scenario.actors[1].id
      );

      const expectedMessage = EXPECTED_MESSAGE_TEMPLATE.replace(
        '{actor}',
        'Vampire'
      ).replace(/{target}/g, 'Mortal');

      testFixture.assertPerceptibleEvent({
        descriptionText: expectedMessage,
        locationId: 'crypt',
        actorId: scenario.actors[0].id,
        targetId: scenario.actors[1].id,
        perceptionType: 'action_target_general',
      });
    });

    it('generates consistent perceptible and success messages for violent attack', async () => {
      const scenario = testFixture.createActorsInLocation(
        ['Predator', 'Victim'],
        { location: 'abandoned_warehouse' }
      );

      scenario.actors[0].components['vampirism:is_vampire'] = {};
      testFixture.reset([scenario.room, ...scenario.actors]);

      await testFixture.executeAction(
        scenario.actors[0].id,
        scenario.actors[1].id
      );

      const expectedMessage = EXPECTED_MESSAGE_TEMPLATE.replace(
        '{actor}',
        'Predator'
      ).replace(/{target}/g, 'Victim');

      testFixture.assertActionSuccess(expectedMessage);
      testFixture.assertPerceptibleEvent({
        descriptionText: expectedMessage,
        perceptionType: 'action_target_general',
        locationId: 'abandoned_warehouse',
        actorId: scenario.actors[0].id,
        targetId: scenario.actors[1].id,
      });
    });
  });

  describe('Turn Management', () => {
    it('ends turn with success status for violent vampire attack', async () => {
      const scenario = testFixture.createActorsInLocation(
        ['Vampire', 'Human'],
        { location: 'dungeon' }
      );

      scenario.actors[0].components['vampirism:is_vampire'] = {};
      testFixture.reset([scenario.room, ...scenario.actors]);

      await testFixture.executeAction(
        scenario.actors[0].id,
        scenario.actors[1].id
      );

      const turnEndedEvent = testFixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );

      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.entityId).toBe(scenario.actors[0].id);
      expect(turnEndedEvent.payload.success).toBe(true);
    });
  });

  describe('Multiple Execution Scenarios', () => {
    it('handles different vampire actor and target names correctly', async () => {
      const scenarios = [
        { actors: ['Count Orlok', 'Ellen'], location: 'ship_hold' },
        { actors: ['Carmilla', 'Laura'], location: 'castle_tower' },
        { actors: ['Varney', 'Flora'], location: 'manor_hallway' },
      ];

      for (const { actors, location } of scenarios) {
        const scenario = testFixture.createActorsInLocation(actors, {
          location,
        });

        scenario.actors[0].components['vampirism:is_vampire'] = {};
        testFixture.reset([scenario.room, ...scenario.actors]);

        await testFixture.executeAction(
          scenario.actors[0].id,
          scenario.actors[1].id
        );

        const expectedMessage = EXPECTED_MESSAGE_TEMPLATE.replace(
          '{actor}',
          actors[0]
        ).replace(/{target}/g, actors[1]);

        testFixture.assertActionSuccess(expectedMessage);

        testFixture.clearEvents();
      }
    });

    it('maintains component integrity across multiple predatory executions', async () => {
      const scenario1 = testFixture.createActorsInLocation(['V1', 'T1'], {
        location: 'loc1',
      });

      scenario1.actors[0].components['vampirism:is_vampire'] = {};
      testFixture.reset([scenario1.room, ...scenario1.actors]);

      await testFixture.executeAction(
        scenario1.actors[0].id,
        scenario1.actors[1].id
      );

      const actor1 = testFixture.entityManager.getEntityInstance(
        scenario1.actors[0].id
      );
      const target1 = testFixture.entityManager.getEntityInstance(
        scenario1.actors[1].id
      );

      expect(actor1).toHaveComponentData('positioning:biting_neck', {
        bitten_entity_id: scenario1.actors[1].id,
        initiated: true,
      });
      expect(target1).toHaveComponentData('positioning:being_bitten_in_neck', {
        biting_entity_id: scenario1.actors[0].id,
      });
    });
  });

  describe('Rule Isolation', () => {
    it('does not fire for different actions', async () => {
      const scenario = testFixture.createActorsInLocation(
        ['Vampire', 'Mortal'],
        { location: 'cemetery' }
      );

      const payload = {
        eventName: 'core:attempt_action',
        actorId: scenario.actors[0].id,
        actionId: 'core:wait',
        originalInput: 'wait',
      };

      await testFixture.eventBus.dispatch('core:attempt_action', payload);

      testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
    });
  });
});
```

#### Key Test Patterns (refs: `bite_neck_carefully_action.test.js`)

1. **Setup** (lines 19-30): Use `ModTestFixture.forAction()` with explicit rule/condition
2. **Scenario Creation**: Use `createActorsInLocation()` for non-close actors (distance attack)
3. **Component Validation** (lines 33-109): Use `toHaveComponentData` matcher
4. **Event Validation** (lines 111-206): Use `assertPerceptibleEvent` and `assertActionSuccess`
5. **Turn Management** (lines 208-228): Verify turn ending behavior
6. **Cleanup** (lines 28-30): Always cleanup in `afterEach`

**Note**: The key difference from `bite_neck_carefully_action.test.js` is using `createActorsInLocation()` instead of `createCloseActors()` to reflect the distance attack nature.

---

## Implementation Checklist

### Content Files
- [ ] Create `data/mods/vampirism/actions/lunge_bite_neck_violently.action.json`
  - [ ] Verify `targets: "core:actors_in_location"` (no closeness)
  - [ ] Verify visual scheme matches existing vampirism actions
  - [ ] Verify template is `bite {target}'s neck violently`
- [ ] Create `data/mods/vampirism/conditions/event-is-action-lunge-bite-neck-violently.condition.json`
  - [ ] Verify JSON Logic matches action ID exactly
- [ ] Create `data/mods/vampirism/rules/handle_lunge_bite_neck_violently.rule.json`
  - [ ] Verify message is predatory: "lunges at ... sinks their teeth ... predatorily"
  - [ ] Verify component operations match `handle_bite_neck_carefully` pattern
  - [ ] Verify condition reference is correct

### Test Files
- [ ] Create `tests/integration/mods/vampirism/lunge_bite_neck_violently_action_discovery.test.js`
  - [ ] Import `createActionDiscoveryBed` and `SimpleEntityManager`
  - [ ] Import `../../../common/actionMatchers.js`
  - [ ] Mock target resolution to return actors in same location (NO closeness check)
  - [ ] Test positive case: vampire with actors in location
  - [ ] Test negative cases: not vampire, forbidden components, different locations
  - [ ] Include diagnostics test
  - [ ] Cleanup in `afterEach`
- [ ] Create `tests/integration/mods/vampirism/lunge_bite_neck_violently_action.test.js`
  - [ ] Import `ModTestFixture` and domain matchers
  - [ ] Use `forAction()` with explicit rule/condition JSON
  - [ ] Use `createActorsInLocation()` for scenarios (not `createCloseActors`)
  - [ ] Test component addition with `toHaveComponentData`
  - [ ] Test event generation with predatory message
  - [ ] Test turn management
  - [ ] Test rule isolation
  - [ ] Cleanup in `afterEach`

### Validation
- [ ] Run action discovery tests: `NODE_ENV=test npx jest tests/integration/mods/vampirism/lunge_bite_neck_violently_action_discovery.test.js --no-coverage --silent`
- [ ] Run rule execution tests: `NODE_ENV=test npx jest tests/integration/mods/vampirism/lunge_bite_neck_violently_action.test.js --no-coverage --silent`
- [ ] Verify all tests pass
- [ ] Run ESLint on modified files: `npx eslint data/mods/vampirism/ tests/integration/mods/vampirism/lunge_bite_neck_violently*.test.js`
- [ ] Verify JSON schemas validate correctly

---

## Key Differences from "Bite Neck Carefully"

| Aspect | Bite Neck Carefully | Lunge Bite Neck Violently |
|--------|---------------------|---------------------------|
| **Scope** | `positioning:close_actors_facing_each_other_or_behind_target` | `core:actors_in_location` |
| **Closeness** | Required | NOT required |
| **Range** | Intimate (touching) | Distance (across room) |
| **Message** | "sinks their fangs in ... carefully" | "lunges at ... sinks their teeth ... predatorily" |
| **Tone** | Careful, intimate | Violent, predatory |
| **Use Case** | Feeding from willing/close victim | Surprise attack from distance |

---

## Testing Strategy Summary

### Test Coverage Goals
- **Discovery Tests**: 100% coverage of positive and negative discovery scenarios
- **Rule Tests**: 100% coverage of component addition, event generation, turn management

### Pattern Adherence
- **Fixture Pattern**: Use `ModTestFixture.forAction()` (refs: `bite_neck_carefully_action.test.js:19-25`)
- **Discovery Pattern**: Use `createActionDiscoveryBed()` (refs: `bite_neck_carefully_action_discovery.test.js:18-24`)
- **Matcher Pattern**: Use domain matchers from `../../common/mods/domainMatchers.js` and `../../common/actionMatchers.js`
- **Cleanup Pattern**: Always cleanup in `afterEach` (refs: Mod Testing Guide:172-174)

### Key Test Scenarios

#### Discovery Tests
1. ✅ Discovers when vampire + actors in location (NO closeness)
2. ✅ Discovers with multiple potential targets
3. ❌ Blocks when not vampire
4. ❌ Blocks when forbidden components present
5. ❌ Blocks when no actors in location
6. ❌ Blocks when actors in different locations

#### Rule Tests
1. ✅ Adds `positioning:biting_neck` to actor
2. ✅ Adds `positioning:being_bitten_in_neck` to target
3. ✅ Generates predatory perceptible event message
4. ✅ Generates predatory success message
5. ✅ Ends turn successfully
6. ✅ Rejects when actor not vampire
7. ✅ Does not fire for different actions

---

## Implementation Notes

### Design Rationale

1. **Distance Attack**: The `core:actors_in_location` scope enables vampire to attack any actor in the same location without requiring prior positioning or closeness. This represents a sudden, predatory lunge.

2. **Same Components as Careful Bite**: Both actions use the same component types (`positioning:biting_neck` and `positioning:being_bitten_in_neck`) because the mechanical outcome is the same - one actor is biting another's neck. The difference is in how the action is initiated (distance vs. closeness).

3. **Message Differentiation**: The message emphasizes the violent, predatory nature ("lunges at ... sinks their teeth ... predatorily") to distinguish from the careful, intimate feeding action.

4. **Visual Consistency**: Using the same visual scheme as other vampirism actions maintains mod cohesion and user recognition.

### Testing Philosophy

Following the Mod Testing Guide (refs: `mod-testing-guide.md:1-347`):
- Use modern fixture patterns (no deprecated helpers)
- Import and use domain matchers for readable assertions
- Always cleanup in `afterEach` blocks
- Test both positive and negative scenarios
- Validate event generation and component state
- Ensure rule isolation (doesn't fire for other actions)

### Development Workflow

1. Create content files (action, rule, condition)
2. Create test files (discovery and execution)
3. Run tests to verify implementation
4. Run ESLint to ensure code quality
5. Validate JSON schemas

---

## References

### Code References
- `data/mods/vampirism/actions/bare_fangs.action.json:14-19` - Visual scheme
- `data/mods/vampirism/actions/bite_neck_carefully.action.json:1-21` - Action structure pattern
- `data/mods/vampirism/rules/handle_bite_neck_carefully.rule.json:1-77` - Rule structure pattern
- `data/mods/vampirism/conditions/event-is-action-bite-neck-carefully.condition.json:1-11` - Condition pattern
- `tests/integration/mods/vampirism/bite_neck_carefully_action_discovery.test.js:1-316` - Discovery test pattern
- `tests/integration/mods/vampirism/bite_neck_carefully_action.test.js:1-307` - Rule test pattern

### Documentation References
- `docs/testing/mod-testing-guide.md` - Comprehensive mod testing patterns and best practices
- `CLAUDE.md` - Project structure and conventions

---

## Conclusion

This specification provides a complete blueprint for implementing the "Lunge and Bite Neck Violently" action in the vampirism mod. The key innovation is the distance attack capability (no closeness required), which differentiates it from the intimate "Bite Neck Carefully" action while maintaining mechanical consistency through shared component types.

The comprehensive test suites ensure robust validation of both action discovery and rule execution, following established patterns from the existing vampirism mod tests.
