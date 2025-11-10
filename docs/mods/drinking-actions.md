# Drinking Actions System

## Overview

The drinking actions system provides two operation handlers for consuming liquids from drinkable containers: `DrinkFromHandler` (consume one serving) and `DrinkEntirelyHandler` (consume all remaining liquid).

## Components

### Operation Handlers

#### DrinkFromHandler

**Location**: `src/logic/operationHandlers/drinkFromHandler.js`

Consumes one serving from a liquid container. If the remaining volume is less than one serving, consumes all remaining liquid and empties the container.

**Operation Type**: `DRINK_FROM`

**Parameters**:
- `actorEntity` (string): Entity ID of the drinking actor
- `containerEntity` (string): Entity ID of the liquid container

**Returns**:
```javascript
{
  success: boolean,
  error?: string,           // If failed
  volumeConsumed?: number,  // Milliliters consumed if successful
  flavorText?: string       // Flavor description if successful
}
```

**Behavior**:
1. Validates actor and container are co-located
2. Checks container has `items:liquid_container` and `items:drinkable` components
3. Checks container is not empty (`items:empty` component absent)
4. Consumes `min(servingSizeMilliliters, currentVolumeMilliliters)`
5. If volume reaches zero:
   - Adds `items:empty` component
   - Removes `items:drinkable` component
   - Sets `currentVolumeMilliliters` to 0
6. Dispatches `items:liquid_consumed` event

#### DrinkEntirelyHandler

**Location**: `src/logic/operationHandlers/drinkEntirelyHandler.js`

Consumes all remaining liquid from a container, always resulting in an empty container regardless of serving size.

**Operation Type**: `DRINK_ENTIRELY`

**Parameters**: Same as `DrinkFromHandler`

**Returns**: Same as `DrinkFromHandler`

**Behavior**:
1. Same validation as `DrinkFromHandler`
2. Consumes ALL `currentVolumeMilliliters` (ignores serving size)
3. Always empties container:
   - Adds `items:empty` component
   - Removes `items:drinkable` component
   - Sets `currentVolumeMilliliters` to 0
4. Dispatches `items:liquid_consumed_entirely` event

### Components

#### items:liquid_container

**Schema**: `data/mods/items/components/liquid_container.component.json`

Defines a container that holds liquid with volume tracking.

**Properties**:
- `currentVolumeMilliliters` (number, required): Current liquid volume
- `servingSizeMilliliters` (number, required): Volume consumed per serving
- `flavorText` (string, optional): Flavor description for actor

#### items:drinkable

**Schema**: `data/mods/items/components/drinkable.component.json`

Marker component indicating a liquid container can be consumed from.

**Properties**: None (marker component)

#### items:empty

**Schema**: `data/mods/items/components/empty.component.json`

Marker component indicating a liquid container has no remaining liquid.

**Properties**: None (marker component)

**Purpose**: Prevents drinking actions when present via `forbidden_components` in action definitions.

### Actions

#### items:drink_from

**File**: `data/mods/items/actions/drink_from.action.json`

**Description**: Consume one serving from a drinkable container.

**Target**: Single target (container) from `items:examinable_items` scope

**Required Components**:
- `items:drinkable`
- `items:liquid_container`

**Forbidden Components**:
- `items:empty`

**Template**: "drink from {primary}"

#### items:drink_entirely

**File**: `data/mods/items/actions/drink_entirely.action.json`

**Description**: Consume all remaining liquid from a drinkable container, emptying it completely.

**Target**: Single target (container) from `items:examinable_items` scope

**Required Components**:
- `items:drinkable`
- `items:liquid_container`

**Forbidden Components**:
- `items:empty`

**Template**: "drink entirety of {primary}"

### Rules

#### handle_drink_from

**File**: `data/mods/items/rules/handle_drink_from.rule.json`

**Event Type**: `core:attempt_action`

**Condition**: `items:event-is-action-drink-from`

**Actions**:
1. Execute `DRINK_FROM` operation
2. Query actor position for location
3. Get actor and container names
4. Dispatch public perceptible event (no flavor text)
5. Dispatch private perceptible event (with flavor text, `recipientIds: [actorId]`)
6. End turn

#### handle_drink_entirely

**File**: `data/mods/items/rules/handle_drink_entirely.rule.json`

**Event Type**: `core:attempt_action`

**Condition**: `items:event-is-action-drink-entirely`

**Actions**: Same as `handle_drink_from` but uses:
- `DRINK_ENTIRELY` operation
- `liquid_consumed_entirely` perception type

## Dual Perception System

Both drinking actions implement a dual perception system for flavor text privacy:

### Public Message (All Observers)

```javascript
{
  type: "DISPATCH_PERCEPTIBLE_EVENT",
  parameters: {
    location_id: "{context.actorPosition.locationId}",
    description_text: "{context.actorName} drinks from {context.containerName}.",
    perception_type: "liquid_consumed",
    actor_id: "{event.payload.actorId}",
    target_id: "{event.payload.targetId}",
    contextual_data: {
      volumeConsumed: "{context.drinkResult.volumeConsumed}"
    }
    // NO recipientIds - visible to all
  }
}
```

**Visibility**: All entities in the same location see this message

**Content**: Actor name, container name, no flavor text

### Private Message (Actor Only)

```javascript
{
  type: "DISPATCH_PERCEPTIBLE_EVENT",
  parameters: {
    location_id: "{context.actorPosition.locationId}",
    description_text: "{context.actorName} drinks from {context.containerName}. {context.drinkResult.flavorText}",
    perception_type: "liquid_consumed",
    actor_id: "{event.payload.actorId}",
    target_id: "{event.payload.targetId}",
    recipientIds: ["{event.payload.actorId}"],  // Only actor sees this
    contextual_data: {
      volumeConsumed: "{context.drinkResult.volumeConsumed}",
      flavorText: "{context.drinkResult.flavorText}"
    }
  }
}
```

**Visibility**: Only the drinking actor sees this message

**Content**: Full message with flavor text appended

## Operation Schemas

### drinkFrom.schema.json

**Location**: `data/schemas/operations/drinkFrom.schema.json`

**Properties**:
- `actorEntity`: string, required
- `containerEntity`: string, required

### drinkEntirely.schema.json

**Location**: `data/schemas/operations/drinkEntirely.schema.json`

**Properties**: Same as `drinkFrom.schema.json`

## Events

### items:liquid_consumed

Dispatched when a serving is consumed via `DRINK_FROM`.

**Payload**:
```javascript
{
  actorEntity: string,      // Entity ID of actor
  containerEntity: string,  // Entity ID of container
  volumeConsumed: number    // Milliliters consumed
}
```

### items:liquid_consumed_entirely

Dispatched when all liquid is consumed via `DRINK_ENTIRELY`.

**Payload**: Same as `items:liquid_consumed`

## Dependency Injection

### Tokens

**File**: `src/dependencyInjection/tokens/tokens-core.js`

```javascript
DrinkFromHandler: 'DrinkFromHandler',
DrinkEntirelyHandler: 'DrinkEntirelyHandler',
```

### Handler Registration

**File**: `src/dependencyInjection/registrations/operationHandlerRegistrations.js`

Both handlers registered as singletons with dependencies:
- `ILogger`
- `IEntityManager`
- `ISafeEventDispatcher`

### Operation Registration

**File**: `src/dependencyInjection/registrations/interpreterRegistrations.js`

```javascript
registry.register('DRINK_FROM', bind(tokens.DrinkFromHandler));
registry.register('DRINK_ENTIRELY', bind(tokens.DrinkEntirelyHandler));
```

### Schema Registration

**File**: `src/configuration/staticConfiguration.js`

```javascript
operationSchemas: [
  // ...
  'drinkEntirely.schema.json',
  'drinkFrom.schema.json',
  // ...
]
```

## Usage Examples

### Basic Drinking Scenario

```javascript
// Create drinkable container
const waterBottle = new ModEntityBuilder('water-bottle-1')
  .withName('Water Bottle')
  .atLocation('saloon')
  .withComponent('items:liquid_container', {
    currentVolumeMilliliters: 500,
    servingSizeMilliliters: 200,
    flavorText: 'The water is refreshing.'
  })
  .withComponent('items:drinkable', {})
  .build();

// Actor drinks one serving (200ml)
await executeAction('actor1', 'water-bottle-1'); // drink_from action

// Result: Container now has 300ml remaining, still drinkable

// Actor drinks entirely (all 300ml)
await executeAction('actor1', 'water-bottle-1'); // drink_entirely action

// Result: Container empty, has empty component, no drinkable component
```

### Partial Serving Scenario

```javascript
// Container with less than one serving
const flask = new ModEntityBuilder('flask-1')
  .withName('Flask')
  .atLocation('camp')
  .withComponent('items:liquid_container', {
    currentVolumeMilliliters: 100,  // Less than serving size
    servingSizeMilliliters: 200,
    flavorText: 'Almost empty.'
  })
  .withComponent('items:drinkable', {})
  .build();

// Actor drinks from container
await executeAction('actor1', 'flask-1'); // drink_from action

// Result: Consumes all 100ml (not 200ml), container now empty
```

### Multiple Servings Scenario

```javascript
// Container with multiple servings
const pitcher = new ModEntityBuilder('pitcher-1')
  .withName('Pitcher')
  .atLocation('inn')
  .withComponent('items:liquid_container', {
    currentVolumeMilliliters: 600,
    servingSizeMilliliters: 200,
    flavorText: 'Good wine.'
  })
  .withComponent('items:drinkable', {})
  .build();

// Drink multiple times
await executeAction('actor1', 'pitcher-1'); // 400ml remaining
await executeAction('actor1', 'pitcher-1'); // 200ml remaining
await executeAction('actor1', 'pitcher-1'); // Empty, drink_from not available

// Alternative: Drink entirely in one action
await executeAction('actor1', 'pitcher-1'); // drink_entirely action
// Result: All 600ml consumed immediately, container empty
```

## Testing

### Unit Tests

- **DrinkFromHandler**: `tests/unit/logic/operationHandlers/drinkFromHandler.test.js`
  - 16 test cases covering constructor, success, failure, and edge cases

- **DrinkEntirelyHandler**: `tests/unit/logic/operationHandlers/drinkEntirelyHandler.test.js`
  - 16 test cases covering constructor, success, failure, and edge cases

### Integration Tests

- **drink_from rule**: `tests/integration/mods/items/drinkFromRuleExecution.test.js`
  - Success scenarios: normal serving, exact serving, partial volume, multiple drinks
  - Perception system: public/private messages, flavor text handling
  - Empty container behavior, edge cases

- **drink_entirely rule**: `tests/integration/mods/items/drinkEntirelyRuleExecution.test.js`
  - Success scenarios: small/large volumes, ignoring serving size
  - Perception system: public/private messages, flavor text handling
  - Empty container behavior, comparison with drink_from

### Running Tests

```bash
# Unit tests
npm run test:unit -- tests/unit/logic/operationHandlers/drinkFromHandler.test.js
npm run test:unit -- tests/unit/logic/operationHandlers/drinkEntirelyHandler.test.js

# Integration tests
npm run test:integration -- tests/integration/mods/items/drinkFromRuleExecution.test.js
npm run test:integration -- tests/integration/mods/items/drinkEntirelyRuleExecution.test.js

# All drinking tests
npm run test:unit -- --testPathPattern="drink"
npm run test:integration -- --testPathPattern="drink"
```

## Implementation Notes

### Volume Consumption Logic

**drink_from**:
```javascript
const volumeConsumed = Math.min(servingSize, currentVolume);
const newVolume = currentVolume - volumeConsumed;

if (newVolume <= 0) {
  // Empty transition
  await addEmptyComponent();
  await removeDrinkableComponent();
  await setVolumeToZero();
}
```

**drink_entirely**:
```javascript
const volumeConsumed = currentVolume; // Always consume all

// Always empty
await addEmptyComponent();
await removeDrinkableComponent();
await setVolumeToZero();
```

### Empty State Transitions

When a container is emptied:

1. **Add** `items:empty` component via `batchAddComponentsOptimized`
2. **Remove** `items:drinkable` component via `removeComponent`
3. **Update** `items:liquid_container.currentVolumeMilliliters` to 0 via `modifyComponent`

This prevents the action from being discovered on empty containers via `forbidden_components`.

### Error Handling

All validation failures dispatch `SYSTEM_ERROR_OCCURRED` events and return structured errors:

```javascript
{
  success: false,
  error: 'descriptive error message'
}
```

Common errors:
- "validation_failed" - Invalid parameters
- "Actor does not have position component"
- "Container is not a liquid container"
- "Container is not drinkable"
- "Container is empty"
- "Actor and container are not co-located"
- "Container has no liquid"
- "Insufficient volume in container" (drink_from only)

## Future Enhancements

Possible extensions to the drinking system:

1. **Hydration tracking**: Track actor hydration levels affected by drinking
2. **Liquid types**: Different effects based on liquid type (water, ale, poison)
3. **Temperature**: Hot/cold liquids with different effects
4. **Container properties**: Glass vs. waterskin vs. barrel interactions
5. **Sharing drinks**: Multi-actor drinking scenarios
6. **Refilling**: Operations to refill empty containers
7. **Mixing**: Combine liquids from multiple containers
8. **Container size limitations**: Physical constraints on drinking speed

## See Also

- [Operation Handlers Guide](./operation-handlers.md)
- [Mod Testing Guide](./testing/mod-testing-guide.md)
- [Component System](./components.md)
- [Event System](./events.md)
