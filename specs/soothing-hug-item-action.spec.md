# Soothing Hug Item Action Specification

## Overview

Add a new comforting interaction where actors can hug items like plush toys, stuffed animals, or pillows for emotional comfort. This action fits within the **items** mod because:

- The items mod handles all item-based interactions including consumable, portable, and interactive item behaviors.
- Existing item actions focus on practical item usage (e.g., `apply_lipstick`, `read_item`, `examine_item`), and this extends the pattern to emotional/comfort item interactions.
- The comforting nature of the action is driven by item properties (marker component) rather than character relationships, aligning with the items mod's scope.

Therefore, implement the new action and supporting files under `data/mods/items/` while using the existing `items:examinable_items` scope for target resolution to search both the actor's inventory and items at the current location.

## Component Requirements

Create `data/mods/items/components/allows_soothing_hug.component.json` as a marker component identifying items that provide emotional comfort when hugged:

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "items:allows_soothing_hug",
  "description": "Marker component identifying comfort items (plush toys, stuffed animals, pillows, etc.) that can be hugged for emotional soothing.",
  "dataSchema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}
```

**Design Rationale**:
- Follows the same marker pattern as `items:can_apply_lipstick` (no data properties)
- Modders add this component to any comfort item they create
- Component name clearly indicates purpose: items that "allow soothing hug" action

**Example Items for Modders**:
- Plush toys
- Stuffed animals
- Comfort pillows
- Teddy bears
- Security blankets (if implemented as holdable items)

## Action Requirements

Create `data/mods/items/actions/hug_item_for_comfort.action.json` following existing item action patterns:

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "items:hug_item_for_comfort",
  "name": "Hug Item for Comfort",
  "description": "Hug a comforting item like a plush toy or pillow to feel calmer.",
  "generateCombinations": true,
  "targets": {
    "primary": {
      "scope": "items:examinable_items",
      "placeholder": "item",
      "description": "Comfort item to hug"
    }
  },
  "required_components": {
    "primary": [
      "items:item",
      "items:allows_soothing_hug"
    ]
  },
  "prerequisites": [],
  "template": "hug {item} to soothe yourself"
}
```

**Key Design Decisions**:
- **Action ID**: `items:hug_item_for_comfort` - descriptive and follows mod naming convention
- **Scope**: `items:examinable_items` - searches both inventory and location items
- **Required Components**:
  - `items:item` - ensures target is a valid item entity
  - `items:allows_soothing_hug` - marker component restricts to comfort items only
- **Template**: `"hug {item} to soothe yourself"` - matches user's specification exactly
- **generateCombinations**: `true` - creates individual action instances for each valid target

**Scope Behavior** (`items:examinable_items`):
- Searches actor's inventory items (via `items:inventory` component)
- Searches items at actor's current location (via `core:position` matching)
- Returns only items with required components
- Automatically filters out items lacking `items:allows_soothing_hug`

Add the action to the `actions` array inside `data/mods/items/mod-manifest.json`.

## Condition Requirements

Create `data/mods/items/conditions/event-is-action-hug-item-for-comfort.condition.json` following the standard condition pattern:

**Critical**: Condition files use **hyphens**, not underscores, even though the action uses underscores in its ID.

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "items:event-is-action-hug-item-for-comfort",
  "description": "Checks if the event represents the hug item for comfort action.",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "items:hug_item_for_comfort"
    ]
  }
}
```

**Structure Notes**:
- File naming uses **hyphens**: `event-is-action-hug-item-for-comfort.condition.json`
- Condition ID uses **hyphens**: `items:event-is-action-hug-item-for-comfort`
- Checks for the action ID in the event payload using JSON Logic
- Returns `true` only when the event is an attempt to execute this specific action

Include the new condition filename in the manifest's `conditions` array.

## Rule Requirements

Create `data/mods/items/rules/handle_hug_item_for_comfort.rule.json` using the standard items rule pattern:

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_hug_item_for_comfort",
  "comment": "Handles the hug_item_for_comfort action by broadcasting a comforting message and ending the turn.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "items:event-is-action-hug-item-for-comfort"
  },
  "actions": [
    {
      "type": "GET_NAME",
      "comment": "Capture the actor name for messaging",
      "parameters": {
        "entity_ref": "actor",
        "result_variable": "actorName"
      }
    },
    {
      "type": "GET_NAME",
      "comment": "Capture the comfort item name",
      "parameters": {
        "entity_ref": "target",
        "result_variable": "itemName"
      }
    },
    {
      "type": "QUERY_COMPONENT",
      "comment": "Locate the actor for perception routing",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "core:position",
        "result_variable": "actorPosition"
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Compose the soothing hug message",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} hugs {context.itemName} and feels calmer."
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Use the item use perception type",
      "parameters": {
        "variable_name": "perceptionType",
        "value": "item_use"
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Provide the location for the perceptible event",
      "parameters": {
        "variable_name": "locationId",
        "value": "{context.actorPosition.locationId}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Identify the comfort item as the target",
      "parameters": {
        "variable_name": "targetId",
        "value": "{event.payload.targetId}"
      }
    },
    {
      "comment": "Emit perception, notify success, and end the turn",
      "macro": "core:logSuccessAndEndTurn"
    }
  ]
}
```

**Rule Design Notes**:
- **rule_id**: `handle_hug_item_for_comfort` - matches file naming convention (underscores)
- **event_type**: `core:attempt_action` - triggered when action is attempted
- **Condition Reference**: Uses the hyphened condition ID
- **Message**: `"{context.actorName} hugs {context.itemName} and feels calmer."` - matches specification exactly
- **Perception Type**: `item_use` - consistent with other item interaction actions
- **Macro**: `core:logSuccessAndEndTurn` - standard pattern for simple success actions

**Critical**: Both the successful action message and the perceptible event message use the identical sentence to ensure narrative consistency across different event types.

Add the rule filename to the manifest's `rules` array.

## Testing Specification

Implement comprehensive integration tests alongside existing items tests to cover both discoverability and rule behavior. Reference the mod testing guide in `docs/testing/mod-testing-guide.md` for detailed patterns and best practices.

### 1. Action Discovery Test

Create `tests/integration/mods/items/hugItemForComfortActionDiscovery.test.js` using `ModTestFixture.forAction('items', 'items:hug_item_for_comfort')`.

**Test File Structure**:
```javascript
/**
 * @file Integration tests for the items:hug_item_for_comfort action definition.
 * @description Tests that the hug_item_for_comfort action is properly defined and discoverable only for items with allows_soothing_hug component.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import hugItemForComfortAction from '../../../../data/mods/items/actions/hug_item_for_comfort.action.json' assert { type: 'json' };

const ACTION_ID = 'items:hug_item_for_comfort';

describe('items:hug_item_for_comfort action definition', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('items', ACTION_ID);

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([hugItemForComfortAction]);
    };
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  // Test suites below...
});
```

**Required Test Suites**:

#### Suite 1: Action Structure Validation

Validate the action JSON structure (id, template, targets, required components):

```javascript
it('should have correct action structure', () => {
  expect(hugItemForComfortAction).toBeDefined();
  expect(hugItemForComfortAction.id).toBe('items:hug_item_for_comfort');
  expect(hugItemForComfortAction.name).toBe('Hug Item for Comfort');
  expect(hugItemForComfortAction.description).toBe(
    'Hug a comforting item like a plush toy or pillow to feel calmer.'
  );
  expect(hugItemForComfortAction.template).toBe('hug {item} to soothe yourself');
});

it('should use examinable_items scope for primary targets', () => {
  expect(hugItemForComfortAction.targets).toBeDefined();
  expect(hugItemForComfortAction.targets.primary).toBeDefined();
  expect(hugItemForComfortAction.targets.primary.scope).toBe(
    'items:examinable_items'
  );
  expect(hugItemForComfortAction.targets.primary.placeholder).toBe('item');
  expect(hugItemForComfortAction.targets.primary.description).toBe(
    'Comfort item to hug'
  );
});

it('should require item and allows_soothing_hug components on primary target', () => {
  expect(hugItemForComfortAction.required_components).toBeDefined();
  expect(hugItemForComfortAction.required_components.primary).toEqual([
    'items:item',
    'items:allows_soothing_hug',
  ]);
});

it('should have empty prerequisites array', () => {
  expect(Array.isArray(hugItemForComfortAction.prerequisites)).toBe(true);
  expect(hugItemForComfortAction.prerequisites).toHaveLength(0);
});
```

#### Suite 2: Positive Discovery Scenarios

Test cases verifying the action appears when requirements are met:

```javascript
describe('Action discovery behavior', () => {
  it('should appear when actor inventory contains a comfort item', () => {
    const room = ModEntityScenarios.createRoom('bedroom', 'Bedroom');

    const actor = new ModEntityBuilder('actor1')
      .withName('Alex')
      .atLocation('bedroom')
      .asActor()
      .withComponent('items:inventory', {
        items: ['plush_toy_inventory'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .build();

    const plushToy = new ModEntityBuilder('plush_toy_inventory')
      .withName('Fluffy Bear')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('items:allows_soothing_hug', {})
      .build();

    testFixture.reset([room, actor, plushToy]);
    configureActionDiscovery();

    const availableActions = testFixture.testEnv.getAvailableActions('actor1');
    const hugActions = availableActions.filter(
      (action) => action.id === ACTION_ID
    );

    expect(hugActions.length).toBeGreaterThan(0);
  });

  it('should appear when a comfort item is at the actor location', () => {
    const room = ModEntityScenarios.createRoom('library', 'Library');

    const actor = new ModEntityBuilder('actor1')
      .withName('Morgan')
      .atLocation('library')
      .asActor()
      .build();

    const comfortPillow = new ModEntityBuilder('comfort_pillow_location')
      .withName('Soft Pillow')
      .atLocation('library')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('items:allows_soothing_hug', {})
      .build();

    testFixture.reset([room, actor, comfortPillow]);
    configureActionDiscovery();

    const availableActions = testFixture.testEnv.getAvailableActions('actor1');
    const hugActions = availableActions.filter(
      (action) => action.id === ACTION_ID
    );

    expect(hugActions.length).toBeGreaterThan(0);
  });

  it('should appear when inventory stores comfort items as item references', () => {
    const room = ModEntityScenarios.createRoom('nursery', 'Nursery');

    const actor = new ModEntityBuilder('actor2')
      .withName('Jamie')
      .atLocation('nursery')
      .asActor()
      .withComponent('items:inventory', {
        items: [
          {
            itemId: 'stuffed_animal_reference',
          },
        ],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .build();

    const stuffedAnimal = new ModEntityBuilder('stuffed_animal_reference')
      .withName('Bunny Companion')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('items:allows_soothing_hug', {})
      .build();

    testFixture.reset([room, actor, stuffedAnimal]);
    configureActionDiscovery();

    const availableActions = testFixture.testEnv.getAvailableActions('actor2');
    const hugActions = availableActions.filter(
      (action) => action.id === ACTION_ID
    );

    expect(hugActions.length).toBeGreaterThan(0);
  });

  it('should appear when inventory mixes comfort items and non-comfort items', () => {
    const room = ModEntityScenarios.createRoom('room_mixed', 'Mixed Room');

    const actor = new ModEntityBuilder('actor_mixed')
      .withName('Casey')
      .atLocation('room_mixed')
      .asActor()
      .withComponent('items:inventory', {
        items: ['comfort_item_mixed', 'non_comfort_item_mixed'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .build();

    const comfortItem = new ModEntityBuilder('comfort_item_mixed')
      .withName('Cozy Cushion')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('items:allows_soothing_hug', {})
      .build();

    const nonComfortItem = new ModEntityBuilder('non_comfort_item_mixed')
      .withName('Metal Wrench')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withDescription('A heavy metal tool.')
      .build();

    testFixture.reset([room, actor, comfortItem, nonComfortItem]);
    configureActionDiscovery();

    const availableActions = testFixture.testEnv.getAvailableActions('actor_mixed');
    const hugActions = availableActions.filter(
      (action) => action.id === ACTION_ID
    );

    expect(hugActions.length).toBeGreaterThan(0);
  });
});
```

#### Suite 3: Negative Discovery Scenarios

Test cases verifying the action is properly blocked when requirements aren't met:

```javascript
describe('Action blocking scenarios', () => {
  it('should not appear when no comfort items are present', () => {
    const room = ModEntityScenarios.createRoom('empty_room', 'Empty Room');

    const actor = new ModEntityBuilder('actor1')
      .withName('Taylor')
      .atLocation('empty_room')
      .asActor()
      .withComponent('items:inventory', {
        items: [],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .build();

    testFixture.reset([room, actor]);
    configureActionDiscovery();

    const availableActions = testFixture.testEnv.getAvailableActions('actor1');
    const hugActions = availableActions.filter(
      (action) => action.id === ACTION_ID
    );

    expect(hugActions.length).toBe(0);
  });

  it('should not appear for items lacking the allows_soothing_hug component', () => {
    const room = ModEntityScenarios.createRoom('workshop', 'Workshop');

    const actor = new ModEntityBuilder('actor1')
      .withName('Jordan')
      .atLocation('workshop')
      .asActor()
      .withComponent('items:inventory', {
        items: ['non_comfort_item'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .build();

    const nonComfortItem = new ModEntityBuilder('non_comfort_item')
      .withName('Hammer')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withDescription('A sturdy hammer for construction.')
      .build();

    testFixture.reset([room, actor, nonComfortItem]);
    configureActionDiscovery();

    const availableActions = testFixture.testEnv.getAvailableActions('actor1');
    const hugActions = availableActions.filter(
      (action) => action.id === ACTION_ID
    );

    expect(hugActions.length).toBe(0);
  });

  it('should not appear for comfort items located elsewhere', () => {
    const roomA = ModEntityScenarios.createRoom('room_a', 'Room A');
    const roomB = ModEntityScenarios.createRoom('room_b', 'Room B');

    const actor = new ModEntityBuilder('actor1')
      .withName('Riley')
      .atLocation('room_a')
      .asActor()
      .build();

    const distantComfortItem = new ModEntityBuilder('distant_comfort_item')
      .withName('Distant Teddy')
      .atLocation('room_b')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('items:allows_soothing_hug', {})
      .build();

    testFixture.reset([roomA, roomB, actor, distantComfortItem]);
    configureActionDiscovery();

    const availableActions = testFixture.testEnv.getAvailableActions('actor1');
    const hugActions = availableActions.filter(
      (action) => action.id === ACTION_ID
    );

    expect(hugActions.length).toBe(0);
  });

  it('should only generate hug commands for items with the allows_soothing_hug component', () => {
    const room = ModEntityScenarios.createRoom('mixed_room', 'Mixed Study');

    const actor = new ModEntityBuilder('hug_actor')
      .withName('Comfort Seeker')
      .atLocation('mixed_room')
      .asActor()
      .withComponent('items:inventory', {
        items: ['comfort_item_one', 'comfort_item_two', 'non_comfort_item_one'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .build();

    const comfortItemOne = new ModEntityBuilder('comfort_item_one')
      .withName('Plush Dragon')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('items:allows_soothing_hug', {})
      .build();

    const comfortItemTwo = new ModEntityBuilder('comfort_item_two')
      .withName('Memory Pillow')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('items:allows_soothing_hug', {})
      .build();

    const nonComfortItem = new ModEntityBuilder('non_comfort_item_one')
      .withName('Sharp Scissors')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withDescription('Metal scissors with sharp blades.')
      .build();

    testFixture.reset([room, actor, comfortItemOne, comfortItemTwo, nonComfortItem]);
    configureActionDiscovery();

    const availableActions = testFixture.testEnv.getAvailableActions('hug_actor');
    const hugActions = availableActions.filter(
      (action) => action.id === ACTION_ID
    );

    const hugCommands = hugActions.map((action) => action.command).sort();

    expect(hugCommands).toEqual([
      'hug Memory Pillow to soothe yourself',
      'hug Plush Dragon to soothe yourself',
    ]);
    expect(
      hugCommands.some((cmd) => cmd.includes('Sharp Scissors'))
    ).toBe(false);
  });
});
```

**Implementation Details**:
- Use `configureActionDiscovery()` helper to set up action indexing
- Use `ModEntityScenarios.createRoom()` for consistent room entities
- Use `ModEntityBuilder` for creating actors and items with required components
- Test both inventory items and location-based items
- Verify command generation follows template pattern
- Follow the pattern from `readItemActionDiscovery.test.js` for consistency

### 2. Rule Execution Test

Create `tests/integration/mods/items/hugItemForComfortRuleExecution.test.js` following the items rule testing pattern.

**Test File Structure**:
```javascript
/**
 * @file Integration tests for the items:hug_item_for_comfort rule.
 * @description Ensures hugging comfort items dispatches expected events and validates message content.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import hugItemForComfortRule from '../../../../data/mods/items/rules/handle_hug_item_for_comfort.rule.json' assert { type: 'json' };
import eventIsActionHugItemForComfort from '../../../../data/mods/items/conditions/event-is-action-hug-item-for-comfort.condition.json' assert { type: 'json' };

const ACTION_ID = 'items:hug_item_for_comfort';

describe('items:hug_item_for_comfort rule execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'items',
      ACTION_ID,
      hugItemForComfortRule,
      eventIsActionHugItemForComfort
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  // Test cases below...
});
```

**Required Test Cases**:

#### 1. Message Accuracy Verification

Both success and perceptible events use the exact message:

```javascript
it('broadcasts the soothing hug message and validates event structure', async () => {
  const room = new ModEntityBuilder('comfort-room')
    .asRoom('Comfort Room')
    .build();

  const actor = new ModEntityBuilder('actor_hugger')
    .withName('Sam')
    .atLocation('comfort-room')
    .asActor()
    .withComponent('items:inventory', {
      items: ['plush1'],
      capacity: { maxWeight: 10, maxItems: 5 },
    })
    .build();

  const plushToy = new ModEntityBuilder('plush1')
    .withName('soft teddy bear')
    .withComponent('items:item', {})
    .withComponent('items:portable', {})
    .withComponent('items:allows_soothing_hug', {})
    .build();

  testFixture.reset([room, actor, plushToy]);

  await testFixture.executeAction('actor_hugger', 'plush1');

  const perceptibleEvent = testFixture.events.find(
    (event) => event.eventType === 'core:perceptible_event'
  );
  expect(perceptibleEvent).toBeDefined();
  expect(perceptibleEvent.payload.descriptionText).toBe(
    'Sam hugs soft teddy bear and feels calmer.'
  );
  expect(perceptibleEvent.payload.perceptionType).toBe('item_use');
  expect(perceptibleEvent.payload.actorId).toBe('actor_hugger');
  expect(perceptibleEvent.payload.targetId).toBe('plush1');

  const successEvent = testFixture.events.find(
    (event) => event.eventType === 'core:display_successful_action_result'
  );
  expect(successEvent).toBeDefined();
  expect(successEvent.payload.message).toBe(
    'Sam hugs soft teddy bear and feels calmer.'
  );

  const turnEnded = testFixture.events.find(
    (event) => event.eventType === 'core:turn_ended'
  );
  expect(turnEnded).toBeDefined();
  expect(turnEnded.payload.success).toBe(true);

  const failureEvent = testFixture.events.find(
    (event) => event.eventType === 'core:display_failed_action_result'
  );
  expect(failureEvent).toBeUndefined();
});
```

#### 2. Item Remains in Inventory

Verify the comfort item is not consumed or removed:

```javascript
it('keeps the comfort item in inventory after hugging', async () => {
  const room = new ModEntityBuilder('living-room')
    .asRoom('Living Room')
    .build();

  const actor = new ModEntityBuilder('actor_keeper')
    .withName('Riley')
    .atLocation('living-room')
    .asActor()
    .withComponent('items:inventory', {
      items: ['pillow1'],
      capacity: { maxWeight: 10, maxItems: 5 },
    })
    .build();

  const comfortPillow = new ModEntityBuilder('pillow1')
    .withName('memory foam pillow')
    .withComponent('items:item', {})
    .withComponent('items:portable', {})
    .withComponent('items:allows_soothing_hug', {})
    .build();

  testFixture.reset([room, actor, comfortPillow]);

  await testFixture.executeAction('actor_keeper', 'pillow1');

  const actorInventory = testFixture.entityManager.getComponentData(
    'actor_keeper',
    'items:inventory'
  );
  expect(actorInventory?.items).toContain('pillow1');
});
```

#### 3. Location-Based Item Interaction

Verify the action works for items at the location (not in inventory):

```javascript
it('successfully hugs a comfort item at the location', async () => {
  const room = new ModEntityBuilder('bedroom')
    .asRoom('Bedroom')
    .build();

  const actor = new ModEntityBuilder('actor_location')
    .withName('Taylor')
    .atLocation('bedroom')
    .asActor()
    .build();

  const locationPlush = new ModEntityBuilder('location_plush')
    .withName('large plush elephant')
    .atLocation('bedroom')
    .withComponent('items:item', {})
    .withComponent('items:portable', {})
    .withComponent('items:allows_soothing_hug', {})
    .build();

  testFixture.reset([room, actor, locationPlush]);

  await testFixture.executeAction('actor_location', 'location_plush');

  const successEvent = testFixture.events.find(
    (event) => event.eventType === 'core:display_successful_action_result'
  );
  expect(successEvent).toBeDefined();
  expect(successEvent.payload.message).toBe(
    'Taylor hugs large plush elephant and feels calmer.'
  );

  const perceptibleEvent = testFixture.events.find(
    (event) => event.eventType === 'core:perceptible_event'
  );
  expect(perceptibleEvent).toBeDefined();
  expect(perceptibleEvent.payload.locationId).toBe('bedroom');
});
```

#### 4. Event Payload Validation

Verify all event metadata is correct:

```javascript
it('includes correct metadata in all dispatched events', async () => {
  const room = new ModEntityBuilder('study')
    .asRoom('Study')
    .build();

  const actor = new ModEntityBuilder('actor_meta')
    .withName('Jordan')
    .atLocation('study')
    .asActor()
    .withComponent('items:inventory', {
      items: ['stuffed1'],
      capacity: { maxWeight: 10, maxItems: 5 },
    })
    .build();

  const stuffedAnimal = new ModEntityBuilder('stuffed1')
    .withName('fuzzy bunny')
    .withComponent('items:item', {})
    .withComponent('items:portable', {})
    .withComponent('items:allows_soothing_hug', {})
    .build();

  testFixture.reset([room, actor, stuffedAnimal]);

  await testFixture.executeAction('actor_meta', 'stuffed1');

  const perceptibleEvent = testFixture.events.find(
    (event) => event.eventType === 'core:perceptible_event'
  );
  expect(perceptibleEvent.payload.perceptionType).toBe('item_use');
  expect(perceptibleEvent.payload.locationId).toBe('study');
  expect(perceptibleEvent.payload.actorId).toBe('actor_meta');
  expect(perceptibleEvent.payload.targetId).toBe('stuffed1');

  const turnEnded = testFixture.events.find(
    (event) => event.eventType === 'core:turn_ended'
  );
  expect(turnEnded.payload.entityId).toBe('actor_meta');
  expect(turnEnded.payload.success).toBe(true);
});
```

**Implementation Details**:
- Use `ModTestFixture.forAction` with explicit rule and condition JSON imports
- Execute action via `executeAction` helper method
- Assert on event payloads using `testFixture.events` array
- Verify message consistency between success and perceptible events
- Follow pattern from `applyLipstickRuleExecution.test.js` for consistency

### Test Coverage Requirements

Both test files must provide **real assertions** with actual expected values:
- ❌ **Never use**: `expect(true).toBe(true)` or placeholder tests
- ✅ **Always use**: Specific value checks, message verification, component validation

Run test commands after implementation:
```bash
# Run action discovery tests
NODE_ENV=test npx jest tests/integration/mods/items/hugItemForComfortActionDiscovery.test.js --no-coverage --verbose

# Run rule execution tests
NODE_ENV=test npx jest tests/integration/mods/items/hugItemForComfortRuleExecution.test.js --no-coverage --verbose

# Run all items mod tests
NODE_ENV=test npm run test:integration -- tests/integration/mods/items/ --silent
```

## Testing Documentation References

Consult these resources for detailed testing patterns:
- `docs/testing/mod-testing-guide.md` - Comprehensive mod testing guide
- `tests/common/mods/ModTestFixture.js` - Test fixture usage and helpers
- `tests/common/mods/ModEntityBuilder.js` - Entity creation helpers and scenarios
- Existing items tests in `tests/integration/mods/items/` - Real-world examples
  - `readItemActionDiscovery.test.js` - Discovery test pattern
  - `applyLipstickRuleExecution.test.js` - Rule execution test pattern

## Manifest & Documentation Updates

Update `data/mods/items/mod-manifest.json` to register all new files:

1. Add component file to `components` array:
   ```json
   "components": [
     "components/allows_soothing_hug.component.json"
   ]
   ```

2. Add action file to `actions` array:
   ```json
   "actions": [
     "actions/hug_item_for_comfort.action.json"
   ]
   ```

3. Add condition file to `conditions` array:
   ```json
   "conditions": [
     "conditions/event-is-action-hug-item-for-comfort.condition.json"
   ]
   ```

4. Add rule file to `rules` array:
   ```json
   "rules": [
     "rules/handle_hug_item_for_comfort.rule.json"
   ]
   ```

Ensure all entries follow the manifest's existing structure and alphabetical ordering conventions.

## Modder Usage Examples

After implementation, modders can add the soothing hug capability to any item:

**Example 1: Plush Toy**
```json
{
  "id": "my_mod:plush_unicorn",
  "components": {
    "core:name": { "name": "rainbow unicorn plushie" },
    "core:description": { "text": "A soft, colorful unicorn toy with a gentle smile." },
    "items:item": {},
    "items:portable": {},
    "items:allows_soothing_hug": {}
  }
}
```

**Example 2: Comfort Pillow**
```json
{
  "id": "my_mod:cozy_pillow",
  "components": {
    "core:name": { "name": "well-worn pillow" },
    "core:description": { "text": "A pillow that's seen better days but still provides comfort." },
    "items:item": {},
    "items:portable": {},
    "items:allows_soothing_hug": {}
  }
}
```

## Acceptance Criteria

- ✅ New component, action, condition, and rule files reside in the items mod
- ✅ All files follow established schema patterns and validate successfully
- ✅ Component, action, condition, and rule appear in manifest's respective arrays
- ✅ Action uses correct target scope: `items:examinable_items`
- ✅ Action requires correct components: `items:item` and `items:allows_soothing_hug`
- ✅ Action template exactly matches: `"hug {item} to soothe yourself"`
- ✅ Both successful action and perceptible event messages exactly match: `"{actor} hugs {target} and feels calmer."`
- ✅ Discoverability tests cover all positive and negative scenarios
- ✅ Rule integration tests verify exact message matching
- ✅ Tests verify comfort items remain in inventory after use
- ✅ Tests verify action works for both inventory and location items
- ✅ Tests use real assertions, not placeholders
- ✅ All tests in `npm run test:integration` pass successfully
- ✅ File naming follows conventions (underscores for actions/rules, hyphens for conditions)

## Implementation Checklist

- [ ] Create `data/mods/items/components/allows_soothing_hug.component.json`
- [ ] Create `data/mods/items/actions/hug_item_for_comfort.action.json`
- [ ] Create `data/mods/items/conditions/event-is-action-hug-item-for-comfort.condition.json` (note: hyphens!)
- [ ] Create `data/mods/items/rules/handle_hug_item_for_comfort.rule.json`
- [ ] Update `data/mods/items/mod-manifest.json` with all four files
- [ ] Create `tests/integration/mods/items/hugItemForComfortActionDiscovery.test.js`
- [ ] Create `tests/integration/mods/items/hugItemForComfortRuleExecution.test.js`
- [ ] Run `npm run test:integration` and verify all tests pass
- [ ] Run `npx eslint` on all modified files
- [ ] Validate schema compliance for all JSON files

## Notes for Implementers

1. **Message Consistency**: The phrase "hugs {target} and feels calmer" must appear identically in both the rule's `logMessage` variable and the resulting perceptible event text.

2. **Scope Behavior**: The `items:examinable_items` scope automatically searches both inventory and location. Test thoroughly to ensure:
   - Actor can hug items in their inventory
   - Actor can hug items at their current location
   - Actor cannot hug items at other locations
   - Only items with `items:allows_soothing_hug` are discoverable

3. **Test Fixture Usage**: `ModTestFixture.forAction` automatically loads mod dependencies and sets up the test environment. Use `ModEntityBuilder` for consistent entity creation in tests.

4. **File Naming Convention**: Remember that condition files use **hyphens** (`event-is-action-hug-item-for-comfort`) while action and rule files use **underscores** (`hug_item_for_comfort`). This is critical for test auto-loading.

5. **Validation**: Always run schema validation after creating JSON files. The build process includes validation that will catch schema violations early:
   ```bash
   npm run validate:mod:items
   ```

6. **Item Persistence**: Unlike consumable items, comfort items remain in inventory after use. The rule does not modify the item or inventory components.

7. **Perception Type**: Use `"item_use"` as the perception type to maintain consistency with other item interaction actions like `apply_lipstick`.

## Related Specifications

For reference, see these related action specifications:
- `apply_lipstick` - Similar cosmetic item usage pattern
- `read_item` - Uses same `items:examinable_items` scope
- `examine_item` - Basic item interaction pattern

## Future Enhancements (Out of Scope)

Potential future additions that are **not** part of this specification:
- Component data to track comfort level or emotional state changes
- Cooldown mechanics to prevent repeated hugging
- Special messages for different comfort item types
- Integration with character mood or stress systems
- Achievement/progress tracking for comfort seeking behavior
