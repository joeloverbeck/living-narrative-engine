# Lift Onto Lap (Facing Away) Action Specification

## Overview

Introduce a new positioning action that allows an actor to lift a close sitting target onto their lap in a **facing away orientation**. This action represents an **active, initiated lift** by the actor where the target ends up facing away from the actor, distinct from both:
- The existing `lift_onto_lap_face_to_face` action (same lift mechanics, different orientation)
- The existing voluntary `sit_on_lap_from_sitting_facing_away` action (target moves themselves, not lifted)

## Reference Patterns and Constraints

### Primary References

- **Lift mechanics pattern** – Use `positioning:lift_onto_lap_face_to_face` as the baseline for understanding which entity's components are modified (PRIMARY, not actor).【F:data/mods/positioning/actions/lift_onto_lap_face_to_face.action.json†L1-L35】【F:data/mods/positioning/rules/handle_lift_onto_lap_face_to_face.rule.json†L1-L91】
- **Facing away orientation pattern** – Use `positioning:sit_on_lap_from_sitting_facing_away` to understand the facing away mechanics (facing_away component, actor_turned_back event).【F:data/mods/positioning/actions/sit_on_lap_from_sitting_facing_away.action.json†L1-L32】【F:data/mods/positioning/rules/handle_sit_on_lap_from_sitting_facing_away.rule.json†L1-L113】
- **Scope reference** – Reuse the existing `positioning:actors_both_sitting_close` scope which filters for actors who are both sitting and have closeness.
- **Straddling component** – Reference `positioning:straddling_waist` component structure which tracks `target_id` and `facing_away` boolean.
- **Facing away component** – Reference `positioning:facing_away` component structure which tracks entities the actor is facing away from.
- **Test patterns** – Follow the comprehensive test patterns from existing lift and sit-on-lap test suites.【F:tests/integration/mods/positioning/lift_onto_lap_face_to_face_action_discovery.test.js†L1-L100】【F:tests/integration/mods/positioning/lift_onto_lap_face_to_face_action.test.js†L1-L100】

### Visual Palette Consistency

Reuse the brown-orange palette (`#bf360c`, `#ffffff`, `#8d2c08`) from other positioning lap actions for category consistency.

## Key Differences from Existing Actions

This action is a **hybrid** combining two established patterns:

| Aspect | Pattern Source | Applied To |
|--------|---------------|------------|
| **Component manipulation target** | `lift_onto_lap_face_to_face` | Modify PRIMARY (not actor) |
| **Orientation mechanics** | `sit_on_lap_from_sitting_facing_away` | facing_away=true, add facing_away component, dispatch event |

**Comparison table**:

| Action | Who moves? | Who loses sitting_on? | Who gains straddling_waist? | Orientation |
|--------|-----------|----------------------|---------------------------|-------------|
| `sit_on_lap_from_sitting_facing_away` | Actor moves self | Actor | Actor | facing_away=true |
| `lift_onto_lap_face_to_face` | Actor lifts target | Primary | Primary | facing_away=false |
| **`lift_onto_lap_facing_away` (NEW)** | **Actor lifts target** | **Primary** | **Primary** | **facing_away=true** |

## Action Requirements

Author `data/mods/positioning/actions/lift_onto_lap_facing_away.action.json` (final ID should be `positioning:lift_onto_lap_facing_away`).

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "positioning:lift_onto_lap_facing_away",
  "name": "Lift Onto Lap (Facing Away)",
  "description": "Lift a close sitting actor onto your lap in a facing away orientation",
  "targets": {
    "primary": {
      "scope": "positioning:actors_both_sitting_close",
      "placeholder": "primary",
      "description": "Sitting actor close to you to lift onto your lap"
    }
  },
  "required_components": {
    "actor": ["positioning:sitting_on", "positioning:closeness"],
    "primary": ["positioning:sitting_on", "positioning:closeness"]
  },
  "forbidden_components": {
    "primary": ["positioning:straddling_waist"]
  },
  "template": "lift {primary} onto your lap (facing away)",
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "core:actor-mouth-available"
      },
      "failure_message": "You cannot do that while your mouth is engaged."
    }
  ],
  "visual": {
    "backgroundColor": "#bf360c",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#8d2c08",
    "hoverTextColor": "#ffffff"
  }
}
```

**Key points**:
- `targets.primary.scope`: `positioning:actors_both_sitting_close` (both must be sitting and close)
- `targets.primary.placeholder`: `primary` (matches the template placeholder)
- `required_components`: Both actor and primary must have `sitting_on` and `closeness`
- `forbidden_components.primary`: Cannot lift someone already straddling another's lap
- `template`: **Exactly** `lift {primary} onto your lap (facing away)`
- Add the action file path to `data/mods/positioning/mod-manifest.json` in the actions section

## Rule Requirements

Implement `data/mods/positioning/rules/handle_lift_onto_lap_facing_away.rule.json` alongside a matching condition file `data/mods/positioning/conditions/event-is-action-lift-onto-lap-facing-away.condition.json`.

### Rule Structure

This rule is a **hybrid** of the two reference rules:

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_lift_onto_lap_facing_away",
  "comment": "Handles the 'positioning:lift_onto_lap_facing_away' action. CRITICAL: REMOVES sitting_on from PRIMARY target (not actor), adds straddling_waist component to PRIMARY with facing_away=true, adds facing_away component, locks PRIMARY movement, dispatches actor_turned_back event. Actor remains sitting.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "positioning:event-is-action-lift-onto-lap-facing-away"
  },
  "actions": [
    {
      "type": "GET_NAME",
      "parameters": {
        "entity_ref": "actor",
        "result_variable": "actorName"
      }
    },
    {
      "type": "GET_NAME",
      "parameters": {
        "entity_ref": "primary",
        "result_variable": "primaryName"
      }
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
      "type": "REMOVE_COMPONENT",
      "comment": "CRITICAL: Remove PRIMARY's sitting_on component as they're being lifted off furniture",
      "parameters": {
        "entity_ref": "primary",
        "component_type": "positioning:sitting_on"
      }
    },
    {
      "type": "ADD_COMPONENT",
      "comment": "Add straddling_waist component to PRIMARY with facing_away=true",
      "parameters": {
        "entity_ref": "primary",
        "component_type": "positioning:straddling_waist",
        "value": {
          "target_id": "{event.payload.actorId}",
          "facing_away": true
        }
      }
    },
    {
      "type": "ADD_COMPONENT",
      "comment": "Add facing_away component to PRIMARY to track which entity they're facing away from",
      "parameters": {
        "entity_ref": "primary",
        "component_type": "positioning:facing_away",
        "value": {
          "facing_away_from": ["{event.payload.actorId}"]
        }
      }
    },
    {
      "type": "LOCK_MOVEMENT",
      "comment": "Lock movement for the lifted target while straddling",
      "parameters": {
        "actor_id": "{event.payload.primaryId}"
      }
    },
    {
      "type": "DISPATCH_EVENT",
      "comment": "Dispatch event indicating PRIMARY has turned their back to actor",
      "parameters": {
        "eventType": "positioning:actor_turned_back",
        "payload": {
          "actor": "{event.payload.primaryId}",
          "target": "{event.payload.actorId}"
        }
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} lifts {context.primaryName} onto {context.actorName}'s lap (facing away)."
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
        "value": "{event.payload.primaryId}"
      }
    },
    {
      "macro": "core:logSuccessAndEndTurn"
    }
  ]
}
```

**Critical differences from face-to-face lift**:
1. **straddling_waist.facing_away**: Set to `true` instead of `false`
2. **ADD_COMPONENT for facing_away**: Additional operation to add `positioning:facing_away` component to PRIMARY
3. **DISPATCH_EVENT**: Dispatch `positioning:actor_turned_back` event
4. **Log message**: Uses "facing away" instead of "face-to-face"

**Note**: Like the face-to-face lift, all component modifications target PRIMARY (the entity being lifted), not the actor. The actor remains sitting on their original furniture unchanged.

### Condition File

Create `data/mods/positioning/conditions/event-is-action-lift-onto-lap-facing-away.condition.json`:

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "positioning:event-is-action-lift-onto-lap-facing-away",
  "description": "Evaluates to true when the event is an attempt_action for lift_onto_lap_facing_away",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "positioning:lift_onto_lap_facing_away"
    ]
  }
}
```

**Note**: Add both the rule and condition files to `data/mods/positioning/mod-manifest.json` in their respective sections.

## Component State Summary

### Before Action
- **Actor**: Has `positioning:sitting_on` (on some furniture), has `positioning:closeness` with target
- **Primary (Target)**: Has `positioning:sitting_on` (on some furniture), has `positioning:closeness` with actor

### After Action
- **Actor**: Still has `positioning:sitting_on` (unchanged), still has `positioning:closeness`
- **Primary (Target)**:
  - `positioning:sitting_on` **REMOVED**
  - `positioning:straddling_waist` **ADDED** with `{ target_id: <actor_id>, facing_away: true }`
  - `positioning:facing_away` **ADDED** with `{ facing_away_from: [<actor_id>] }`
  - `positioning:closeness` still present
  - Movement **LOCKED**
- **Event dispatched**: `positioning:actor_turned_back` with actor=primaryId, target=actorId

## Test Requirements

### Test File Structure

Follow the modern `ModTestFixture` patterns as documented in the Mod Testing Guide【F:docs/testing/mod-testing-guide.md†L1-L150】.

#### 1. Action Discovery Tests

Create `tests/integration/mods/positioning/lift_onto_lap_facing_away_action_discovery.test.js`:

**Valid Discovery Scenarios**:
- ✅ **Both sitting and close**: Actor and target both have `sitting_on` and mutual `closeness` → Action discovered
- ✅ **Multiple valid targets**: Actor close to multiple sitting actors → Action discovered with all valid targets
- ✅ **Same furniture**: Actor and target sitting on same furniture (e.g., couch) → Action discovered
- ✅ **Different furniture**: Actor and target sitting on different furniture but close → Action discovered

**Invalid Discovery Scenarios**:
- ❌ **Actor standing**: Actor lacks `sitting_on` → Action NOT discovered
- ❌ **Target standing**: Target lacks `sitting_on` → Action NOT discovered
- ❌ **Not close**: Actor and target not in each other's `closeness.partners` → Action NOT discovered
- ❌ **Target already straddling**: Target has `straddling_waist` component → Action NOT discovered (forbidden_components check)
- ❌ **Actor already being straddled**: Valid scenario (no forbidden component on actor) → Action discovered

**Test pattern**:

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import liftOntoLapRule from '../../../../data/mods/positioning/rules/handle_lift_onto_lap_facing_away.rule.json' assert { type: 'json' };
import eventIsActionLiftOntoLap from '../../../../data/mods/positioning/conditions/event-is-action-lift-onto-lap-facing-away.condition.json' assert { type: 'json' };
import liftOntoLapAction from '../../../../data/mods/positioning/actions/lift_onto_lap_facing_away.action.json' assert { type: 'json' };
import mouthAvailableCondition from '../../../../data/mods/core/conditions/actor-mouth-available.condition.json' assert { type: 'json' };

describe('lift_onto_lap_facing_away action discovery - Integration Tests', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:lift_onto_lap_facing_away',
      liftOntoLapRule,
      eventIsActionLiftOntoLap
    );

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) return;

      // Build action index
      testEnv.actionIndex.buildIndex([liftOntoLapAction]);
    };

    // Set up scope resolver for actors_both_sitting_close
    const { testEnv } = testFixture;
    const originalResolveSync = testEnv.unifiedScopeResolver.resolveSync;
    testEnv.unifiedScopeResolver.resolveSync = (scopeName, context) => {
      if (scopeName === 'positioning:actors_both_sitting_close') {
        const actorId = context?.actor?.id;
        if (!actorId) return { success: true, value: new Set() };

        const actor = testFixture.entityManager.getEntityInstance(actorId);
        const closeness = actor?.components?.['positioning:closeness'];

        if (!closeness || !Array.isArray(closeness.partners)) {
          return { success: true, value: new Set() };
        }

        // Filter partners where BOTH have sitting_on
        const bothSittingPartners = closeness.partners.filter(partnerId => {
          const partner = testFixture.entityManager.getEntityInstance(partnerId);
          return !!partner?.components?.['positioning:sitting_on'] &&
                 !!actor?.components?.['positioning:sitting_on'];
        });

        return { success: true, value: new Set(bothSittingPartners) };
      }

      return originalResolveSync.call(testEnv.unifiedScopeResolver, scopeName, context);
    };

    // Mock condition retrieval
    const originalGetCondition = testEnv.dataRegistry.getConditionDefinition.getMockImplementation?.();
    testEnv.dataRegistry.getConditionDefinition.mockImplementation(conditionId => {
      if (conditionId === 'core:actor-mouth-available') {
        return mouthAvailableCondition;
      }
      return originalGetCondition ? originalGetCondition(conditionId) : undefined;
    });
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Valid Discovery Scenarios', () => {
    it('should discover action when both actor and target are sitting and close', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const chair1 = new ModEntityBuilder('chair1')
        .withName('Chair 1')
        .atLocation('room1')
        .build();

      const chair2 = new ModEntityBuilder('chair2')
        .withName('Chair 2')
        .atLocation('room1')
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      const target = new ModEntityBuilder('target1')
        .closeToEntity('actor1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair2',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, chair1, chair2, actor, target]);

      configureActionDiscovery();

      const actions = await testFixture.testEnv.actionDiscoveryService.discoverActions(
        'actor1'
      );

      const liftAction = actions.find(
        a => a.actionId === 'positioning:lift_onto_lap_facing_away'
      );

      expect(liftAction).toBeDefined();
      expect(liftAction.targets.primary).toBe('target1');
    });

    it('should discover action with multiple sitting close targets', async () => {
      // Test implementation - actor close to multiple sitting actors
    });

    it('should discover action when both on same furniture', async () => {
      // Test implementation - both sitting on same couch/bench
    });
  });

  describe('Invalid Discovery Scenarios', () => {
    it('should NOT discover action when actor is standing', async () => {
      // Test implementation - actor without sitting_on
    });

    it('should NOT discover action when target is standing', async () => {
      // Test implementation - target without sitting_on
    });

    it('should NOT discover action when actors are not close', async () => {
      // Test implementation - no mutual closeness
    });

    it('should NOT discover action when target is already straddling', async () => {
      // CRITICAL: Test forbidden_components validation
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const chair1 = new ModEntityBuilder('chair1')
        .withName('Chair 1')
        .atLocation('room1')
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      const target = new ModEntityBuilder('target1')
        .closeToEntity('actor1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 1,
        })
        .withComponent('positioning:straddling_waist', {
          target_id: 'other_actor',
          facing_away: false,
        })
        .build();

      testFixture.reset([room, chair1, actor, target]);

      configureActionDiscovery();

      const actions = await testFixture.testEnv.actionDiscoveryService.discoverActions(
        'actor1'
      );

      const liftAction = actions.find(
        a => a.actionId === 'positioning:lift_onto_lap_facing_away'
      );

      expect(liftAction).toBeUndefined();
    });
  });
});
```

#### 2. Action Execution Tests

Create `tests/integration/mods/positioning/lift_onto_lap_facing_away_action.test.js`:

**Component Manipulation Tests**:
- ✅ **Remove target's sitting_on**: Verify PRIMARY's `sitting_on` component is removed
- ✅ **Add target's straddling_waist**: Verify PRIMARY gains `straddling_waist` with correct `target_id` and `facing_away: true`
- ✅ **Add target's facing_away**: Verify PRIMARY gains `facing_away` component with actor in the array
- ✅ **Keep actor's sitting_on unchanged**: Verify ACTOR's `sitting_on` component remains unchanged

**Event Dispatching Tests**:
- ✅ **Dispatch actor_turned_back event**: Verify event is dispatched with correct actor/target IDs
- ✅ **Successful action result**: Verify `core:display_successful_action_result` event is dispatched

**Output Validation Tests**:
- ✅ **Correct log message**: Verify message is "{actorName} lifts {primaryName} onto {actorName}'s lap (facing away)."

**Edge Cases**:
- ✅ **Same furniture**: Both starting on same furniture (e.g., couch) → Target lifted successfully
- ✅ **Different furniture**: Starting on different furniture → Target lifted successfully
- ✅ **Target component preservation**: Target's other components (position, closeness) remain intact

**Test pattern**:

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import liftOntoLapRule from '../../../../data/mods/positioning/rules/handle_lift_onto_lap_facing_away.rule.json' assert { type: 'json' };
import eventIsActionLiftOntoLap from '../../../../data/mods/positioning/conditions/event-is-action-lift-onto-lap-facing-away.condition.json' assert { type: 'json' };

describe('lift_onto_lap_facing_away - Action Execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:lift_onto_lap_facing_away',
      liftOntoLapRule,
      eventIsActionLiftOntoLap
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Component Manipulation', () => {
    it('should remove sitting_on component from PRIMARY target (not actor)', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
      const chair1 = new ModEntityBuilder('chair1')
        .withName('Chair 1')
        .atLocation('room1')
        .build();
      const chair2 = new ModEntityBuilder('chair2')
        .withName('Chair 2')
        .atLocation('room1')
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      const target = new ModEntityBuilder('target1')
        .closeToEntity('actor1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair2',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, chair1, chair2, actor, target]);

      await testFixture.executeAction('actor1', 'target1');

      const updatedTarget = testFixture.entityManager.getEntityInstance('target1');
      expect(updatedTarget.components['positioning:sitting_on']).toBeUndefined();
    });

    it('should add straddling_waist component to PRIMARY target with facing_away=true', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
      const chair1 = new ModEntityBuilder('chair1')
        .withName('Chair 1')
        .atLocation('room1')
        .build();
      const chair2 = new ModEntityBuilder('chair2')
        .withName('Chair 2')
        .atLocation('room1')
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      const target = new ModEntityBuilder('target1')
        .closeToEntity('actor1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair2',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, chair1, chair2, actor, target]);

      await testFixture.executeAction('actor1', 'target1');

      const updatedTarget = testFixture.entityManager.getEntityInstance('target1');
      const straddling = updatedTarget.components['positioning:straddling_waist'];

      expect(straddling).toBeDefined();
      expect(straddling.target_id).toBe('actor1');
      expect(straddling.facing_away).toBe(true);
    });

    it('should add facing_away component to PRIMARY target', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
      const chair1 = new ModEntityBuilder('chair1')
        .withName('Chair 1')
        .atLocation('room1')
        .build();
      const chair2 = new ModEntityBuilder('chair2')
        .withName('Chair 2')
        .atLocation('room1')
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      const target = new ModEntityBuilder('target1')
        .closeToEntity('actor1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair2',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, chair1, chair2, actor, target]);

      await testFixture.executeAction('actor1', 'target1');

      const updatedTarget = testFixture.entityManager.getEntityInstance('target1');
      const facingAway = updatedTarget.components['positioning:facing_away'];

      expect(facingAway).toBeDefined();
      expect(facingAway.facing_away_from).toContain('actor1');
    });

    it('should keep ACTOR sitting_on component unchanged', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
      const chair1 = new ModEntityBuilder('chair1')
        .withName('Chair 1')
        .atLocation('room1')
        .build();
      const chair2 = new ModEntityBuilder('chair2')
        .withName('Chair 2')
        .atLocation('room1')
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      const target = new ModEntityBuilder('target1')
        .closeToEntity('actor1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair2',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, chair1, chair2, actor, target]);

      await testFixture.executeAction('actor1', 'target1');

      const updatedActor = testFixture.entityManager.getEntityInstance('actor1');
      const actorSitting = updatedActor.components['positioning:sitting_on'];

      expect(actorSitting).toBeDefined();
      expect(actorSitting.furniture_id).toBe('chair1');
      expect(actorSitting.spot_index).toBe(0);
    });
  });

  describe('Event Dispatching', () => {
    it('should dispatch actor_turned_back event', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
      const chair1 = new ModEntityBuilder('chair1')
        .withName('Chair 1')
        .atLocation('room1')
        .build();
      const chair2 = new ModEntityBuilder('chair2')
        .withName('Chair 2')
        .atLocation('room1')
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      const target = new ModEntityBuilder('target1')
        .closeToEntity('actor1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair2',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, chair1, chair2, actor, target]);

      await testFixture.executeAction('actor1', 'target1');

      const turnedBackEvent = testFixture.events.find(
        e => e.type === 'positioning:actor_turned_back'
      );

      expect(turnedBackEvent).toBeDefined();
      expect(turnedBackEvent.payload.actor).toBe('target1');
      expect(turnedBackEvent.payload.target).toBe('actor1');
    });

    it('should dispatch successful action result event', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
      const chair1 = new ModEntityBuilder('chair1')
        .withName('Chair 1')
        .atLocation('room1')
        .build();
      const chair2 = new ModEntityBuilder('chair2')
        .withName('Chair 2')
        .atLocation('room1')
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      const target = new ModEntityBuilder('target1')
        .closeToEntity('actor1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair2',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, chair1, chair2, actor, target]);

      await testFixture.executeAction('actor1', 'target1');

      const successEvent = testFixture.events.find(
        e => e.type === 'core:display_successful_action_result'
      );

      expect(successEvent).toBeDefined();
    });
  });

  describe('Output Validation', () => {
    it('should generate correct log message', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
      const chair1 = new ModEntityBuilder('chair1')
        .withName('Chair 1')
        .atLocation('room1')
        .build();
      const chair2 = new ModEntityBuilder('chair2')
        .withName('Chair 2')
        .atLocation('room1')
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      const target = new ModEntityBuilder('target1')
        .closeToEntity('actor1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair2',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, chair1, chair2, actor, target]);

      await testFixture.executeAction('actor1', 'target1');

      const successEvent = testFixture.events.find(
        e => e.type === 'core:display_successful_action_result'
      );

      expect(successEvent.payload.message).toBe(
        "Alice lifts Bob onto Alice's lap (facing away)."
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle lifting target from same furniture', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
      const couch = new ModEntityBuilder('couch1')
        .withName('Couch')
        .atLocation('room1')
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'couch1',
          spot_index: 0,
        })
        .build();

      const target = new ModEntityBuilder('target1')
        .closeToEntity('actor1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'couch1',
          spot_index: 1,
        })
        .build();

      testFixture.reset([room, couch, actor, target]);

      await testFixture.executeAction('actor1', 'target1');

      const updatedTarget = testFixture.entityManager.getEntityInstance('target1');
      expect(updatedTarget.components['positioning:sitting_on']).toBeUndefined();
      expect(updatedTarget.components['positioning:straddling_waist']).toBeDefined();
      expect(updatedTarget.components['positioning:facing_away']).toBeDefined();
    });

    it('should preserve target other components', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
      const chair1 = new ModEntityBuilder('chair1')
        .withName('Chair 1')
        .atLocation('room1')
        .build();
      const chair2 = new ModEntityBuilder('chair2')
        .withName('Chair 2')
        .atLocation('room1')
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      const target = new ModEntityBuilder('target1')
        .closeToEntity('actor1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair2',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, chair1, chair2, actor, target]);

      await testFixture.executeAction('actor1', 'target1');

      const updatedTarget = testFixture.entityManager.getEntityInstance('target1');

      // Verify critical components preserved
      expect(updatedTarget.components['core:position']).toBeDefined();
      expect(updatedTarget.components['positioning:closeness']).toBeDefined();
      expect(updatedTarget.components['core:actor']).toBeDefined();
    });
  });
});
```

### Test Coverage Requirements

Following the project's testing standards【F:CLAUDE.md†L147-L155】:
- **Branch coverage**: Minimum 80%
- **Function coverage**: Minimum 90%
- **Line coverage**: Minimum 90%

### Test Documentation

All tests should follow the patterns documented in:
- **Mod Testing Guide**: Canonical reference for fixture, builders, matchers【F:docs/testing/mod-testing-guide.md†L1-L150】
- **Action Discovery Testing Toolkit**: Migration checklists and discovery patterns

## Implementation Checklist

- [ ] Create action file: `data/mods/positioning/actions/lift_onto_lap_facing_away.action.json`
- [ ] Create rule file: `data/mods/positioning/rules/handle_lift_onto_lap_facing_away.rule.json`
- [ ] Create condition file: `data/mods/positioning/conditions/event-is-action-lift-onto-lap-facing-away.condition.json`
- [ ] Update `data/mods/positioning/mod-manifest.json` with all three new files
- [ ] Create discovery test: `tests/integration/mods/positioning/lift_onto_lap_facing_away_action_discovery.test.js`
- [ ] Create execution test: `tests/integration/mods/positioning/lift_onto_lap_facing_away_action.test.js`
- [ ] Run tests: `NODE_ENV=test npx jest tests/integration/mods/positioning/lift_onto_lap_facing_away*.test.js --no-coverage`
- [ ] Verify all tests pass
- [ ] Run linting: `npx eslint tests/integration/mods/positioning/lift_onto_lap_facing_away*.test.js`
- [ ] Validate JSON schemas pass validation
- [ ] Run full positioning mod test suite: `NODE_ENV=test npm run test:integration -- tests/integration/mods/positioning/ --silent`

## Critical Implementation Notes

### Component Target Pattern (From Lift Mechanics)

The most critical aspect is understanding which entity's components are modified:

| Action Type | Removes sitting_on from | Adds straddling_waist to | Adds facing_away to | Movement lock on |
|-------------|-------------------------|--------------------------|---------------------|------------------|
| **Voluntary sit (facing away)** | Actor | Actor | Actor | Actor |
| **Lift (face-to-face)** | Primary Target | Primary Target | N/A | Primary Target |
| **Lift (facing away) - NEW** | **Primary Target** | **Primary Target** | **Primary Target** | **Primary Target** |

**Why this matters**:
- The actor lifts the target → target loses sitting_on, gains straddling_waist
- The target is positioned facing away → target gains facing_away component
- The `straddling_waist.target_id` always points to the entity being straddled (the actor)
- The person ending up on the lap is the one with all positioning components modified

### Orientation Pattern (From Facing Away Mechanics)

Three additional operations beyond the face-to-face lift:

1. **straddling_waist.facing_away**: Must be `true`
2. **Add facing_away component**: To PRIMARY with actor in the `facing_away_from` array
3. **Dispatch actor_turned_back event**: With actor=primaryId, target=actorId

**Event payload structure**:
```json
{
  "eventType": "positioning:actor_turned_back",
  "payload": {
    "actor": "{event.payload.primaryId}",
    "target": "{event.payload.actorId}"
  }
}
```

Note: The "actor" in the event is the PRIMARY (the one who turned their back), and "target" is the ACTOR (the one whose back is turned to).

### Testing the Forbidden Component

The `forbidden_components` check is essential:
- **Without it**: Players could lift someone already straddling another person's lap (physically nonsensical)
- **Test case required**: Verify action is NOT discovered when target has `straddling_waist` component
- **Edge case**: Actor being straddled by someone else is valid (they can still lift another person)

### Message Consistency

The narrative messages must use "facing away" terminology consistently:
- Perceptible event: "{actor} lifts {primary} onto {actor}'s lap (facing away)."
- Successful action: Same message
- Template: "lift {primary} onto your lap (facing away)"

All three must remain consistent for player clarity.

### Comparison with Face-to-Face Lift

When implementing, developers should carefully distinguish:

**Similarities** (same as lift_onto_lap_face_to_face):
- Scope: `positioning:actors_both_sitting_close`
- Required components: Both need sitting_on and closeness
- Forbidden components: Primary cannot have straddling_waist
- Component manipulation target: Always PRIMARY (not actor)
- Actor remains sitting on their furniture
- Movement lock: Applied to PRIMARY

**Differences** (from facing away orientation):
- `straddling_waist.facing_away`: `true` instead of `false`
- Additional component: `positioning:facing_away` added to PRIMARY
- Additional event: `positioning:actor_turned_back` dispatched
- Message terminology: "facing away" instead of "face-to-face"

## References

- Action Schema: `schema://living-narrative-engine/action.schema.json`
- Rule Schema: `schema://living-narrative-engine/rule.schema.json`
- Condition Schema: `schema://living-narrative-engine/condition.schema.json`
- Component Schema: `schema://living-narrative-engine/component.schema.json`
- Mod Manifest Schema: Reference existing positioning mod manifest structure
- Testing Documentation: `docs/testing/mod-testing-guide.md`【F:docs/testing/mod-testing-guide.md†L1-L150】
