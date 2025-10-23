# Lift Onto Lap (Face-to-Face) Action Specification

## Overview

Introduce a new positioning action that allows an actor to lift a close sitting target onto their lap in a face-to-face orientation. This action represents an **active, initiated lift** by the actor, distinct from the existing voluntary "sit on lap" actions where the actor moves themselves onto another's lap.

## Reference Patterns and Constraints

- **Voluntary sitting actions** – Use `positioning:sit_on_lap_from_sitting_facing` and `positioning:sit_on_lap_from_sitting_facing_away` as baseline for action structure, visual palette, and component management patterns.【F:data/mods/positioning/actions/sit_on_lap_from_sitting_facing.action.json†L1-L32】【F:data/mods/positioning/actions/sit_on_lap_from_sitting_facing_away.action.json†L1-L31】
- **Existing rule pattern** – Follow the component manipulation logic from `handle_sit_on_lap_from_sitting_facing.rule.json` which removes the actor's `sitting_on` and adds `straddling_waist` to establish the new position.【F:data/mods/positioning/rules/handle_sit_on_lap_from_sitting_facing.rule.json†L1-L91】
- **Scope reference** – Reuse the existing `positioning:actors_both_sitting_close` scope which filters for actors who are both sitting and have closeness.
- **Straddling component** – Reference `positioning:straddling_waist` component structure which tracks `target_id` and `facing_away` boolean.【F:data/mods/positioning/components/straddling_waist.component.json†L1-L21】
- **Test patterns** – Follow the comprehensive test patterns from existing sit-on-lap test suites.【F:tests/integration/mods/positioning/sit_on_lap_from_sitting_facing_action.test.js†L1-L364】【F:tests/integration/mods/positioning/sit_on_lap_from_sitting_facing_action_discovery.test.js†L1-L306】

## Key Differences from Existing Actions

Unlike the voluntary "sit on lap" actions where the **actor** moves onto another's lap:
- In this action, the **actor lifts the target** onto the actor's lap
- The **target** (not the actor) loses their `sitting_on` component
- The **target** (not the actor) gains the `straddling_waist` component
- The **actor** remains sitting on their furniture
- This represents an active, physical lift rather than a self-initiated movement

## Action Requirements

Author `data/mods/positioning/actions/lift_onto_lap_face_to_face.action.json` (final ID should be `positioning:lift_onto_lap_face_to_face`).

- `$schema`: `schema://living-narrative-engine/action.schema.json`
- `id`: `positioning:lift_onto_lap_face_to_face`
- `name`: "Lift Onto Lap (Face-to-Face)"
- `description`: "Lift a close sitting actor onto your lap in a face-to-face orientation"
- `targets.primary`:
  - `scope`: `positioning:actors_both_sitting_close`
  - `placeholder`: `primary`
  - `description`: "Sitting actor close to you to lift onto your lap"
- `required_components`:
  - `actor`: `["positioning:sitting_on", "positioning:closeness"]`
  - `primary`: `["positioning:sitting_on", "positioning:closeness"]`
  - **Note**: Both must be sitting and close to each other
- `forbidden_components`:
  - `primary`: `["positioning:straddling_waist"]`
  - **Rationale**: Cannot lift someone who is already straddling another's lap
- `template`: **Exactly** `lift {primary} onto your lap (face-to-face)`
  - **Note**: Use `{primary}` placeholder as specified in requirements
- `prerequisites`: Match the mouth-available check from the reference actions
  ```json
  [
    {
      "logic": {
        "condition_ref": "core:actor-mouth-available"
      },
      "failure_message": "You cannot do that while your mouth is engaged."
    }
  ]
  ```
- `visual`: Reuse the brown-orange palette from sit-on-lap actions for category consistency【F:data/mods/positioning/actions/sit_on_lap_from_sitting_facing.action.json†L26-L31】:
  ```json
  {
    "backgroundColor": "#bf360c",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#8d2c08",
    "hoverTextColor": "#ffffff"
  }
  ```
- Add the action file path to `data/mods/positioning/mod-manifest.json` in the appropriate section

## Rule Requirements

Implement `data/mods/positioning/rules/handle_lift_onto_lap_face_to_face.rule.json` alongside a matching condition file `data/mods/positioning/conditions/event-is-action-lift-onto-lap-face-to-face.condition.json`.

### Rule Structure

Base the rule on `handle_sit_on_lap_from_sitting_facing.rule.json` but with critical differences in which entity's components are modified:

1. **Event matching**: `event_type` is `core:attempt_action`, and the condition ensures the rule only triggers for the new action ID `positioning:lift_onto_lap_face_to_face`.

2. **Name retrieval**:
   - `GET_NAME` for `actor` → `actorName`
   - `GET_NAME` for `primary` → `primaryName`

3. **Position query**: Query actor's `core:position` component into `actorPosition` for location metadata.

4. **Remove target's sitting_on component** (CRITICAL DIFFERENCE):
   ```json
   {
     "type": "REMOVE_COMPONENT",
     "comment": "CRITICAL: Remove PRIMARY's sitting_on component as they're being lifted off furniture",
     "parameters": {
       "entity_ref": "primary",
       "component_type": "positioning:sitting_on"
     }
   }
   ```
   **Note**: Unlike the voluntary sit actions which remove the actor's `sitting_on`, this removes the PRIMARY target's component since they are being lifted.

5. **Add straddling_waist to target** (CRITICAL DIFFERENCE):
   ```json
   {
     "type": "ADD_COMPONENT",
     "comment": "Add straddling_waist component to PRIMARY with face-to-face orientation",
     "parameters": {
       "entity_ref": "primary",
       "component_type": "positioning:straddling_waist",
       "value": {
         "target_id": "{event.payload.actorId}",
         "facing_away": false
       }
     }
   }
   ```
   **Note**: The target is straddling the actor, so `target_id` references the actor's ID.

6. **Lock movement for the lifted target**:
   ```json
   {
     "type": "LOCK_MOVEMENT",
     "comment": "Lock movement for the lifted target while straddling",
     "parameters": {
       "actor_id": "{event.payload.primaryId}"
     }
   }
   ```
   **Note**: Lock the PRIMARY's movement, not the actor's, since the target is the one being positioned.

7. **Set narrative message**:
   ```json
   {
     "type": "SET_VARIABLE",
     "parameters": {
       "variable_name": "logMessage",
       "value": "{context.actorName} lifts {context.primaryName} onto {context.actorName}'s lap (face-to-face)."
     }
   }
   ```

8. **Set metadata variables**:
   - `perceptionType`: `action_target_general`
   - `locationId`: `{context.actorPosition.locationId}`
   - `targetId`: `{event.payload.primaryId}`

9. **Finish**: Use `{ "macro": "core:logSuccessAndEndTurn" }` to complete the action.

10. Add both the new rule and condition files to the `positioning` mod manifest.

### Condition File

Create `data/mods/positioning/conditions/event-is-action-lift-onto-lap-face-to-face.condition.json`:
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "positioning:event-is-action-lift-onto-lap-face-to-face",
  "description": "Evaluates to true when the event is an attempt_action for lift_onto_lap_face_to_face",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "positioning:lift_onto_lap_face_to_face"
    ]
  }
}
```

## Component State Summary

### Before Action
- **Actor**: Has `positioning:sitting_on` (on some furniture), has `positioning:closeness` with target
- **Target**: Has `positioning:sitting_on` (on some furniture), has `positioning:closeness` with actor

### After Action
- **Actor**: Still has `positioning:sitting_on` (unchanged), still has `positioning:closeness`
- **Target**:
  - `positioning:sitting_on` **REMOVED**
  - `positioning:straddling_waist` **ADDED** with `{ target_id: <actor_id>, facing_away: false }`
  - `positioning:closeness` still present
  - Movement **LOCKED**

## Test Requirements

### Test File Structure

Follow the modern `ModTestFixture` patterns as documented in the Mod Testing Guide【F:docs/testing/mod-testing-guide.md†L1-L100】.

#### 1. Action Discovery Tests

Create `tests/integration/mods/positioning/lift_onto_lap_face_to_face_action_discovery.test.js`:

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

**Test Pattern**:
```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import liftOntoLapRule from '../../../../data/mods/positioning/rules/handle_lift_onto_lap_face_to_face.rule.json' assert { type: 'json' };
import eventIsActionLiftOntoLap from '../../../../data/mods/positioning/conditions/event-is-action-lift-onto-lap-face-to-face.condition.json' assert { type: 'json' };
import liftOntoLapAction from '../../../../data/mods/positioning/actions/lift_onto_lap_face_to_face.action.json' assert { type: 'json' };
import mouthAvailableCondition from '../../../../data/mods/core/conditions/actor-mouth-available.condition.json' assert { type: 'json' };

describe('lift_onto_lap_face_to_face action discovery - Integration Tests', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:lift_onto_lap_face_to_face',
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
      // Test implementation following the pattern from reference tests
    });

    it('should discover action with multiple sitting close targets', async () => {
      // Test implementation
    });
  });

  describe('Invalid Discovery Scenarios', () => {
    it('should NOT discover action when actor is standing', async () => {
      // Test implementation
    });

    it('should NOT discover action when target is standing', async () => {
      // Test implementation
    });

    it('should NOT discover action when actors are not close', async () => {
      // Test implementation
    });

    it('should NOT discover action when target is already straddling', async () => {
      // Test implementation - CRITICAL: Test forbidden_components
    });
  });
});
```

#### 2. Action Execution Tests

Create `tests/integration/mods/positioning/lift_onto_lap_face_to_face_action.test.js`:

**Component Manipulation Tests**:
- ✅ **Remove target's sitting_on**: Verify PRIMARY's `sitting_on` component is removed
- ✅ **Add target's straddling_waist**: Verify PRIMARY gains `straddling_waist` with correct `target_id` and `facing_away: false`
- ✅ **Keep actor's sitting_on unchanged**: Verify ACTOR's `sitting_on` component remains unchanged
- ✅ **Do not add facing_away**: Verify PRIMARY does not gain `facing_away` component (face-to-face orientation)

**Event Dispatching Tests**:
- ✅ **No actor_turned_back event**: Verify this event is NOT dispatched (face-to-face orientation)
- ✅ **Successful action result**: Verify `core:display_successful_action_result` event is dispatched

**Output Validation Tests**:
- ✅ **Correct log message**: Verify message is "{actorName} lifts {primaryName} onto {actorName}'s lap (face-to-face)."

**Edge Cases**:
- ✅ **Same furniture**: Both starting on same furniture (e.g., couch) → Target lifted successfully
- ✅ **Different furniture**: Starting on different furniture → Target lifted successfully
- ✅ **Target component preservation**: Target's other components (position, closeness) remain intact

**Test Pattern**:
```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import liftOntoLapRule from '../../../../data/mods/positioning/rules/handle_lift_onto_lap_face_to_face.rule.json' assert { type: 'json' };
import eventIsActionLiftOntoLap from '../../../../data/mods/positioning/conditions/event-is-action-lift-onto-lap-face-to-face.condition.json' assert { type: 'json' };

describe('lift_onto_lap_face_to_face - Action Execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:lift_onto_lap_face_to_face',
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
      const chair1 = new ModEntityBuilder('chair1').withName('Chair 1').atLocation('room1').build();
      const chair2 = new ModEntityBuilder('chair2').withName('Chair 2').atLocation('room1').build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .asActor()
        .withComponent('positioning:sitting_on', { furniture_id: 'chair1', spot_index: 0 })
        .build();

      const target = new ModEntityBuilder('target1')
        .closeToEntity('actor1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', { furniture_id: 'chair2', spot_index: 0 })
        .build();

      testFixture.reset([room, chair1, chair2, actor, target]);

      await testFixture.executeAction('actor1', 'target1');

      const updatedTarget = testFixture.entityManager.getEntityInstance('target1');
      expect(updatedTarget.components['positioning:sitting_on']).toBeUndefined();
    });

    it('should add straddling_waist component to PRIMARY target with facing_away=false', async () => {
      // Test implementation following reference pattern
    });

    it('should keep ACTOR sitting_on component unchanged', async () => {
      // Test implementation - CRITICAL: Verify actor still has sitting_on
    });

    it('should NOT add facing_away component to target', async () => {
      // Test implementation
    });
  });

  describe('Event Dispatching', () => {
    it('should NOT dispatch actor_turned_back event', async () => {
      // Test implementation
    });

    it('should dispatch successful action result event', async () => {
      // Test implementation
    });
  });

  describe('Output Validation', () => {
    it('should generate correct log message', async () => {
      // Verify: "{actorName} lifts {primaryName} onto {actorName}'s lap (face-to-face)."
    });
  });

  describe('Edge Cases', () => {
    it('should handle lifting target from same furniture', async () => {
      // Test couch scenario where both start on same furniture
    });

    it('should handle lifting target from different furniture', async () => {
      // Test chair → couch scenario
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
- **Mod Testing Guide**: Canonical reference for fixture, builders, matchers【F:docs/testing/mod-testing-guide.md†L1-L100】
- **Action Discovery Testing Toolkit**: Migration checklists and discovery patterns【F:docs/testing/action-discovery-testing-toolkit.md】

## Implementation Checklist

- [ ] Create action file: `data/mods/positioning/actions/lift_onto_lap_face_to_face.action.json`
- [ ] Create rule file: `data/mods/positioning/rules/handle_lift_onto_lap_face_to_face.rule.json`
- [ ] Create condition file: `data/mods/positioning/conditions/event-is-action-lift-onto-lap-face-to-face.condition.json`
- [ ] Update `data/mods/positioning/mod-manifest.json` with all three new files
- [ ] Create discovery test: `tests/integration/mods/positioning/lift_onto_lap_face_to_face_action_discovery.test.js`
- [ ] Create execution test: `tests/integration/mods/positioning/lift_onto_lap_face_to_face_action.test.js`
- [ ] Run tests: `NODE_ENV=test npx jest tests/integration/mods/positioning/lift_onto_lap_face_to_face*.test.js --no-coverage`
- [ ] Verify all tests pass
- [ ] Run linting: `npx eslint data/mods/positioning/actions/lift_onto_lap_face_to_face.action.json tests/integration/mods/positioning/lift_onto_lap_face_to_face*.test.js`
- [ ] Validate JSON schemas pass validation
- [ ] Run full positioning mod test suite: `NODE_ENV=test npm run test:integration -- tests/integration/mods/positioning/ --silent`

## Critical Implementation Notes

### Component Target Reversal

The most critical aspect of this implementation is understanding which entity's components are modified:

| Action Type | Removes sitting_on from | Adds straddling_waist to | Movement lock on |
|-------------|-------------------------|--------------------------|------------------|
| **Voluntary sit** (reference) | Actor | Actor | Actor |
| **Lift onto lap** (new) | Primary Target | Primary Target | Primary Target |

**Why this matters**:
- In voluntary sit actions, the actor moves themselves → actor loses sitting_on
- In lift actions, the actor lifts the target → target loses sitting_on
- The `straddling_waist.target_id` always points to the entity being straddled
- In both cases, the person ending up on the lap is the one with `straddling_waist`

### Testing the Forbidden Component

The `forbidden_components` check is essential:
- **Without it**: Players could lift someone already straddling another person's lap (physically nonsensical)
- **Test case required**: Verify action is NOT discovered when target has `straddling_waist` component
- **Edge case**: Actor being straddled by someone else is valid (they can still lift another person)

### Message Consistency

The narrative messages follow this pattern:
- Perceptible event: "{actor} lifts {primary} onto {actor}'s lap (face-to-face)."
- Successful action: Same message
- Template: "lift {primary} onto your lap (face-to-face)"

All three must remain consistent for player clarity.

## References

- Action Schema: `schema://living-narrative-engine/action.schema.json`
- Rule Schema: `schema://living-narrative-engine/rule.schema.json`
- Condition Schema: `schema://living-narrative-engine/condition.schema.json`
- Component Schema: `schema://living-narrative-engine/component.schema.json`
- Mod Manifest Schema: Reference existing positioning mod manifest structure
- Testing Documentation: `docs/testing/mod-testing-guide.md`【F:docs/testing/mod-testing-guide.md†L1-L100】
