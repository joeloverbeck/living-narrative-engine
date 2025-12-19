# Scope Resolver Registry

Complete reference for all scope resolvers available in ScopeResolverHelpers library.

**Last Updated**: 2025-10-26
**Library**: `tests/common/mods/scopeResolverHelpers.js`

## Overview

The ScopeResolverHelpers library provides pre-configured scope resolvers for common testing scenarios. This eliminates the need for manual scope implementation (40+ lines of boilerplate) and ensures consistent scope behavior across tests.

### Usage Pattern

```javascript
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';

beforeEach(async () => {
  testFixture = await ModTestFixture.forAction('modId', 'actionName');

  // Register scope category
  ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
});
```

### Scope Categories

| Category        | Registration Method                  | Coverage  |
| --------------- | ------------------------------------ | --------- |
| **Positioning** | `registerPositioningScopes(testEnv)` | 26 scopes |
| **Inventory**   | `registerInventoryScopes(testEnv)`   | 5 scopes  |
| **Anatomy**     | `registerAnatomyScopes(testEnv)`     | 2 scopes  |

---

## Positioning Scopes

Scopes for handling positioning, furniture, sitting, standing, kneeling, lying, bending, and facing relationships.

**Registration**:

```javascript
ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
```

### `positioning:furniture_actor_sitting_on`

**Description**: Returns the furniture entity the actor is currently sitting on.

**Pattern Type**: Component Lookup

**Requirements**:

- Actor must have `positioning:sitting_on` component with `furniture_id` field

**Returns**: Set containing single furniture entity ID, or empty set

**Example Usage**:

```javascript
// Action that uses this scope
{
  "id": "deference:stand_up",
  "targets": "positioning:furniture_actor_sitting_on",
  // ...
}
```

**Test Setup**:

```javascript
// Arrange scenario
const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

// Add required component
scenario.actor.components['positioning:sitting_on'] = {
  furniture_id: 'furniture_chair_01',
  spot_index: 0,
};

// Execute action
const availableActions = await testFixture.getAvailableActions(
  scenario.actor.id
);
```

**Common Use Cases**:

- "stand up" action - requires knowing current furniture
- "get up from furniture" interactions

---

### `positioning:actors_sitting_on_same_furniture`

**Description**: All actors sitting on the same furniture as the actor, excluding the actor themselves.

**Pattern Type**: Array Filter

**Requirements**:

- Actor has `positioning:sitting_on` component
- Furniture has `sitting:allows_sitting` component with `spots` array

**Returns**: Set of entity IDs of other actors on same furniture

**Example Usage**:

```javascript
{
  "id": "positioning:talk_to_person_on_couch",
  "targets": "positioning:actors_sitting_on_same_furniture",
  // ...
}
```

**Test Setup**:

```javascript
const scenario = testFixture.createSittingPair(
  ['Alice', 'Bob'],
  'furniture_couch'
);
// Creates two actors sitting on same furniture at different spots
```

**Common Use Cases**:

- Social interactions with seated neighbors
- Group sitting conversations

---

### `positioning:closest_leftmost_occupant`

**Description**: Actor sitting immediately to the left of the actor on the same furniture.

**Pattern Type**: Component Lookup + Position Calculation

**Requirements**:

- Actor has `positioning:sitting_on` with valid `spot_index`
- Furniture has occupied spot to the left

**Returns**: Set containing single entity ID of leftmost neighbor, or empty set

**Example Usage**:

```javascript
{
  "id": "positioning:scoot_closer_left",
  "targets": "positioning:closest_leftmost_occupant",
  // ...
}
```

**Test Setup**:

```javascript
const scenario = testFixture.createSittingPair(
  ['Alice', 'Bob'],
  'furniture_couch'
);
// Alice at spot 0, Bob at spot 1
// Bob's closest_leftmost_occupant = Alice
```

**Common Use Cases**:

- Directional seating interactions
- "scoot closer to left" actions

---

### `positioning:closest_rightmost_occupant`

**Description**: Actor sitting immediately to the right of the actor on the same furniture.

**Pattern Type**: Component Lookup + Position Calculation

**Requirements**:

- Actor has `positioning:sitting_on` with valid `spot_index`
- Furniture has occupied spot to the right with at least one empty spot between

**Returns**: Set containing single entity ID of rightmost neighbor, or empty set

**Example Usage**:

```javascript
{
  "id": "positioning:scoot_closer_right",
  "targets": "positioning:closest_rightmost_occupant",
  // ...
}
```

**Test Setup**:

```javascript
const scenario = testFixture.createSittingPair(
  ['Alice', 'Bob'],
  'furniture_couch'
);
// Alice at spot 0, empty at spot 1, Bob at spot 2
// Alice's closest_rightmost_occupant = Bob
```

**Common Use Cases**:

- Directional seating interactions
- "scoot closer to right" actions

---

### `positioning:furniture_allowing_sitting_at_location`

**Description**: Furniture entities at actor's location that allow sitting.

**Pattern Type**: Location Match + Component Filter

**Requirements**:

- Furniture has `sitting:allows_sitting` component
- Furniture at same location as actor

**Returns**: Set of furniture entity IDs allowing sitting

**Example Usage**:

```javascript
{
  "id": "positioning:sit_down",
  "targets": "positioning:furniture_allowing_sitting_at_location",
  // ...
}
```

**Test Setup**:

```javascript
const scenario = testFixture.createStandardActorTarget(['Alice']);

// Create furniture at location
const furniture = testFixture.createEntity('furniture_chair', {
  'core:position': { locationId: 'location_livingroom' },
  'sitting:allows_sitting': { spots: [null, null, null] },
});
```

**Common Use Cases**:

- "sit down on furniture" action discovery
- Finding available seating

---

### `positioning:standing_actors_at_location`

**Description**: All standing actors at the same location as the actor.

**Pattern Type**: Location Match + Component Filter

**Requirements**:

- Actors at same location without sitting, lying, or kneeling components

**Returns**: Set of standing actor entity IDs

**Example Usage**:

```javascript
{
  "id": "positioning:greet_standing_actors",
  "targets": "positioning:standing_actors_at_location",
  // ...
}
```

**Test Setup**:

```javascript
const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);
// Both actors created at same location, neither sitting/kneeling
```

**Common Use Cases**:

- Proximity-based standing interactions
- Room-wide greetings

---

### `positioning:sitting_actors`

**Description**: All actors currently sitting anywhere in the world.

**Pattern Type**: Component Filter

**Requirements**:

- Actors have `positioning:sitting_on` component

**Returns**: Set of all sitting actor entity IDs

**Example Usage**:

```javascript
{
  "id": "core:global_sitting_query",
  "targets": "positioning:sitting_actors",
  // ...
}
```

**Test Setup**:

```javascript
const sitting = testFixture.createSittingPair(
  ['Alice', 'Bob'],
  'furniture_couch'
);
const standing = testFixture.createStandardActorTarget(['Charlie']);
// sitting_actors = { Alice, Bob }
```

**Common Use Cases**:

- Global sitting state queries
- Finding all seated characters

---

### `positioning:kneeling_actors`

**Description**: All actors currently kneeling anywhere in the world.

**Pattern Type**: Component Filter

**Requirements**:

- Actors have `positioning:kneeling` component

**Returns**: Set of all kneeling actor entity IDs

**Example Usage**:

```javascript
{
  "id": "core:global_kneeling_query",
  "targets": "positioning:kneeling_actors",
  // ...
}
```

**Test Setup**:

```javascript
scenario.actor.components['positioning:kneeling'] = { started_at: Date.now() };
```

**Common Use Cases**:

- Kneeling state-dependent actions
- Finding kneeling characters

---

### `positioning:furniture_actor_behind`

**Description**: Furniture entity the actor is positioned behind.

**Pattern Type**: Component Lookup

**Requirements**:

- Actor has `positioning:standing_behind` component with `furniture_id` field

**Returns**: Set containing single furniture entity ID, or empty set

**Example Usage**:

```javascript
{
  "id": "positioning:step_out_from_behind",
  "targets": "positioning:furniture_actor_behind",
  // ...
}
```

**Test Setup**:

```javascript
scenario.actor.components['positioning:standing_behind'] = {
  furniture_id: 'furniture_wall',
};
```

**Common Use Cases**:

- "step out from behind furniture" actions
- Cover-based positioning

---

### `positioning:actor_being_bitten_by_me`

**Description**: Entity whose neck the actor is currently biting, with reciprocal validation.

**Pattern Type**: Array Filter with Reciprocal Validation

**Requirements**:

- Actor has `positioning:biting_neck` component with `bitten_entity_id`
- Target has `positioning:being_bitten_in_neck` component with `biting_entity_id`
- Both components reference each other (reciprocal relationship)

**Returns**: Set containing single bitten entity ID, or empty set

**Example Usage**:

```javascript
{
  "id": "violence:tear_out_throat",
  "targets": "positioning:actor_being_bitten_by_me",
  // ...
}
```

**Test Setup**:

```javascript
scenario.actor.components['positioning:biting_neck'] = {
  bitten_entity_id: scenario.target.id,
};
scenario.target.components['positioning:being_bitten_in_neck'] = {
  biting_entity_id: scenario.actor.id,
};
```

**Common Use Cases**:

- "tear out throat" vampire actions
- "drink blood" actions requiring bite hold

---

### `personal-space:close_actors_facing_each_other_or_behind_target`

**Description**: Close actors either facing each other or with actor positioned behind target.

**Pattern Type**: Array Filter with Complex Logic

**Requirements**:

- Actor has `positioning:closeness` component with `partners` array
- Both actors have `positioning:facing_away` components

**Returns**: Set of close actor entity IDs meeting facing criteria

**Example Usage**:

```javascript
{
  "id": "violence:grab_neck",
  "targets": "personal-space:close_actors_facing_each_other_or_behind_target",
  // ...
}
```

**Test Setup**:

```javascript
// Facing each other
const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);
scenario.actor.components['positioning:closeness'] = {
  partners: [scenario.target.id],
};
scenario.actor.components['positioning:facing_away'] = { facing_away_from: [] };
scenario.target.components['positioning:facing_away'] = {
  facing_away_from: [],
};

// OR actor behind target
scenario.target.components['positioning:facing_away'] = {
  facing_away_from: [scenario.actor.id],
};
```

**Common Use Cases**:

- Stealth attack actions
- Grab/grapple actions requiring positioning

---

### `personal-space:close_actors`

**Description**: Base closeness partners excluding kneeling-before relationships.

**Pattern Type**: Array Filter

**Requirements**:

- Actor has `positioning:closeness` component with `partners` array
- Excludes partners in kneeling-before relationship

**Returns**: Set of close actor entity IDs

**Example Usage**:

```javascript
{
  "id": "affection:hug",
  "targets": "personal-space:close_actors",
  // ...
}
```

**Test Setup**:

```javascript
scenario.actor.components['positioning:closeness'] = {
  partners: [scenario.target.id],
};
```

**Common Use Cases**:

- General proximity-based interactions
- Physical contact actions

---

### `personal-space:close_actors_facing_each_other`

**Description**: Close actors mutually facing each other (not facing away from each other).

**Pattern Type**: Array Filter

**Requirements**:

- Actor has `positioning:closeness` component
- Neither actor in `positioning:facing_away` list for the other

**Returns**: Set of close actors facing each other

**Example Usage**:

```javascript
{
  "id": "kissing:kiss_lips",
  "targets": "personal-space:close_actors_facing_each_other",
  // ...
}
```

**Test Setup**:

```javascript
scenario.actor.components['positioning:closeness'] = {
  partners: [scenario.target.id],
};
scenario.actor.components['positioning:facing_away'] = { facing_away_from: [] };
scenario.target.components['positioning:facing_away'] = {
  facing_away_from: [],
};
```

**Common Use Cases**:

- Face-to-face interactions
- Kissing, eye contact actions

---

### `positioning:actors_both_sitting_close`

**Description**: Close actors where both the actor and partner are sitting.

**Pattern Type**: Array Filter

**Requirements**:

- Actor has `positioning:closeness` component
- Both actor and partner have `positioning:sitting_on` component

**Returns**: Set of close sitting partners

**Example Usage**:

```javascript
{
  "id": "affection:hold_hands_while_sitting",
  "targets": "positioning:actors_both_sitting_close",
  // ...
}
```

**Test Setup**:

```javascript
const scenario = testFixture.createSittingPair(
  ['Alice', 'Bob'],
  'furniture_couch'
);
scenario.actor.components['positioning:closeness'] = {
  partners: [scenario.target.id],
};
```

**Common Use Cases**:

- Seated physical contact
- Couch cuddling actions

---

### `positioning:actor_biting_my_neck`

**Description**: Entity currently biting the actor's neck (reverse of actor_being_bitten_by_me).

**Pattern Type**: Array Filter with Reciprocal Validation

**Requirements**:

- Actor has `positioning:being_bitten_in_neck` component
- Partner has `positioning:biting_neck` component
- Reciprocal relationship validated

**Returns**: Set containing single biting entity ID, or empty set

**Example Usage**:

```javascript
{
  "id": "violence:struggle_against_bite",
  "targets": "positioning:actor_biting_my_neck",
  // ...
}
```

**Test Setup**:

```javascript
scenario.actor.components['positioning:being_bitten_in_neck'] = {
  biting_entity_id: scenario.target.id,
};
scenario.target.components['positioning:biting_neck'] = {
  bitten_entity_id: scenario.actor.id,
};
```

**Common Use Cases**:

- Defensive actions against bite
- "push away attacker" actions

---

### `positioning:actors_sitting_close`

**Description**: Close actors who are sitting (actor sitting status doesn't matter).

**Pattern Type**: Array Filter

**Requirements**:

- Actor has `positioning:closeness` component
- Partner has `positioning:sitting_on` component

**Returns**: Set of close partners who are sitting

**Example Usage**:

```javascript
{
  "id": "affection:sit_beside",
  "targets": "positioning:actors_sitting_close",
  // ...
}
```

**Test Setup**:

```javascript
scenario.actor.components['positioning:closeness'] = {
  partners: [scenario.target.id],
};
scenario.target.components['positioning:sitting_on'] = {
  furniture_id: 'chair_01',
  spot_index: 0,
};
```

**Common Use Cases**:

- Joining seated person
- Seated interaction discovery

---

### `personal-space:close_actors_or_entity_kneeling_before_actor`

**Description**: Complex scope combining closeness partners (facing/behind) with exclusion for actor kneeling before partner.

**Pattern Type**: Array Filter with Complex Logic

**Requirements**:

- Actor has `positioning:closeness` component
- Facing/behind logic evaluated
- Kneeling-before relationship checked

**Returns**: Set of valid close actors

**Example Usage**:

```javascript
{
  "id": "affection:embrace",
  "targets": "personal-space:close_actors_or_entity_kneeling_before_actor",
  // ...
}
```

**Test Setup**:

```javascript
scenario.actor.components['positioning:closeness'] = {
  partners: [scenario.target.id],
};
scenario.actor.components['positioning:facing_away'] = { facing_away_from: [] };
scenario.target.components['positioning:facing_away'] = {
  facing_away_from: [],
};

// Ensure actor NOT kneeling before partner
// (absence of component is valid)
```

**Common Use Cases**:

- Complex positioning-aware interactions
- Embrace actions with positioning constraints

---

### `straddling:actor_im_straddling`

**Description**: Entity whose waist the actor is currently straddling.

**Pattern Type**: Component Lookup

**Requirements**:

- Actor has `positioning:straddling_waist` component with `target_id` field

**Returns**: Set containing single straddled entity ID, or empty set

**Example Usage**:

```javascript
{
  "id": "straddling:dismount_from_straddling",
  "targets": "straddling:actor_im_straddling",
  // ...
}
```

**Test Setup**:

```javascript
scenario.actor.components['positioning:straddling_waist'] = {
  target_id: scenario.target.id,
  facing_direction: 'facing_toward',
};
```

**Common Use Cases**:

- Dismount actions
- Straddling-specific interactions

---

### `positioning:entity_actor_is_kneeling_before`

**Description**: Entity the actor is currently kneeling before.

**Pattern Type**: Component Lookup

**Requirements**:

- Actor has `positioning:kneeling_before` component with `entity_id` field

**Returns**: Set containing single entity ID, or empty set

**Example Usage**:

```javascript
{
  "id": "positioning:stop_kneeling",
  "targets": "positioning:entity_actor_is_kneeling_before",
  // ...
}
```

**Test Setup**:

```javascript
scenario.actor.components['positioning:kneeling_before'] = {
  entity_id: scenario.target.id,
};
```

**Common Use Cases**:

- "stand up from kneeling" actions
- Kneeling relationship queries

---

### `positioning:actors_sitting_with_space_to_right`

**Description**: Actors sitting with at least 2 empty spots to their right and no one sitting further right.

**Pattern Type**: Component Filter with Complex Validation

**Requirements**:

- Actor has `positioning:sitting_on` component
- Furniture has at least 2 consecutive empty spots to right
- Actor is rightmost occupant

**Returns**: Set of actors meeting seating space criteria

**Example Usage**:

```javascript
{
  "id": "positioning:sit_beside_with_room",
  "targets": "positioning:actors_sitting_with_space_to_right",
  // ...
}
```

**Test Setup**:

```javascript
const furniture = testFixture.createEntity('furniture_couch', {
  'sitting:allows_sitting': {
    spots: [scenario.actor.id, null, null, null], // Actor at 0, 3 empty spots
  },
});
scenario.actor.components['positioning:sitting_on'] = {
  furniture_id: furniture.id,
  spot_index: 0,
};
```

**Common Use Cases**:

- Finding actors with room to sit beside
- Seating arrangement actions

---

### `positioning:available_furniture`

**Description**: Furniture at actor's location with at least one empty sitting spot.

**Pattern Type**: Location Match + Component Filter

**Requirements**:

- Furniture has `sitting:allows_sitting` component
- At least one `null` or `undefined` spot in `spots` array

**Returns**: Set of furniture entity IDs with available spots

**Example Usage**:

```javascript
{
  "id": "positioning:find_seating",
  "targets": "positioning:available_furniture",
  // ...
}
```

**Test Setup**:

```javascript
const furniture = testFixture.createEntity('furniture_couch', {
  'core:position': { locationId: 'location_livingroom' },
  'sitting:allows_sitting': { spots: [null, 'actor_01', null] },
});
```

**Common Use Cases**:

- Finding available seating
- Furniture discovery for sit actions

---

### `positioning:available_lying_furniture`

**Description**: Furniture at actor's location that allows lying.

**Pattern Type**: Location Match + Component Filter

**Requirements**:

- Furniture has `positioning:allows_lying_on` component
- Furniture at same location as actor

**Returns**: Set of furniture entity IDs allowing lying

**Example Usage**:

```javascript
{
  "id": "positioning:lie_down",
  "targets": "positioning:available_lying_furniture",
  // ...
}
```

**Test Setup**:

```javascript
const bed = testFixture.createEntity('furniture_bed', {
  'core:position': { locationId: 'location_bedroom' },
  'positioning:allows_lying_on': { capacity: 2, current_occupants: [] },
});
```

**Common Use Cases**:

- "lie down" action discovery
- Finding beds/couches for resting

---

### `positioning:furniture_im_lying_on`

**Description**: Furniture entity the actor is currently lying on.

**Pattern Type**: Component Lookup

**Requirements**:

- Actor has `positioning:lying_down` component with `furniture_id` field

**Returns**: Set containing single furniture entity ID, or empty set

**Example Usage**:

```javascript
{
  "id": "positioning:get_up_from_lying",
  "targets": "positioning:furniture_im_lying_on",
  // ...
}
```

**Test Setup**:

```javascript
scenario.actor.components['positioning:lying_down'] = {
  furniture_id: 'furniture_bed_01',
};
```

**Common Use Cases**:

- "get up from lying" actions
- Current lying surface queries

---

### `positioning:furniture_im_sitting_on`

**Description**: Furniture entity the actor is currently sitting on (alias for furniture_actor_sitting_on).

**Pattern Type**: Component Lookup

**Requirements**:

- Actor has `positioning:sitting_on` component with `furniture_id` field

**Returns**: Set containing single furniture entity ID, or empty set

**Example Usage**:

```javascript
{
  "id": "positioning:adjust_seat",
  "targets": "positioning:furniture_im_sitting_on",
  // ...
}
```

**Test Setup**:

```javascript
scenario.actor.components['positioning:sitting_on'] = {
  furniture_id: 'furniture_chair_01',
  spot_index: 0,
};
```

**Common Use Cases**:

- Current sitting surface queries
- Furniture-specific sitting actions

---

### `positioning:surface_im_bending_over`

**Description**: Surface entity the actor is currently bending over.

**Pattern Type**: Component Lookup

**Requirements**:

- Actor has `positioning:bending_over` component with `surface_id` field

**Returns**: Set containing single surface entity ID, or empty set

**Example Usage**:

```javascript
{
  "id": "positioning:straighten_up",
  "targets": "positioning:surface_im_bending_over",
  // ...
}
```

**Test Setup**:

```javascript
scenario.actor.components['positioning:bending_over'] = {
  surface_id: 'furniture_table_01',
};
```

**Common Use Cases**:

- "straighten up" actions
- Bending-over surface queries

---

### `positioning:actors_im_facing_away_from`

**Description**: Close actors the actor is facing away from.

**Pattern Type**: Array Filter

**Requirements**:

- Actor has `positioning:facing_away` component with `facing_away_from` array
- Partners also in actor's closeness list

**Returns**: Set of actor entity IDs in facing-away list

**Example Usage**:

```javascript
{
  "id": "positioning:turn_around_to_face",
  "targets": "positioning:actors_im_facing_away_from",
  // ...
}
```

**Test Setup**:

```javascript
scenario.actor.components['positioning:closeness'] = {
  partners: [scenario.target.id],
};
scenario.actor.components['positioning:facing_away'] = {
  facing_away_from: [scenario.target.id],
};
```

**Common Use Cases**:

- "turn around to face" actions
- Facing direction queries

---

## Inventory Scopes

Scopes for handling items, containers, equipped items, and inventory management.

**Registration**:

```javascript
ScopeResolverHelpers.registerInventoryScopes(testFixture.testEnv);
```

### `items:actor_inventory_items`

**Description**: Array of item entity IDs in the actor's inventory.

**Pattern Type**: Component Lookup

**Requirements**:

- Actor has `items:inventory` component with `items` array field

**Returns**: Set of item entity IDs (note: returns the array as-is from component)

**Example Usage**:

```javascript
{
  "id": "items:drop_item",
  "targets": "items:actor_inventory_items",
  // ...
}
```

**Test Setup**:

```javascript
const item = testFixture.createEntity('item_sword', {
  'items:item': { name: 'Sword', weight: 5 },
  'items:portable': {},
});
scenario.actor.components['items:inventory'] = {
  items: [item.id],
  weight_capacity: 50,
  current_weight: 5,
};
```

**Common Use Cases**:

- "drop item" action discovery
- "give item" action discovery
- Inventory queries

---

### `items:items_at_location`

**Description**: All items at the actor's current location.

**Pattern Type**: Location Match + Component Filter

**Requirements**:

- Items have `items:item` component
- Items at same location as actor

**Returns**: Set of item entity IDs at location

**Example Usage**:

```javascript
{
  "id": "items:pick_up_item",
  "targets": "items:items_at_location",
  // ...
}
```

**Test Setup**:

```javascript
const item = testFixture.createEntity('item_key', {
  'core:position': { locationId: 'location_room' },
  'items:item': { name: 'Key', weight: 0.1 },
  'items:portable': {},
});
```

**Common Use Cases**:

- "pick up item" action discovery
- Location item queries

---

### `items:portable_items_at_location`

**Description**: Portable items at the actor's current location.

**Pattern Type**: Location Match + Component Filter

**Requirements**:

- Items have both `items:item` and `items:portable` components
- Items at same location as actor

**Returns**: Set of portable item entity IDs

**Example Usage**:

```javascript
{
  "id": "items:pick_up_portable_item",
  "targets": "items:portable_items_at_location",
  // ...
}
```

**Test Setup**:

```javascript
const portableItem = testFixture.createEntity('item_coin', {
  'core:position': { locationId: 'location_room' },
  'items:item': { name: 'Coin', weight: 0.01 },
  'items:portable': {},
});

const heavyItem = testFixture.createEntity('item_anvil', {
  'core:position': { locationId: 'location_room' },
  'items:item': { name: 'Anvil', weight: 200 },
  // NO items:portable component
});
// portable_items_at_location = { coin }, NOT { anvil }
```

**Common Use Cases**:

- "pick up" action filtering
- Excluding non-portable objects

---

### `items:actors_at_location`

**Description**: All actors at the same location as the actor.

**Pattern Type**: Location Match + Component Filter

**Requirements**:

- Entities have `core:actor` component
- Entities at same location as actor

**Returns**: Set of actor entity IDs (excluding source actor)

**Example Usage**:

```javascript
{
  "id": "items:give_item",
  "targets": "items:actors_at_location",
  // ...
}
```

**Test Setup**:

```javascript
const scenario = testFixture.createStandardActorTarget([
  'Alice',
  'Bob',
  'Charlie',
]);
// All at same location by default
```

**Common Use Cases**:

- "give item" recipient discovery
- Social interaction targeting

---

### `containers-core:containers_at_location`

**Description**: All containers at the actor's current location.

**Pattern Type**: Location Match + Component Filter

**Requirements**:

- Entities have `containers-core:container` component
- Entities at same location as actor

**Returns**: Set of container entity IDs

**Example Usage**:

```javascript
{
  "id": "containers:open_container",
  "targets": "containers-core:containers_at_location",
  // ...
}
```

**Test Setup**:

```javascript
const chest = testFixture.createEntity('container_chest', {
  'core:position': { locationId: 'location_room' },
  'containers-core:container': {
    contents: [],
    is_open: false,
    capacity: 100,
  },
});
```

**Common Use Cases**:

- "open container" action discovery
- "put item in container" targeting
- "take from container" targeting

---

## Anatomy Scopes

Scopes for handling body parts, anatomy interactions, and anatomical relationships.

**Registration**:

```javascript
ScopeResolverHelpers.registerAnatomyScopes(testFixture.testEnv);
```

### `anatomy:actors_at_location`

**Description**: All actors at the same location as the actor (anatomy variant).

**Pattern Type**: Location Match + Component Filter

**Requirements**:

- Entities have `core:actor` component
- Entities at same location as actor

**Returns**: Set of actor entity IDs (excluding source actor)

**Example Usage**:

```javascript
{
  "id": "anatomy:examine_body",
  "targets": "anatomy:actors_at_location",
  // ...
}
```

**Test Setup**:

```javascript
const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);
```

**Common Use Cases**:

- Anatomy examination actions
- Body part interaction targeting

---

### `anatomy:target_body_parts`

**Description**: All body part IDs from the target entity's anatomy.

**Pattern Type**: Custom Resolver

**Requirements**:

- Target has `anatomy:body` component with `parts` object

**Returns**: Set of body part string IDs (not entity IDs, but part identifiers)

**Example Usage**:

```javascript
{
  "id": "anatomy:touch_body_part",
  "targets": "anatomy:target_body_parts",
  // ...
}
```

**Test Setup**:

```javascript
scenario.target.components['anatomy:body'] = {
  parts: {
    head: { name: 'Head', description: 'Head region' },
    torso: { name: 'Torso', description: 'Torso region' },
    arms: { name: 'Arms', description: 'Arm region' },
  },
};
// Returns: { 'head', 'torso', 'arms' }
```

**Common Use Cases**:

- Body part selection for interactions
- Anatomy-specific targeting

---

## Creating Custom Scope Resolvers

For scopes not in the standard library, use factory methods to create resolvers.

### Factory Method Reference

#### createComponentLookupResolver

**Purpose**: Resolve to entity ID stored in a component field.

**Signature**:

```javascript
ScopeResolverHelpers.createComponentLookupResolver(scopeName, config);
```

**Config Parameters**:

- `componentType` (string): Component to read from (e.g., `'positioning:biting_neck'`)
- `sourceField` (string): Field containing target entity ID (e.g., `'bitten_entity_id'`)
- `resultField` (string, optional): Field to extract from result (default: `'id'`)
- `contextSource` (string, optional): Where to get source entity (`'actor'` | `'target'`, default: `'actor'`)

**Example**:

```javascript
const furnitureResolver = ScopeResolverHelpers.createComponentLookupResolver(
  'positioning:furniture_im_sitting_on',
  {
    componentType: 'positioning:sitting_on',
    sourceField: 'furniture_id',
    contextSource: 'actor',
  }
);

ScopeResolverHelpers._registerResolvers(
  testFixture.testEnv,
  testFixture.testEnv.entityManager,
  { 'positioning:furniture_im_sitting_on': furnitureResolver }
);
```

**Use When**:

- Scope resolves to single entity from component field
- Pattern: "entity X has relationship to entity Y"
- Examples: "furniture I'm sitting on", "actor I'm kneeling before"

---

#### createArrayFilterResolver

**Purpose**: Filter array of entity IDs based on custom logic.

**Signature**:

```javascript
ScopeResolverHelpers.createArrayFilterResolver(scopeName, config);
```

**Config Parameters**:

- `getArray` (function): `(actor, context, entityManager) => entityId[]` - Function to retrieve array
- `filterFn` (function): `(entityId, actor, context, entityManager) => boolean` - Filter predicate
- `contextSource` (string, optional): Context entity to use (`'actor'` | `'target'`, default: `'actor'`)

**Example**:

```javascript
const facingResolver = ScopeResolverHelpers.createArrayFilterResolver(
  'personal-space:close_actors_facing_each_other',
  {
    getArray: (actor, context, em) => {
      const closeness = em.getComponentData(actor.id, 'positioning:closeness');
      return closeness?.partners || [];
    },
    filterFn: (partnerId, actor, context, em) => {
      const actorFacingAway =
        em.getComponentData(actor.id, 'positioning:facing_away')
          ?.facing_away_from || [];
      const partnerFacingAway =
        em.getComponentData(partnerId, 'positioning:facing_away')
          ?.facing_away_from || [];

      return (
        !actorFacingAway.includes(partnerId) &&
        !partnerFacingAway.includes(actor.id)
      );
    },
  }
);

ScopeResolverHelpers._registerResolvers(
  testFixture.testEnv,
  testFixture.testEnv.entityManager,
  { 'personal-space:close_actors_facing_each_other': facingResolver }
);
```

**Use When**:

- Scope resolves to subset of entities from array
- Complex filtering logic required
- Pattern: "entities from list that match criteria"
- Examples: "close actors facing each other", "actors on same furniture"

---

#### createLocationMatchResolver

**Purpose**: Resolve to entities at the same location with optional filtering.

**Signature**:

```javascript
ScopeResolverHelpers.createLocationMatchResolver(scopeName, config);
```

**Config Parameters**:

- `filterFn` (function, optional): `(entityId, sourceEntity, context, entityManager) => boolean`
- `contextSource` (string, optional): Context entity to use (`'actor'` | `'target'`, default: `'actor'`)

**Example**:

```javascript
const standingAtLocation = ScopeResolverHelpers.createLocationMatchResolver(
  'positioning:standing_actors_at_location',
  {
    filterFn: (entityId, source, context, em) => {
      if (!em.hasComponent(entityId, 'core:actor')) return false;
      return (
        !em.hasComponent(entityId, 'positioning:sitting_on') &&
        !em.hasComponent(entityId, 'positioning:lying_on') &&
        !em.hasComponent(entityId, 'positioning:kneeling')
      );
    },
  }
);

ScopeResolverHelpers._registerResolvers(
  testFixture.testEnv,
  testFixture.testEnv.entityManager,
  { 'positioning:standing_actors_at_location': standingAtLocation }
);
```

**Use When**:

- Scope resolves to entities at same location
- Optional filtering by component presence
- Pattern: "entities in same room [that meet criteria]"
- Examples: "standing actors at location", "items at location"

---

#### createComponentFilterResolver

**Purpose**: Resolve to all entities with a specific component globally.

**Signature**:

```javascript
ScopeResolverHelpers.createComponentFilterResolver(scopeName, config);
```

**Config Parameters**:

- `componentType` (string): Component type to filter by
- `filterFn` (function, optional): `(entityId, context, entityManager) => boolean` - Additional filtering

**Example**:

```javascript
const sittingActors = ScopeResolverHelpers.createComponentFilterResolver(
  'positioning:sitting_actors',
  {
    componentType: 'positioning:sitting_on',
  }
);

ScopeResolverHelpers._registerResolvers(
  testFixture.testEnv,
  testFixture.testEnv.entityManager,
  { 'positioning:sitting_actors': sittingActors }
);
```

**Use When**:

- Scope resolves to all entities with component (global)
- Pattern: "all entities with component X"
- Examples: "all sitting actors", "all kneeling actors"

---

### Choosing the Right Factory Method

| Pattern                          | Factory Method                  | Example                          |
| -------------------------------- | ------------------------------- | -------------------------------- |
| "Entity ID from component field" | `createComponentLookupResolver` | "furniture actor is sitting on"  |
| "Filter entities from array"     | `createArrayFilterResolver`     | "close actors facing each other" |
| "Entities at same location"      | `createLocationMatchResolver`   | "standing actors at location"    |
| "All entities with component"    | `createComponentFilterResolver` | "all kneeling actors"            |

---

## Quick Reference

### Scope Selection Guide

**Need to find...**

| Scenario                     | Scope Name                                                    | Category    |
| ---------------------------- | ------------------------------------------------------------- | ----------- |
| Furniture actor sits on      | `positioning:furniture_actor_sitting_on`                      | Positioning |
| Actors on same furniture     | `positioning:actors_sitting_on_same_furniture`                | Positioning |
| Actor to left on furniture   | `positioning:closest_leftmost_occupant`                       | Positioning |
| Actor to right on furniture  | `positioning:closest_rightmost_occupant`                      | Positioning |
| Furniture allowing sitting   | `positioning:furniture_allowing_sitting_at_location`          | Positioning |
| Standing actors nearby       | `positioning:standing_actors_at_location`                     | Positioning |
| All sitting actors           | `positioning:sitting_actors`                                  | Positioning |
| All kneeling actors          | `positioning:kneeling_actors`                                 | Positioning |
| Furniture actor behind       | `positioning:furniture_actor_behind`                          | Positioning |
| Entity being bitten          | `positioning:actor_being_bitten_by_me`                        | Positioning |
| Close actors (facing/behind) | `personal-space:close_actors_facing_each_other_or_behind_target` | Positioning |
| Close actors (base)          | `personal-space:close_actors`                                    | Positioning |
| Close actors facing          | `personal-space:close_actors_facing_each_other`                  | Positioning |
| Both sitting close           | `positioning:actors_both_sitting_close`                       | Positioning |
| Actor biting my neck         | `positioning:actor_biting_my_neck`                            | Positioning |
| Actors sitting close         | `positioning:actors_sitting_close`                            | Positioning |
| Complex closeness/kneeling   | `personal-space:close_actors_or_entity_kneeling_before_actor`    | Positioning |
| Actor I'm straddling         | `straddling:actor_im_straddling`                             | Positioning |
| Entity kneeling before       | `positioning:entity_actor_is_kneeling_before`                 | Positioning |
| Sitting with space right     | `positioning:actors_sitting_with_space_to_right`              | Positioning |
| Available furniture          | `positioning:available_furniture`                             | Positioning |
| Available lying furniture    | `positioning:available_lying_furniture`                       | Positioning |
| Furniture lying on           | `positioning:furniture_im_lying_on`                           | Positioning |
| Furniture sitting on         | `positioning:furniture_im_sitting_on`                         | Positioning |
| Surface bending over         | `positioning:surface_im_bending_over`                         | Positioning |
| Actors facing away from      | `positioning:actors_im_facing_away_from`                      | Positioning |
| Actor's inventory items      | `items:actor_inventory_items`                                 | Inventory   |
| Items at location            | `items:items_at_location`                                     | Inventory   |
| Portable items at location   | `items:portable_items_at_location`                            | Inventory   |
| Actors at location (items)   | `items:actors_at_location`                                    | Inventory   |
| Containers at location       | `containers-core:containers_at_location`                                | Inventory   |
| Actors at location (anatomy) | `anatomy:actors_at_location`                                  | Anatomy     |
| Target's body parts          | `anatomy:target_body_parts`                                   | Anatomy     |

### Coverage Matrix

| Mod Category    | Total Scopes | Documented | Coverage |
| --------------- | ------------ | ---------- | -------- |
| **Positioning** | 26           | 26         | 100%     |
| **Inventory**   | 5            | 5          | 100%     |
| **Anatomy**     | 2            | 2          | 100%     |
| **Total**       | 33           | 33         | 100%     |

---

## Troubleshooting

### Scope Not Registered Error

**Symptom**: Action not discovered during testing, no obvious error message.

**Cause**: Action uses a scope that hasn't been registered in the test.

**Solution**:

1. Identify scope from action definition:

   ```bash
   cat data/mods/{mod}/actions/{action}.action.json | grep "targets"
   ```

2. Check if scope in registry (this document)

3. If scope is in registry:
   - Add appropriate `ScopeResolverHelpers.register*Scopes()` call to test setup
   - Example: `ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);`

4. If scope is NOT in registry:
   - Create custom resolver using factory methods (see above)
   - Register resolver with `ScopeResolverHelpers._registerResolvers()`

### Custom Scope Implementation

**Symptom**: Action uses a scope not in the standard library.

**Solution**:

1. Identify scope pattern (lookup, filter, location, component)
2. Choose appropriate factory method from above
3. Create and register custom resolver
4. See [Creating Custom Scope Resolvers](#creating-custom-scope-resolvers)

**Example Custom Resolver**:

```javascript
// Custom scope for "actors wearing hats at location"
const hatWearersResolver = ScopeResolverHelpers.createLocationMatchResolver(
  'custom:actors_wearing_hats_at_location',
  {
    filterFn: (entityId, source, context, em) => {
      if (!em.hasComponent(entityId, 'core:actor')) return false;
      return em.hasComponent(entityId, 'clothing:wearing_hat');
    },
  }
);

ScopeResolverHelpers._registerResolvers(
  testFixture.testEnv,
  testFixture.testEnv.entityManager,
  { 'custom:actors_wearing_hats_at_location': hatWearersResolver }
);
```

### Performance Issues

**Symptom**: Slow test execution when using many scopes.

**Optimization Strategies**:

- **Register only needed categories**: Don't register all scope categories if only using positioning scopes

  ```javascript
  // ✅ Good: Only register what's needed
  ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);

  // ❌ Bad: Registering all categories unnecessarily
  ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
  ScopeResolverHelpers.registerInventoryScopes(testFixture.testEnv);
  ScopeResolverHelpers.registerAnatomyScopes(testFixture.testEnv);
  ```

- **Use `testFixture.reset()` instead of recreating fixture**: Reuse fixture across tests

  ```javascript
  beforeEach(async () => {
    if (!testFixture) {
      testFixture = await ModTestFixture.forAction('mod', 'action');
      ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
    } else {
      testFixture.reset();
    }
  });
  ```

- **Disable diagnostics in production tests**: Only enable for debugging

  ```javascript
  // Only enable when needed
  // testFixture.enableDiagnostics();
  ```

- **Cache resolver creation**: Create resolvers once, reuse across tests

  ```javascript
  let customResolver;
  beforeAll(() => {
    customResolver = ScopeResolverHelpers.createComponentLookupResolver(...);
  });

  beforeEach(() => {
    ScopeResolverHelpers._registerResolvers(
      testFixture.testEnv,
      testFixture.testEnv.entityManager,
      { 'custom:scope': customResolver }
    );
  });
  ```

---

## Related Documentation

- [Mod Testing Guide](./mod-testing-guide.md) - Complete unified guide with fixtures, discovery diagnostics, and migration patterns
- [ModTestFixture API](../../tests/common/mods/ModTestFixture.js) - Complete fixture API reference
- [ScopeResolverHelpers Implementation](../../tests/common/mods/scopeResolverHelpers.js) - Source code

---

**Last Updated**: 2025-10-26
**Maintained By**: Living Narrative Engine Team
