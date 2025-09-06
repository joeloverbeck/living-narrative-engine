# Grind Ass Against Penis Action Specification

## Status: PROPOSED / NOT IMPLEMENTED

**Note:** This is a specification for a future feature. The files and implementations described below do not currently exist in the production codebase.

## Overview

This specification defines a new intimate action where an actor grinds their ass against a target's penis through their clothing while facing away from them. The action combines positioning mechanics from the positioning mod with intimate interaction patterns from the sex mod, creating a sensual, clothed interaction from behind.

**Note:** This action is the inverse of the existing `sex:press_penis_against_ass_through_clothes` action. While that action has the actor pressing their penis against the target's ass, this new action has the actor grinding their ass against the target's penis, providing the complementary perspective for this intimate interaction.

## Components

### 1. Scope Definition

#### File: `data/mods/sex/scopes/actors_with_covered_penis_im_facing_away_from.scope` _(TO BE CREATED)_

```
sex:actors_with_covered_penis_im_facing_away_from := actor.components.positioning:facing_away.facing_away_from[][{
  "and": [
    {
      "in": [
        { "var": "entity.id" },
        { "var": "actor.components.positioning:closeness.partners" }
      ]
    },
    {"hasPartOfType": [".", "penis"]},
    {"isSocketCovered": [".", "penis"]}
  ]
}]
```

**Scope Purpose:**
This scope combines multiple requirements into a single, reusable query:
- Identifies actors that the current actor is facing away from
- Verifies those actors are in closeness with the current actor
- Confirms they have penis anatomy
- Ensures the penis is covered by clothing

### 2. Action Definition

#### File: `data/mods/sex/actions/grind_ass_against_penis.action.json` _(TO BE CREATED)_

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "sex:grind_ass_against_penis",
  "name": "Grind Ass Against Penis",
  "description": "Grind your ass against the penis of someone behind you through their clothing.",
  "targets": {
    "primary": {
      "scope": "sex:actors_with_covered_penis_im_facing_away_from",
      "placeholder": "primary",
      "description": "Person behind you with covered penis to grind against"
    },
    "secondary": {
      "scope": "clothing:target_topmost_torso_lower_clothing_no_accessories",
      "placeholder": "secondary",
      "description": "Clothing item through which to grind",
      "contextFrom": "primary"
    }
  },
  "required_components": {
    "actor": ["positioning:closeness", "positioning:facing_away"]
  },
  "template": "grind your ass against {primary}'s penis through the {secondary}",
  "visual": {
    "backgroundColor": "#4a148c",
    "textColor": "#e1bee7",
    "hoverBackgroundColor": "#6a1b9a",
    "hoverTextColor": "#f3e5f5"
  }
}
```

**Design Decisions:**

- Uses the new `sex:actors_with_covered_penis_im_facing_away_from` scope for primary target selection, which handles all positioning and anatomy requirements in one place
- Leverages `clothing:target_topmost_torso_lower_clothing_no_accessories` scope with contextFrom for clothing selection
- Requires both `positioning:closeness` and `positioning:facing_away` components on the actor
- No prerequisites needed since the scope already validates anatomy and clothing coverage
- Visual colors match existing intimate actions (same as `rub_penis_over_clothes`) for consistency
- Template provides clear, first-person action description

### 3. Condition Definition

#### File: `data/mods/sex/conditions/event-is-action-grind-ass-against-penis.condition.json` _(TO BE CREATED)_

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "sex:event-is-action-grind-ass-against-penis",
  "description": "Checks if the triggering event is for the 'sex:grind_ass_against_penis' action.",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "sex:grind_ass_against_penis"
    ]
  }
}
```

### 4. Rule Definition

#### File: `data/mods/sex/rules/handle_grind_ass_against_penis.rule.json` _(TO BE CREATED)_

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_grind_ass_against_penis",
  "comment": "Handles the 'sex:grind_ass_against_penis' action. Dispatches descriptive text and ends the turn.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "sex:event-is-action-grind-ass-against-penis"
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
      "type": "GET_NAME",
      "parameters": {
        "entity_ref": "secondary",
        "result_variable": "clothingName"
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
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} rubs their ass sensually against {context.primaryName}'s penis through the {context.clothingName}."
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
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

**Rule Behavior:**

- Retrieves names for actor, primary target, and clothing item
- Queries actor's position for location context
- Sets the perceptible event message: "{actor} rubs their ass sensually against {primary}'s penis through the {secondary}."
- Uses `action_target_general` perception type for visibility
- Dispatches success event and ends turn using standard macro

## Testing Requirements

### 1. Scope Tests

#### File: `tests/integration/mods/sex/actorsWithCoveredPenisImFacingAwayFromScope.integration.test.js` _(TO BE CREATED)_

**Test Scenarios:**

1. **Scope returns correct targets when all conditions are met:**
   - Actor is facing away from target
   - Target is in closeness with actor
   - Target has penis anatomy
   - Target's penis is covered by clothing
   - Verify scope returns the target

2. **Scope excludes targets when facing toward them:**
   - Same setup but actor is facing toward target
   - Verify scope returns empty result

3. **Scope excludes targets not in closeness:**
   - Actor facing away but target not in closeness
   - Verify scope returns empty result

4. **Scope excludes targets without penis anatomy:**
   - All positioning correct but target lacks penis
   - Verify scope returns empty result

5. **Scope excludes targets with uncovered penis:**
   - All conditions met but target's penis is uncovered
   - Verify scope returns empty result

### 2. Action Discovery Tests

#### File: `tests/integration/mods/sex/grindAssAgainstPenisActionDiscovery.integration.test.js` _(TO BE CREATED)_

**Test Scenarios:**

1. **Action appears when scope returns valid targets:**
   - Actor has `positioning:closeness` and `positioning:facing_away` components
   - Target meets all scope requirements (facing away, closeness, covered penis)
   - Verify action appears in available actions list

2. **Action does NOT appear when scope returns no targets:**
   - Setup scenarios where scope conditions fail
   - Verify action is not in available actions list

3. **Correct targets are resolved:**
   - Multiple potential targets in room
   - Verify only targets meeting scope requirements appear as primary
   - Verify correct clothing item appears as secondary

### 3. Rule Execution Tests

#### File: `tests/integration/mods/sex/grindAssAgainstPenis.integration.test.js` _(TO BE CREATED)_

**Test Scenarios:**

1. **Successful action execution:**
   - Setup complete scenario with actor, target, anatomy, and clothing
   - Dispatch action event
   - Verify perceptible event contains correct message
   - Verify action success event is dispatched
   - Verify turn ends

2. **Correct entity name resolution:**
   - Use entities with specific names
   - Verify message uses actual entity names, not IDs

3. **Correct clothing name resolution:**
   - Test with different clothing items (pants, shorts, skirt)
   - Verify correct clothing name appears in message

4. **Location context preservation:**
   - Execute action in specific location
   - Verify perceptible event includes correct location

5. **Target identification:**
   - Verify perceptible event correctly identifies the target entity

### 4. Test Implementation Pattern

Tests should follow the established pattern seen in `rub_penis_over_clothes_action.test.js`:

```javascript
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';

function setupGrindingScenario() {
  // Create room
  const room = new ModEntityBuilder('room1')
    .asRoom('Test Room')
    .build();

  // Create actor facing away
  const actor = new ModEntityBuilder('alice')
    .withName('Alice')
    .atLocation('room1')
    .closeToEntity('bob')
    .withComponent('positioning:facing_away', {
      facing_away_from: ['bob']
    })
    .asActor()
    .build();

  // Create target behind actor with anatomy and clothing
  const target = new ModEntityBuilder('bob')
    .withName('Bob')
    .atLocation('room1')
    .closeToEntity('alice')
    .withBody('groin1')
    .asActor()
    .withComponent('clothing:equipment', {
      equipped: {
        torso_lower: {
          base: ['pants1'],
        },
      },
    })
    .withComponent('clothing:slot_metadata', {
      slotMappings: {
        torso_lower: {
          coveredSockets: ['penis', 'vagina', 'left_hip', 'right_hip'],
          allowedLayers: ['underwear', 'base', 'outer'],
        },
      },
    })
    .build();

  // Create anatomy entities
  const groin = new ModEntityBuilder('groin1')
    .asBodyPart({
      parent: null,
      children: ['penis1'],
      subType: 'groin',
    })
    .build();

  const penis = new ModEntityBuilder('penis1')
    .asBodyPart({
      parent: 'groin1',
      children: [],
      subType: 'penis',
    })
    .build();

  // Create clothing entity
  const pants = new ModEntityBuilder('pants1')
    .withName('pants')
    .build();

  return { room, actor, target, groin, penis, pants };
}
```

## Implementation Notes

1. **Mod Dependencies:** The action requires both `positioning` and `sex` mods to be loaded, as it uses scopes and components from both.

2. **Scope Implementation:** 
   - Creates new scope `sex:actors_with_covered_penis_im_facing_away_from` that combines positioning and anatomy validation
   - Leverages existing `clothing:target_topmost_torso_lower_clothing_no_accessories` for secondary target
   - The new scope handles all complex validation logic in one place, simplifying the action definition

3. **Visual Consistency:** The purple color scheme (#4a148c) matches other intimate actions for UI consistency.

4. **Message Formatting:** The perceptible event message uses sensual language consistent with the mature nature of the content while maintaining clarity about the action being performed.

5. **Component Requirements:** The action requires specific positioning components (`positioning:closeness` and `positioning:facing_away`) to ensure proper spatial relationship between actors.

6. **Anatomy Validation:** Unlike prerequisites which only validate the actor's state, the new scope properly validates the target's anatomy and clothing coverage as part of target selection.

## Validation Checklist

Before implementation, ensure:

- [ ] Scope file follows proper Scope DSL syntax and is placed in `data/mods/sex/scopes/`
- [ ] Action file follows schema: `schema://living-narrative-engine/action.schema.json`
- [ ] Condition file follows schema: `schema://living-narrative-engine/condition.schema.json`
- [ ] Rule file follows schema: `schema://living-narrative-engine/rule.schema.json`
- [ ] All entity references use correct format (e.g., "actor", "primary", "secondary")
- [ ] Visual colors are valid hex codes
- [ ] Template string uses correct placeholder syntax
- [ ] Scope correctly combines positioning and anatomy validation logic
- [ ] Rule actions follow established operation types
- [ ] Test files follow project testing conventions
- [ ] All files are placed in correct mod directories

## Future Enhancements

Potential future improvements could include:

1. **Arousal System Integration:** If an arousal system is implemented, this action could increase arousal for both participants.

2. **Clothing Damage:** Vigorous grinding could potentially damage or displace clothing items.

3. **Position Transitions:** The action could lead to other position changes or intimate escalations.

4. **Sound Effects:** Audio feedback could enhance the immersive experience.

5. **Animation Support:** If animation system is added, this action would benefit from visual feedback.

---

_This specification provides complete implementation guidelines for the grind ass against penis action. Follow these requirements to ensure consistency with existing game mechanics and testing standards._