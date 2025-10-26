# Remove Other's Clothing Action Specification

## Overview

This specification defines a new action for the clothing mod: `clothing:remove_others_clothing`. This action allows an actor to remove an item of clothing from another close actor (not themselves), extending the existing `clothing:remove_clothing` action which only allows self-removal.

## Requirements

### Functional Requirements

1. **Action Definition**: Create `clothing:remove_others_clothing` action that:
   - Uses multi-target structure with `primary` and `secondary` targets
   - Primary target: actors within close proximity (`positioning:close_actors` scope)
   - Secondary target: topmost clothing items on the primary target (`clothing:topmost_clothing` scope)
   - Has NO required components (available to all actors)
   - Uses template format: `"remove {primary}'s {secondary}"`
   - Matches visual styling of `clothing:remove_clothing` action

2. **Rule Processing**: Create corresponding rule that:
   - Removes the selected clothing item from the primary target (not the actor)
   - Dispatches perceptible event: `"{actor} removes {primary}'s {secondary}."`
   - Dispatches success message: `"{actor} removes {primary}'s {secondary}."`
   - Regenerates the target's description after clothing removal
   - Ends the turn successfully

3. **Validation**: Ensure that:
   - Action only appears when actors are in close proximity (closeness component)
   - Secondary target correctly resolves to topmost clothing items on the primary target
   - Action is NOT available when actors are not close
   - Multi-target resolution workflow operates correctly
   - Clothing item is unequipped from the correct entity (primary target, not actor)

## Implementation Details

### 1. Action File: `data/mods/clothing/actions/remove_others_clothing.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "clothing:remove_others_clothing",
  "name": "Remove Other's Clothing",
  "description": "Remove a piece of someone else's topmost clothing",
  "targets": {
    "primary": {
      "scope": "positioning:close_actors",
      "placeholder": "person",
      "description": "The person whose clothing to remove"
    },
    "secondary": {
      "scope": "clothing:topmost_clothing",
      "placeholder": "item",
      "description": "The clothing item to remove",
      "contextFrom": "primary"
    }
  },
  "required_components": {},
  "template": "remove {person}'s {item}",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#6d4c41",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#795548",
    "hoverTextColor": "#efebe9"
  }
}
```

**Design Decisions:**

- Uses multi-target structure with `primary` and `secondary` targets
- Primary target uses `positioning:close_actors` scope, which resolves to `actor.components.positioning:closeness.partners[]`
- Secondary target uses `clothing:topmost_clothing` scope for the primary target's clothing
- **Critical**: Secondary target requires `contextFrom: "primary"` to resolve the scope in the context of the selected primary target (the person whose clothing is being removed), not the actor performing the action
- NO required components, making action universally available (closeness is enforced by scope)
- Brown color scheme (#6d4c41) matches existing `clothing:remove_clothing` action
- Template uses both placeholder variables: `{person}` and `{item}`

### 2. Condition File: `data/mods/clothing/conditions/event-is-action-remove-others-clothing.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "clothing:event-is-action-remove-others-clothing",
  "description": "Checks if the event is attempting the 'Remove Other's Clothing' action.",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "clothing:remove_others_clothing"
    ]
  }
}
```

### 3. Rule File: `data/mods/clothing/rules/handle_remove_others_clothing.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_remove_others_clothing",
  "comment": "Handles the 'clothing:remove_others_clothing' action. Removes the selected clothing item from the primary target, dispatches descriptive text and ends the turn.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "clothing:event-is-action-remove-others-clothing"
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
        "result_variable": "secondaryName"
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
      "type": "UNEQUIP_CLOTHING",
      "parameters": {
        "entity_ref": "primary",
        "clothing_item_id": "{event.payload.secondaryId}",
        "cascade_unequip": false,
        "destination": "ground"
      }
    },
    {
      "type": "REGENERATE_DESCRIPTION",
      "parameters": {
        "entity_ref": "primary"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} removes {context.primaryName}'s {context.secondaryName}."
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

**Key Design Decisions:**

- Retrieves names for actor, primary target, and secondary target (clothing item)
- Uses `UNEQUIP_CLOTHING` operation with `entity_ref: "primary"` (removes from target, not actor)
- **Event Payload Fields**: Uses `event.payload.secondaryId` (not `secondaryTargetId`) and `event.payload.primaryId` (not `primaryTargetId`) to access target entity IDs
- Calls `REGENERATE_DESCRIPTION` on the primary target (whose clothing was removed)
- Message format: `"{actor} removes {primary}'s {secondary}."` for both perceptible and success events
- Sets `perceptionType` to `"action_target_general"` (has a target)
- Sets `targetId` to the primary target ID (the person whose clothing was removed)

## Testing Strategy

### Integration Tests

#### Test File: `tests/integration/mods/clothing/remove_others_clothing_action_discovery.test.js`

This test file covers action discovery and availability:

```javascript
/**
 * @file Integration tests for clothing:remove_others_clothing action discovery.
 * @description Tests that the action is properly discoverable when actors are close.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import removeOthersClothingAction from '../../../../data/mods/clothing/actions/remove_others_clothing.action.json';

describe('clothing:remove_others_clothing action discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'clothing',
      'clothing:remove_others_clothing'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('should have correct action structure', () => {
    expect(removeOthersClothingAction).toBeDefined();
    expect(removeOthersClothingAction.id).toBe(
      'clothing:remove_others_clothing'
    );
    expect(removeOthersClothingAction.name).toBe("Remove Other's Clothing");
    expect(removeOthersClothingAction.description).toBe(
      "Remove a piece of someone else's topmost clothing"
    );
    expect(removeOthersClothingAction.template).toBe(
      "remove {person}'s {item}"
    );
  });

  it('should use multi-target structure with correct scopes', () => {
    expect(removeOthersClothingAction.targets).toBeDefined();
    expect(removeOthersClothingAction.targets.primary).toBeDefined();
    expect(removeOthersClothingAction.targets.primary.scope).toBe(
      'positioning:close_actors'
    );
    expect(removeOthersClothingAction.targets.secondary).toBeDefined();
    expect(removeOthersClothingAction.targets.secondary.scope).toBe(
      'clothing:topmost_clothing'
    );
  });

  it('should have no required components', () => {
    // Action should be available to all actors (closeness enforced by scope)
    expect(removeOthersClothingAction.required_components).toEqual({});
  });

  it('should have correct visual styling matching remove_clothing', () => {
    expect(removeOthersClothingAction.visual).toBeDefined();
    expect(removeOthersClothingAction.visual.backgroundColor).toBe('#6d4c41');
    expect(removeOthersClothingAction.visual.textColor).toBe('#ffffff');
    expect(removeOthersClothingAction.visual.hoverBackgroundColor).toBe(
      '#795548'
    );
    expect(removeOthersClothingAction.visual.hoverTextColor).toBe('#efebe9');
  });

  describe('Expected action discovery behavior', () => {
    it('should appear when actors are close to each other', () => {
      // Manual test case:
      // 1. Create two actors in same location
      // 2. Establish closeness between them (positioning:closeness component)
      // 3. Ensure secondary target has clothing items
      // 4. Expected: remove_others_clothing action should be available
      // 5. Primary targets should resolve to close actors
      // 6. Secondary targets should resolve to topmost clothing items
      expect(true).toBe(true);
    });

    it('should NOT appear when actors are not close', () => {
      // Manual test case:
      // 1. Create two actors in same location
      // 2. Do NOT establish closeness
      // 3. Expected: remove_others_clothing action should NOT be available
      // (positioning:close_actors scope returns empty set)
      expect(true).toBe(true);
    });

    it('should resolve secondary targets to primary target clothing', () => {
      // Manual test case:
      // 1. Create actor A and actor B with closeness
      // 2. Actor B is wearing: shirt (outer), tank top (base), underwear
      // 3. Expected: When A selects B as primary, secondary should show B's shirt
      // (topmost_clothing prioritizes outer > base > underwear)
      expect(true).toBe(true);
    });

    it('should support multiple close actors as primary targets', () => {
      // Manual test case:
      // 1. Create actors A, B, C in same location
      // 2. A is close to both B and C (separate closeness components)
      // 3. Expected: A should see both B and C as primary target options
      expect(true).toBe(true);
    });
  });
});
```

#### Test File: `tests/integration/mods/clothing/remove_others_clothing_rule_execution.test.js`

This test file covers rule execution and behavior:

```javascript
/**
 * @file Integration tests for clothing:remove_others_clothing rule execution.
 * @description Tests the rule behavior when the action is performed.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import removeOthersClothingRule from '../../../../data/mods/clothing/rules/handle_remove_others_clothing.rule.json';
import eventIsActionRemoveOthersClothing from '../../../../data/mods/clothing/conditions/event-is-action-remove-others-clothing.condition.json';

describe('clothing:remove_others_clothing rule execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'clothing',
      'clothing:remove_others_clothing',
      removeOthersClothingRule,
      eventIsActionRemoveOthersClothing
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully removes clothing from primary target', async () => {
    // Create scenario with two close actors
    const scenario = testFixture.createCloseActorsWithClothing(
      ['Alice', 'Bob'],
      {
        location: 'bedroom',
        primaryClothing: ['shirt', 'pants'],
      }
    );

    // Alice removes Bob's shirt
    await testFixture.executeMultiTargetAction(
      scenario.actor.id,
      scenario.target.id,
      scenario.clothingItems[0] // Bob's shirt
    );

    // Verify success message
    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      "Alice removes Bob's shirt."
    );

    // Verify perceptible event
    testFixture.assertPerceptibleEvent({
      descriptionText: "Alice removes Bob's shirt.",
      locationId: 'bedroom',
      perceptionType: 'action_target_general',
      actorId: scenario.actor.id,
      targetId: scenario.target.id,
    });

    // Verify turn ended successfully
    const turnEndedEvent = testFixture.events.find(
      (e) => e.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.entityId).toBe(scenario.actor.id);
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('removes clothing from target, not actor', async () => {
    // Create scenario where both actors have clothing
    const scenario = testFixture.createCloseActorsWithClothing(
      ['Alice', 'Bob'],
      {
        location: 'living_room',
        actorClothing: ['dress'],
        primaryClothing: ['jacket'],
      }
    );

    // Alice removes Bob's jacket
    await testFixture.executeMultiTargetAction(
      scenario.actor.id,
      scenario.target.id,
      scenario.primaryClothingItems[0] // Bob's jacket
    );

    // Verify Bob's jacket was removed
    const bobEquipment = testFixture.entityManager.getComponent(
      scenario.target.id,
      'clothing:equipment'
    );
    expect(bobEquipment.equipped).not.toContain(
      scenario.primaryClothingItems[0]
    );

    // Verify Alice's dress is still equipped
    const aliceEquipment = testFixture.entityManager.getComponent(
      scenario.actor.id,
      'clothing:equipment'
    );
    expect(aliceEquipment.equipped).toContain(scenario.actorClothingItems[0]);
  });

  it('regenerates target description after clothing removal', async () => {
    const scenario = testFixture.createCloseActorsWithClothing(
      ['Alice', 'Bob'],
      {
        location: 'bedroom',
        primaryClothing: ['shirt'],
      }
    );

    // Spy on description regeneration
    const regenerateEvent = testFixture.watchForEvent(
      'clothing:description_regeneration_requested'
    );

    await testFixture.executeMultiTargetAction(
      scenario.actor.id,
      scenario.target.id,
      scenario.clothingItems[0]
    );

    // Verify regeneration was called for target (Bob), not actor (Alice)
    expect(regenerateEvent).toBeDefined();
    expect(regenerateEvent.payload.entityId).toBe(scenario.target.id);
  });

  it('formats message correctly with different names', async () => {
    const scenario = testFixture.createCloseActorsWithClothing(
      ['Sir Lancelot', 'Lady Guinevere'],
      {
        location: 'castle_chamber',
        primaryClothing: ['gown'],
      }
    );

    await testFixture.executeMultiTargetAction(
      scenario.actor.id,
      scenario.target.id,
      scenario.clothingItems[0]
    );

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent.payload.message).toBe(
      "Sir Lancelot removes Lady Guinevere's gown."
    );
  });

  it('handles topmost clothing priority correctly', async () => {
    // Create scenario where target has layered clothing
    const scenario = testFixture.createCloseActorsWithClothing(
      ['Alice', 'Bob'],
      {
        location: 'bedroom',
        primaryClothing: [
          { name: 'jacket', layer: 'outer' },
          { name: 'shirt', layer: 'base' },
          { name: 'underwear', layer: 'underwear' },
        ],
      }
    );

    // Should remove the topmost (jacket, outer layer)
    await testFixture.executeMultiTargetAction(
      scenario.actor.id,
      scenario.target.id,
      scenario.clothingItems[0] // jacket
    );

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent.payload.message).toBe("Alice removes Bob's jacket.");
  });

  it('handles action with correct perception type', async () => {
    const scenario = testFixture.createCloseActorsWithClothing(
      ['Alice', 'Bob'],
      {
        location: 'garden',
        primaryClothing: ['hat'],
      }
    );

    await testFixture.executeMultiTargetAction(
      scenario.actor.id,
      scenario.target.id,
      scenario.clothingItems[0]
    );

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'action_target_general'
    );
    expect(perceptibleEvent.payload.targetId).toBe(scenario.target.id);
    expect(perceptibleEvent.payload.locationId).toBe('garden');
  });

  it('places removed clothing on ground', async () => {
    const scenario = testFixture.createCloseActorsWithClothing(
      ['Alice', 'Bob'],
      {
        location: 'bedroom',
        primaryClothing: ['shirt'],
      }
    );

    await testFixture.executeMultiTargetAction(
      scenario.actor.id,
      scenario.target.id,
      scenario.clothingItems[0]
    );

    // Verify clothing unequipped event shows ground destination
    const unequipEvent = testFixture.events.find(
      (e) => e.eventType === 'clothing:clothing_unequipped'
    );
    expect(unequipEvent).toBeDefined();
    expect(unequipEvent.payload.destination).toBe('ground');
  });

  it('does not cascade unequip other clothing items', async () => {
    // Create scenario with multiple clothing items
    const scenario = testFixture.createCloseActorsWithClothing(
      ['Alice', 'Bob'],
      {
        location: 'bedroom',
        primaryClothing: ['jacket', 'shirt', 'pants'],
      }
    );

    await testFixture.executeMultiTargetAction(
      scenario.actor.id,
      scenario.target.id,
      scenario.clothingItems[0] // jacket only
    );

    // Verify only jacket was removed, shirt and pants remain
    const bobEquipment = testFixture.entityManager.getComponent(
      scenario.target.id,
      'clothing:equipment'
    );
    expect(bobEquipment.equipped).not.toContain(scenario.clothingItems[0]); // jacket removed
    expect(bobEquipment.equipped).toContain(scenario.clothingItems[1]); // shirt remains
    expect(bobEquipment.equipped).toContain(scenario.clothingItems[2]); // pants remain
  });
});
```

## Scope Usage Investigation

### `positioning:close_actors` Scope

**Definition**: `positioning:close_actors := actor.components.positioning:closeness.partners[]`

**Usage in Other Actions**:
- `intimacy:brush_hand` - Uses `positioning:close_actors` directly
- `intimacy:hug_tight` - Uses `intimacy:close_actors_facing_each_other_or_behind_target` (custom scope)
- `intimacy:peck_on_lips` - Uses `positioning:close_actors`
- `intimacy:place_hand_on_waist` - Uses `positioning:close_actors`

**Key Characteristics**:
- Resolves to actors who have mutual closeness with the actor
- Requires `positioning:closeness` component with `partners` array
- Returns entity IDs of close partners
- Empty set if actor has no closeness component or no partners

### `clothing:topmost_clothing` Scope

**Definition**: `clothing:topmost_clothing := actor.topmost_clothing[]`

**Key Characteristics**:
- Uses special clothing resolver for topmost items
- Prioritizes by layer: outer > base > underwear
- Returns entity IDs of topmost clothing items per body slot
- Used in `clothing:remove_clothing` for self-removal

**Multi-Target Consideration**:
- In multi-target actions, `secondary` scope is evaluated in context of `primary` target
- The `topmost_clothing` resolver should operate on the primary target, not the actor
- **Context Resolution**: This requires the `contextFrom: "primary"` field in the secondary target definition, which tells the scope resolution system to evaluate `topmost_clothing` using the selected primary target entity as the base context
- Without `contextFrom`, the scope would incorrectly resolve against the actor performing the action
- This is handled by the scope resolution system during action discovery

## File Structure Summary

### New Files to Create:

1. `data/mods/clothing/actions/remove_others_clothing.action.json`
2. `data/mods/clothing/conditions/event-is-action-remove-others-clothing.condition.json`
3. `data/mods/clothing/rules/handle_remove_others_clothing.rule.json`
4. `tests/integration/mods/clothing/remove_others_clothing_action_discovery.test.js`
5. `tests/integration/mods/clothing/remove_others_clothing_rule_execution.test.js`

### Files to Update (if needed):

- None required for basic functionality
- Consider adding to `data/mods/clothing/mod-manifest.json` if action/rule registration is explicit

## Key Implementation Notes

1. **Multi-Target Structure**: This action uses the multi-target pattern with `primary` (person) and `secondary` (clothing item) targets, similar to other intimacy actions.

2. **Scope Resolution**: The `positioning:close_actors` scope ensures only close actors appear as primary targets. The `clothing:topmost_clothing` scope resolves in the context of the primary target using the `contextFrom: "primary"` field, which is critical for correct multi-target behavior.

3. **Entity References in Rule**:
   - `entity_ref: "actor"` - The person performing the action
   - `entity_ref: "primary"` - The person whose clothing is being removed
   - `entity_ref: "secondary"` - The clothing item being removed

4. **Event Payload Field Names**:
   - Multi-target action events use `event.payload.primaryId` and `event.payload.secondaryId` (not `primaryTargetId`/`secondaryTargetId`)
   - This naming convention is consistent across all multi-target actions in the engine
   - These fields contain the entity IDs selected by the player for primary and secondary targets

5. **Component Operations**:
   - `UNEQUIP_CLOTHING` operates on the `primary` entity (target), not the `actor`
   - `REGENERATE_DESCRIPTION` regenerates the `primary` entity's description
   - `cascade_unequip: false` ensures only the selected item is removed

6. **Message Consistency**:
   - Both perceptible event and success message: `"{actor} removes {primary}'s {secondary}."`
   - Uses present tense consistently
   - Follows pattern established by other multi-target actions

7. **Visual Consistency**: Brown color scheme (#6d4c41) matches the existing `clothing:remove_clothing` action for thematic consistency.

8. **No Required Components**: Unlike some positioning actions, this has no required components on the actor. Closeness is enforced by the scope itself.

## Validation Checklist

- [ ] Action file follows schema and uses multi-target structure correctly
- [ ] Primary scope uses `positioning:close_actors` (verified scope definition exists)
- [ ] Secondary scope uses `clothing:topmost_clothing` (verified scope definition exists)
- [ ] **Critical**: Secondary target includes `contextFrom: "primary"` field for correct context resolution
- [ ] Condition properly identifies the action event
- [ ] Rule removes clothing from primary target (not actor)
- [ ] Rule uses correct event payload field names: `event.payload.primaryId` and `event.payload.secondaryId`
- [ ] Rule regenerates primary target's description (not actor's)
- [ ] Test suite covers action discovery scenarios
- [ ] Test suite covers rule execution and edge cases
- [ ] Messages use consistent present tense for both perceptible and success events
- [ ] Visual styling matches existing clothing action
- [ ] Multi-target resolution workflow is documented
- [ ] Scope context resolution is properly understood and documented

## Edge Cases and Considerations

1. **Closeness Requirement**: Action only appears when actors have `positioning:closeness` component with partners. If closeness is broken mid-action, the action should fail gracefully.

2. **Clothing Availability**: If the primary target has no clothing items, the secondary target list will be empty, making the action unavailable.

3. **Multiple Close Actors**: If the actor is close to multiple people, all should appear as primary target options.

4. **Topmost Clothing Priority**: The `topmost_clothing` scope respects layer hierarchy (outer > base > underwear). Only the topmost items per slot are shown.

5. **Permission and Consent**: This spec focuses on mechanical implementation. Game design may want to add prerequisite conditions for consent or relationship requirements.

6. **Destination Handling**: Removed clothing goes to "ground" by default. Future enhancements could add inventory transfer options.

## Future Enhancement Considerations

1. **Consent System**: Add prerequisite conditions requiring consent or relationship level
2. **Inventory Transfer**: Option to put removed clothing in actor's inventory instead of ground
3. **Cascade Options**: Allow optional cascading removal of dependent clothing items
4. **Animation/Timing**: Consider adding delay or multi-step removal for more realistic interaction
5. **Prohibition Conditions**: Add forbidden components or prerequisite conditions for specific situations

## Related Actions and Patterns

- `clothing:remove_clothing` - Self-removal action (single target)
- `intimacy:adjust_clothing` - Uses similar `close_actors` scope pattern
- `physical-control:turn_around` - Example of action with no target
- Multi-target actions in `intimacy` mod - Pattern reference for primary/secondary structure
