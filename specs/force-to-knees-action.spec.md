# Force to Knees Action Specification

## Overview

This specification defines the implementation requirements for a new "force to knees" action in the `physical-control` mod. The action allows an actor to forcefully push a close target down to their knees in a submissive or intimidating position before the actor. This is a violent action that differs from the voluntary `positioning:kneel_before` action.

## Action Definition

### File: `data/mods/physical-control/actions/force_to_knees.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "physical-control:force_to_knees",
  "name": "Force to Knees",
  "description": "Forcefully push someone down to kneel before you",
  "targets": {
    "primary": {
      "scope": "positioning:close_actors_facing_each_other",
      "placeholder": "target",
      "description": "The actor to force to their knees"
    }
  },
  "required_components": {
    "actor": ["positioning:closeness"]
  },
  "forbidden_components": {
    "actor": [],
    "primary": ["positioning:kneeling_before"]
  },
  "template": "force {target} to their knees before you",
  "visual": {
    "backgroundColor": "#2f2f2f",
    "textColor": "#f8f9fa",
    "hoverBackgroundColor": "#3f3d56",
    "hoverTextColor": "#f8f9ff"
  }
}
```

### Action Properties

- **ID**: `physical-control:force_to_knees` - Unique identifier within the physical-control mod
- **Name**: "Force to Knees" - Display name for the action
- **Description**: Brief description emphasizing the forceful nature
- **Targets**: Uses the scope `positioning:close_actors_facing_each_other`
  - Requires actors to be in closeness relationship
  - Requires both actors to be facing each other (more confrontational than grab_neck)
  - Cannot force someone from behind (unlike grab_neck)
- **Required Components (Actor)**: `positioning:closeness`
  - Actor must be in a closeness relationship to use this action
- **Forbidden Components (Target)**: `positioning:kneeling_before`
  - Cannot force someone who is already kneeling
  - This differs from voluntary kneeling which allows kneeling before someone already kneeling
- **Template**: `"force {target} to their knees before you"`
  - Generates text like "force Alice to their knees before you" when Bob is the actor
- **Visual Scheme**: Uses the physical-control mod color palette (matching `grab_neck.action.json`)
  - Dark red background (#2f2f2f)
  - White text (#f8f9fa)
  - Lighter red on hover (#3f3d56)
  - Light pink hover text (#f8f9ff)

## Rule Definition

### File: `data/mods/physical-control/rules/handle_force_to_knees.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_force_to_knees",
  "comment": "Handles the 'physical-control:force_to_knees' action. Forces target to kneel before actor, locks movement, dispatches descriptive text and ends the turn.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "physical-control:event-is-action-force-to-knees"
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
        "entity_ref": "target",
        "result_variable": "targetName"
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
      "type": "ADD_COMPONENT",
      "parameters": {
        "entity_ref": "target",
        "component_type": "positioning:kneeling_before",
        "value": {
          "entityId": "{event.payload.actorId}"
        }
      }
    },
    {
      "type": "LOCK_MOVEMENT",
      "comment": "Lock target's movement while kneeling (handles both legacy and anatomy entities)",
      "parameters": {
        "actor_id": "{event.payload.targetId}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} roughly forces {context.targetName} to their knees before {context.actorName}."
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
    {
      "macro": "core:logSuccessAndEndTurn"
    }
  ]
}
```

### Rule Behavior

The rule executes the following operations in sequence:

1. **Get Actor Name**: Retrieves the actor's display name for message generation
2. **Get Target Name**: Retrieves the target's display name for message generation
3. **Query Actor Position**: Gets the actor's location for event context
4. **Add Kneeling Component to Target**: Adds `positioning:kneeling_before` component to the target with the actor's ID
5. **Lock Target Movement**: Locks the target's movement (using target's entity ID, not actor's)
6. **Set Log Message**: Generates the message: `"{actor} roughly forces {target} to their knees before {actor}."`
7. **Set Perception Type**: Marks this as an `action_target_general` perception event
8. **Set Location ID**: Records where the action occurred
9. **Set Target ID**: Records who was affected
10. **Log Success and End Turn**: Uses the standard macro to complete the action

### Key Implementation Details

- **Component Addition**: The `positioning:kneeling_before` component is added to the **target**, not the actor
- **Entity ID Reference**: The component stores the **actor's ID** (the target is kneeling before the actor)
- **Movement Lock Target**: The LOCK_MOVEMENT operation targets the **target entity** (the one being forced to kneel)
- **Message Emphasis**: Uses "roughly forces" to emphasize the violent nature of the action
- **Message Format**: The perceptible event message and successful action message are identical
- **Event Context**: Includes location, actor, and target for proper event propagation
- **Macro Usage**: Leverages `core:logSuccessAndEndTurn` for consistent action completion

## Condition Definition

### File: `data/mods/physical-control/conditions/event-is-action-force-to-knees.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "physical-control:event-is-action-force-to-knees",
  "description": "True when the event is an attempt to execute the force_to_knees action",
  "logic": {
    "==": [
      {
        "var": "event.payload.actionId"
      },
      "physical-control:force_to_knees"
    ]
  }
}
```

### Condition Purpose

This condition is used by the rule to determine if the incoming `core:attempt_action` event is specifically for the `physical-control:force_to_knees` action. It checks the `actionId` field in the event payload.

## Testing Requirements

### Test Suite 1: Action Discovery Tests

**File**: `tests/integration/mods/physical-control/force_to_knees_action_discovery.test.js`

This test suite verifies that the action is discoverable under the correct circumstances.

#### Test Cases Required

1. **Action Structure Validation**
   - Verify action matches the expected physical-control action schema
   - Confirm action ID is `physical-control:force_to_knees`
   - Confirm template is `"force {target} to their knees before you"`
   - Confirm targets scope is `positioning:close_actors_facing_each_other`

2. **Required Components Validation**
   - Verify actor requires `positioning:closeness` component
   - Verify target forbidden component includes `positioning:kneeling_before`
   - Verify visual scheme matches physical-control color palette (Ironclad Slate) (same as `grab_neck`)

3. **Discovery Scenarios - Positive Cases**
   - Action IS available when actors are close and facing each other

4. **Discovery Scenarios - Negative Cases**
   - Action is NOT available when actors are not in closeness (no `positioning:closeness` component)
   - Action is NOT available when target already has `positioning:kneeling_before` component
   - Action is NOT available when actor faces away from the target
   - Action is NOT available when target faces away from the actor

#### Implementation Pattern

Follow the pattern from `grab_neck_action_discovery.test.js`:

```javascript
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import forceToKneesAction from '../../../../data/mods/physical-control/actions/force_to_knees.action.json';
import { clearEntityCache } from '../../../../src/scopeDsl/core/entityHelpers.js';

const ACTION_ID = 'physical-control:force_to_knees';

describe('physical-control:force_to_knees action discovery', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('physical-control', ACTION_ID);

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([forceToKneesAction]);

      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve =
        scopeResolver.__forceToKneesOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.__forceToKneesOriginalResolve = originalResolve;
      scopeResolver.resolveSync = (scopeName, context) => {
        if (scopeName === 'positioning:close_actors_facing_each_other') {
          const actorId = context?.actor?.id;
          if (!actorId) {
            return { success: true, value: new Set() };
          }

          const { entityManager } = testEnv;
          const actorEntity = entityManager.getEntityInstance(actorId);
          if (!actorEntity) {
            return { success: true, value: new Set() };
          }

          const closeness =
            actorEntity.components?.['positioning:closeness']?.partners;
          if (!Array.isArray(closeness) || closeness.length === 0) {
            return { success: true, value: new Set() };
          }

          const actorFacingAway =
            actorEntity.components?.['positioning:facing_away']
              ?.facing_away_from || [];

          const validTargets = closeness.reduce((acc, partnerId) => {
            const partner = entityManager.getEntityInstance(partnerId);
            if (!partner) {
              return acc;
            }

            const partnerFacingAway =
              partner.components?.['positioning:facing_away']
                ?.facing_away_from || [];

            // Both must be facing each other (neither facing away)
            const facingEachOther =
              !actorFacingAway.includes(partnerId) &&
              !partnerFacingAway.includes(actorId);

            if (facingEachOther) {
              acc.add(partnerId);
            }

            return acc;
          }, new Set());

          return { success: true, value: validTargets };
        }

        return originalResolve(scopeName, context);
      };
    };
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  // Test cases here
});
```

**Key Testing Patterns**:
- Use `ModTestFixture.forAction()` for setup
- Use `createCloseActors()` helper for scenario setup
- Manually configure scope resolver for `close_actors_facing_each_other`
- Implement scope logic to check both actors facing each other (NOT "or behind" like grab_neck)
- Use `testFixture.testEnv.getAvailableActions()` to verify discovery
- Reference `grab_neck_action_discovery.test.js` for scope resolver implementation

### Test Suite 2: Rule Execution Tests

**File**: `tests/integration/mods/physical-control/force_to_knees_action.test.js`

This test suite verifies that the action executes correctly and the rule processes it properly.

#### Test Cases Required

1. **Action Execution**
   - Performs force to knees action successfully
   - Rule doesn't fire for different actions
   - Handles missing target gracefully (validates with `ActionValidationError`)

2. **Component State Changes**
   - Verify `positioning:kneeling_before` component is added to TARGET (not actor)
   - Verify component stores ACTOR's entity ID (target kneels before actor)
   - Verify target movement is locked
   - Verify no other components are modified on either entity
   - Test with entities who have additional components

3. **Event Generation**
   - Generates correct perceptible event message
   - Perceptible event includes correct location, actor, and target
   - Perception type is `action_target_general`
   - Works with different actor and target names

4. **Message Validation**
   - Generates correct perceptible log message: `"{actor} roughly forces {target} to their knees before {actor}."`
   - Success message matches perceptible event message
   - Name interpolation works correctly
   - Proper repetition of actor name in message

5. **Edge Cases**
   - Test when target already has other positioning components (sitting, lying, etc.)
   - Test rapid succession of force to knees actions
   - Test with namespaced entity IDs (e.g., `p_erotica:character_instance`)

#### Implementation Pattern

Follow the pattern from `kneel_before_action.test.js`:

```javascript
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import { ActionValidationError } from '../../../common/mods/actionExecutionValidator.js';
import forceToKneesRule from '../../../../data/mods/physical-control/rules/handle_force_to_knees.rule.json';
import eventIsActionForceToKnees from '../../../../data/mods/physical-control/conditions/event-is-action-force-to-knees.condition.json';

describe('Physical-Control Mod: Force to Knees Action Integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'physical-control',
      'physical-control:force_to_knees',
      forceToKneesRule,
      eventIsActionForceToKnees
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  // Test cases here
});
```

**Key Testing Patterns**:
- Use `ModTestFixture.forAction()` with explicit rule and condition files
- Use `createCloseActors()` helper for scenario setup
- Use `ModAssertionHelpers` for component assertions:
  - `ModAssertionHelpers.assertComponentAdded()` for verifying kneeling_before on target
  - Verify component data includes correct actor ID
- Use domain matchers for assertions:
  - `testFixture.assertActionSuccess()` for success messages
  - `testFixture.assertPerceptibleEvent()` for event validation
- Use `testFixture.executeAction()` for action execution
- Reference `kneel_before_action.test.js` for component verification patterns

### Testing Documentation References

Follow the guidelines in:
- **`docs/testing/mod-testing-guide.md`**: For Test Module Pattern and configuration
- **`docs/testing/action-discovery-testing-toolkit.md#domain-matchers`**: For using domain-specific Jest matchers

### Additional Test Coverage Recommendations

1. **Positioning Interaction Tests**
   - Test force to knees when target is sitting (should work if facing)
   - Test force to knees when target is bending over (verify forbidden component logic)
   - Test force to knees when target is lying down (verify forbidden component logic)
   - Test force to knees when target is straddling someone (complex positioning)

2. **Closeness Validation Tests**
   - Test with actors who have multiple closeness partners
   - Test with actors at different locations but somehow in closeness
   - Verify closeness relationship is maintained after forcing to knees

3. **Component Lifecycle Tests**
   - Verify kneeling_before component structure matches schema
   - Test with production-like entity IDs (namespace format validation)
   - Verify movement lock is properly applied to target

4. **Integration Tests**
   - Test force to knees followed by other kneeling-related actions
   - Test combining with grab_neck and other physical-control actions
   - Test social consequences or relationship impacts (if implemented)

5. **Error Scenarios**
   - Test with entities that somehow lack required components at execution time
   - Test with invalid entity references
   - Test when target is somehow removed mid-execution

## Implementation Checklist

- [ ] Create `data/mods/physical-control/actions/force_to_knees.action.json`
- [ ] Create `data/mods/physical-control/rules/handle_force_to_knees.rule.json`
- [ ] Create `data/mods/physical-control/conditions/event-is-action-force-to-knees.condition.json`
- [ ] Create `tests/integration/mods/physical-control/force_to_knees_action_discovery.test.js`
- [ ] Create `tests/integration/mods/physical-control/force_to_knees_action.test.js`
- [ ] Verify all tests pass with `npm run test:integration`
- [ ] Run linting with `npx eslint` on modified test files
- [ ] Verify action appears in game UI when conditions are met
- [ ] Test action execution in browser
- [ ] Verify movement lock works correctly in game
- [ ] Test interaction with other positioning actions

## Design Rationale

### Why Different Scope Than grab_neck?

The `grab_neck` action uses `positioning:close_actors_facing_each_other_or_behind_target`, allowing the actor to grab from behind. However, forcing someone to their knees is a more direct, confrontational action that requires:

1. **Face-to-Face Positioning**: You need to see someone's face to force them down
2. **Eye Contact Context**: The intimidation/dominance aspect requires facing each other
3. **Physical Dynamics**: The mechanics of forcing someone down work better when facing them

This is why `force_to_knees` uses `positioning:close_actors_facing_each_other` (mutual facing only).

### Why Forbidden Component for Target?

The action includes `positioning:kneeling_before` in the target's forbidden components because:

1. **Logical Consistency**: You cannot force someone who is already kneeling to "kneel" again
2. **Different from Voluntary**: Unlike `positioning:kneel_before` which allows kneeling before someone already kneeling (chain of reverence), forcing is a hostile action
3. **Game State Clarity**: Prevents redundant state changes and confusing game situations

### Why Add Component to Target, Not Actor?

The kneeling component is added to the **target** entity (the one being forced), not the actor:

1. **Target Kneels**: The target is the one assuming the kneeling position
2. **Component Semantics**: `kneeling_before.entityId` stores WHO they are kneeling before (the actor)
3. **Consistency**: Matches the voluntary `kneel_before` action's component assignment pattern

### Why Lock Target Movement?

The LOCK_MOVEMENT operation targets the **target entity** because:

1. **Target is Restricted**: The target, now kneeling, has their movement restricted
2. **Consistency with Voluntary**: Matches `kneel_before` action's movement lock behavior
3. **Anatomy System Compatibility**: Works with both legacy and anatomy entity systems

### Why "Roughly Forces" in Message?

The message uses "roughly forces" to:

1. **Emphasize Violence**: Distinguishes from gentle or voluntary actions
2. **Set Tone**: Establishes this as an aggressive, hostile action
3. **Player Clarity**: Makes the action's nature immediately clear in narrative
4. **Mod Consistency**: Fits the physical-control mod's thematic approach

### Why Repeat Actor Name in Message?

The message format `"{actor} roughly forces {target} to their knees before {actor}."` repeats the actor name to:

1. **Grammatical Clarity**: "before you" would be from actor's perspective, but perceptible events are third-person
2. **Consistency**: Matches other positioning action message patterns
3. **Narrative Completeness**: Ensures all observers understand the full relationship

## Comparison with Similar Actions

### vs. positioning:kneel_before

| Aspect | force_to_knees | kneel_before |
|--------|----------------|--------------|
| **Mod** | physical-control | positioning |
| **Nature** | Forceful, hostile | Voluntary, respectful |
| **Scope** | close_actors_facing_each_other | actors_in_location_facing |
| **Who Kneels** | Target (forced) | Actor (voluntary) |
| **Component Target** | Target entity | Actor entity |
| **Forbidden (target)** | kneeling_before | kneeling_before, lying_down, bending_over |
| **Message** | "roughly forces" | "kneels before" |
| **Prerequisites** | None | mouth_available check |

### vs. violence:grab_neck

| Aspect | force_to_knees | grab_neck |
|--------|----------------|-----------|
| **Scope** | close_actors_facing_each_other | close_actors_facing_each_other_or_behind_target |
| **Effect** | Adds kneeling component | None (just message) |
| **Movement Lock** | Yes (target) | No |
| **Positioning Change** | Yes (target kneels) | No |
| **Message** | "roughly forces to knees" | "grabs neck" |

## Future Enhancements

Potential future additions to consider:

1. **Resistance System**: Allow target to resist based on strength/attributes
2. **Relationship Impact**: Track social consequences of forcing actions
3. **Success Rate**: Consider actor/target attributes for success probability
4. **Alternative Messages**: Different messages based on relationship or context
5. **Follow-up Actions**: Enable additional violent actions only available when target is kneeling
6. **Witness Reactions**: Special events for observers of forced kneeling
7. **Escape Actions**: Allow target to attempt to stand up or break free
8. **Combo System**: Chain with other physical-control or violence actions for increased effect

## References

- **Similar Actions**:
  - `positioning:kneel_before` (voluntary kneeling)
  - `violence:grab_neck` (violence mod action)
  - `physical-control:push_off` (physical-control mod action with component removal)
- **Components**:
  - `positioning:kneeling_before` (defined in positioning mod)
  - `positioning:closeness` (defined in positioning mod)
- **Scopes**:
  - `positioning:close_actors_facing_each_other`
  - `positioning:actors_in_location_facing`
- **Operations**:
  - `ADD_COMPONENT` (adds component to entity)
  - `LOCK_MOVEMENT` (locks entity movement)
- **Testing Patterns**:
  - See `tests/integration/mods/positioning/kneel_before_action*.test.js`
  - See `tests/integration/mods/violence/grab_neck_*.test.js`
  - See `tests/integration/mods/physical-control/push_off_action*.test.js`
- **Documentation**:
  - `docs/testing/mod-testing-guide.md`
  - `docs/testing/action-discovery-testing-toolkit.md#domain-matchers`
  - `specs/push-off-action.spec.md` (reference for physical-control mod spec structure)

---

**Specification Version**: 1.0
**Author**: Living Narrative Engine Team
**Date**: 2025-10-20
**Status**: Complete - Ready for Implementation
