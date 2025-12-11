# Items System Mod

Core items and inventory system for Living Narrative Engine. Container components now live in `containers-core`, and container interactions are provided by the `containers` mod.

## Overview

The items mod provides a modular ECS-based system for item management with:

- **Modular Components**: Marker and data components that combine to create items
- **Multi-Target Actions**: Discovery-time combination generation
- **Container System**: Locked/unlocked storage with capacity limits (via `containers-core` components and `containers` actions)
- **Inventory Management**: Weight and count-based capacity

## Components

### Marker Components

**items:item** - Identifies an entity as an item

```json
{
  "items:item": {}
}
```

**items:portable** - Indicates item can be carried

```json
{
  "items:portable": {}
}
```

**items:openable** - Indicates entity can be opened/closed

```json
{
  "items:openable": {}
}
```

### Data Components

**core:weight** - Physical weight attribute

```json
{
  "core:weight": {
    "weight": 0.5
  }
}
```

**items:readable** - Text content for reading

```json
{
  "items:readable": {
    "content": "The letter reads: 'Meet me at the old mill at midnight...'"
  }
}
```

**items:inventory** - Item collection for actors

```json
{
  "items:inventory": {
    "items": ["item-id-1", "item-id-2"],
    "capacity": {
      "maxWeight": 50,
      "maxItems": 10
    }
  }
}
```

**containers-core:container** - Storage for items

```json
{
  "containers-core:container": {
    "contents": ["item-id-1"],
    "capacity": {
      "maxWeight": 100,
      "maxItems": 20
    },
    "isOpen": false,
    "requiresKey": true,
    "keyItemId": "brass-key-1"
  }
}
```

## Creating Items

### Basic Portable Item

```json
{
  "id": "my-item-1",
  "components": {
    "core:name": { "name": "My Item" },
    "core:description": {
      "shortDescription": "A useful item",
      "fullDescription": "Detailed description here"
    },
    "items:item": {},
    "items:portable": {},
    "core:weight": {
      "weight": 1.5
    }
  }
}
```

### Readable Item

```json
{
  "id": "letter-1",
  "components": {
    "core:name": { "name": "Letter" },
    "core:description": {
      "shortDescription": "A sealed letter",
      "fullDescription": "A letter sealed with red wax"
    },
    "items:item": {},
    "items:portable": {},
    "items:readable": {
      "content": "The letter reads: 'Meet me at the old mill at midnight. Come alone. -J'"
    },
    "core:weight": {
      "weight": 0.1
    }
  }
}
```

### Container

```json
{
  "id": "chest-1",
  "components": {
    "core:name": { "name": "Wooden Chest" },
    "items:item": {},
    "items:openable": {},
    "containers-core:container": {
      "contents": [],
      "capacity": { "maxWeight": 50, "maxItems": 10 },
      "isOpen": false,
      "requiresKey": false
    },
    "positioning:position": { "locationId": "tavern" }
  }
}
```

### Locked Container with Key

```json
{
  "id": "treasure-chest-1",
  "components": {
    "core:name": { "name": "Treasure Chest" },
    "items:item": {},
    "items:openable": {},
    "containers-core:container": {
      "contents": ["gold-bar-1"],
      "capacity": { "maxWeight": 100, "maxItems": 20 },
      "isOpen": false,
      "requiresKey": true,
      "keyItemId": "brass-key-1"
    },
    "positioning:position": { "locationId": "cave" }
  }
}
```

## Available Actions

1. **give_item**: Transfer item to nearby actor
   - Requires: Actor has item in inventory, target actor nearby
   - Multi-target: Actor → Recipient → Item

2. **drop_item**: Place item at current location
   - Requires: Actor has item in inventory
   - Multi-target: Actor → Item

3. **pick_up_item**: Retrieve item from location
   - Requires: Item at actor's location, inventory capacity available
   - Multi-target: Actor → Item

4. **examine_item**: View full item description (free action)
   - Requires: Item in inventory or at location
   - Multi-target: Actor → Item
   - Note: This is a free action that doesn't consume a turn

5. **read_item**: Read readable item content (free action)
   - Requires: Item has `items:readable` component
   - Multi-target: Actor → Item
   - Note: This is a free action that doesn't consume a turn

6. **Container interactions** (provided by `containers` mod)
   - `containers:open_container`: Open a container (with key if required)
   - `containers:take_from_container`: Retrieve an item from an open container
   - `containers:put_in_container`: Store an item from inventory into an open container

## Scopes

The items mod provides the following scopes for action discovery:

- **items:actor_inventory_items** - Items in actor's inventory
- **items:items_at_location** - Portable items at actor's location
- **items:non_portable_items_at_location** - Non-portable items at location
- **containers-core:openable_containers_at_location** - Containers at location
- **containers-core:open_containers_at_location** - Open containers at location
- **containers-core:container_contents** - Items inside a container
- **items:examinable_items** - Items with descriptions (inventory + location)
- **items:close_actors_with_inventory** - Nearby actors with inventories

## Integration Notes

### Multi-Target Pattern

Actions use `generateCombinations: true` and `contextFrom: "primary"` to create all valid action combinations at discovery time. This means when an actor can give items, the system automatically generates separate actions for each (recipient, item) combination.

### Capacity Validation

Both inventories and containers enforce weight and item count limits using dedicated handlers:

- `VALIDATE_INVENTORY_CAPACITY`: Checks if actor can carry more items
- `VALIDATE_CONTAINER_CAPACITY`: Checks if container can hold more items

### Perception Logging

All actions create perception log entries for narrative coherence. The system tracks:

- Who performed the action
- What items were involved
- Where the action took place

### Operation Handlers

The items system uses the following operation handlers:

- `TRANSFER_ITEM`: Move item between inventories
- `DROP_ITEM_AT_LOCATION`: Remove from inventory, add to location
- `PICK_UP_ITEM_FROM_LOCATION`: Remove from location, add to inventory
- `OPEN_CONTAINER`: Change container's `isOpen` state
- `TAKE_FROM_CONTAINER`: Move item from container to inventory
- `PUT_IN_CONTAINER`: Move item from inventory to container
- `VALIDATE_INVENTORY_CAPACITY`: Check weight/count limits
- `VALIDATE_CONTAINER_CAPACITY`: Check container capacity

Note: `examine_item` and `read_item` are free actions that don't require operation handlers.

## Testing

Run tests with:

```bash
# Unit tests for operation handlers
npm run test:unit -- tests/unit/logic/operationHandlers/

# Integration tests for items system
npm run test:integration -- tests/integration/mods/items/

# All tests
npm run test:ci
```

## Dependencies

- **core**: Base components (name, description, perceptible_event)
- **positioning**: Location-based queries (position component)

## Example Scenarios

### Simple Item Exchange

```javascript
// Actor 1 gives a revolver to Actor 2
// Prerequisites: Actor 1 has revolver, both actors in same location
{
  "actionId": "items:give_item",
  "actorId": "actor-1",
  "primaryTargetId": "actor-2",
  "secondaryTargetId": "revolver-1"
}
```

### Container Workflow

```javascript
// 1. Open locked chest with key
{
  "actionId": "containers:open_container",
  "actorId": "actor-1",
  "primaryTargetId": "treasure-chest-1"
  // Actor must have brass-key-1 in inventory
}

// 2. Take gold bar from chest
{
  "actionId": "containers:take_from_container",
  "actorId": "actor-1",
  "primaryTargetId": "treasure-chest-1",
  "secondaryTargetId": "gold-bar-1"
}

// 3. Put gold bar back
{
  "actionId": "containers:put_in_container",
  "actorId": "actor-1",
  "primaryTargetId": "treasure-chest-1",
  "secondaryTargetId": "gold-bar-1"
}
```

## Content Creation Tips

1. **Always add weight component** to portable items for proper capacity management
2. **Use descriptive names** for better player experience
3. **Set realistic capacity limits** on inventories and containers
4. **Consider key requirements** for important containers
5. **Add readable content** to letters, books, and documents for immersion
6. **Place items at locations** or in containers during world setup
7. **Test capacity limits** to ensure gameplay balance

## Version History

- **1.0.0**: Initial release with complete items, inventory, and container system
