# Drinking System Implementation Specification

## Overview

This specification defines the implementation of drinking mechanics for the items mod, including two actions (`drink_from` and `drink_entirely`), specialized operation handlers for volume management, and comprehensive state transitions for liquid containers.

## Goals

1. **Partial Consumption**: Allow actors to drink a single serving from a container
2. **Complete Consumption**: Allow actors to drink all remaining liquid from a container
3. **Flavor Text System**: Provide immersive private perception messages with flavor descriptions
4. **Empty State Management**: Track and enforce empty container state to prevent invalid actions
5. **Volume Tracking**: Accurately track liquid volume reduction through consumption

## System Architecture

### Operation Handlers

Two new specialized operation handlers will manage the drinking mechanics:

#### 1. DrinkFromHandler (`src/logic/operationHandlers/drinkFromHandler.js`)

**Purpose**: Process single serving consumption from a liquid container

**Parameters**:
```javascript
{
  actorEntity: string,      // Entity ID of the actor drinking
  containerEntity: string   // Entity ID of the liquid container
}
```

**Dependencies**:
- `IEntityManager`: Entity and component management
- `ILogger`: Logging operations
- `ISafeEventDispatcher`: Event dispatching

**Validation Requirements**:
1. Both `actorEntity` and `containerEntity` must be valid entity IDs
2. Actor must have `core:position` component
3. Container must have both `items:liquid_container` and `items:drinkable` components
4. Container must NOT have `items:empty` component
5. Actor and container must be co-located (same `locationId` in position components)
6. Container's `currentVolumeMilliliters` must be >= `servingSizeMilliliters`

**Processing Logic**:
```javascript
// 1. Get liquid_container component data
const liquidData = entityManager.getComponent(containerEntity, 'items:liquid_container');

// 2. Calculate new volume
const currentVolume = liquidData.currentVolumeMilliliters;
const servingSize = liquidData.servingSizeMilliliters;
const volumeConsumed = Math.min(servingSize, currentVolume);
const newVolume = currentVolume - volumeConsumed;

// 3. Determine state transition
if (newVolume <= 0) {
  // Container is now empty
  batchAddComponentsOptimized(containerEntity, [
    { componentId: 'items:empty', data: {} }
  ]);

  removeComponent(containerEntity, 'items:drinkable');

  modifyComponent(containerEntity, 'items:liquid_container', {
    currentVolumeMilliliters: 0
  });
} else {
  // Still has liquid
  modifyComponent(containerEntity, 'items:liquid_container', {
    currentVolumeMilliliters: newVolume
  });
}

// 4. Dispatch consumption event
safeEventDispatcher.dispatch({
  type: 'items:liquid_consumed',
  payload: {
    actorEntity,
    containerEntity,
    volumeConsumed
  }
});
```

**Return Value**:
```javascript
{
  success: boolean,
  error?: string,
  volumeConsumed?: number,
  flavorText?: string  // Extracted from liquid_container component
}
```

**Error Cases**:
- `"Actor entity not found"` - Invalid actor ID
- `"Container entity not found"` - Invalid container ID
- `"Actor does not have position component"` - Missing required component
- `"Container is not a liquid container"` - Missing liquid_container component
- `"Container is empty"` - Has empty component
- `"Actor and container are not co-located"` - Different locations
- `"Insufficient volume in container"` - Volume < serving size

#### 2. DrinkEntirelyHandler (`src/logic/operationHandlers/drinkEntirelyHandler.js`)

**Purpose**: Process complete consumption of all remaining liquid in a container

**Parameters**: Same as `DrinkFromHandler`

**Validation Requirements**: Same as `DrinkFromHandler`, except no volume >= serving size check (only requires volume > 0)

**Processing Logic**:
```javascript
// 1. Get liquid_container component data
const liquidData = entityManager.getComponent(containerEntity, 'items:liquid_container');
const volumeConsumed = liquidData.currentVolumeMilliliters;

// 2. Always empty the container completely
batchAddComponentsOptimized(containerEntity, [
  { componentId: 'items:empty', data: {} }
]);

removeComponent(containerEntity, 'items:drinkable');

modifyComponent(containerEntity, 'items:liquid_container', {
  currentVolumeMilliliters: 0
});

// 3. Dispatch consumption event
safeEventDispatcher.dispatch({
  type: 'items:liquid_consumed_entirely',
  payload: {
    actorEntity,
    containerEntity,
    volumeConsumed
  }
});
```

**Return Value**:
```javascript
{
  success: boolean,
  error?: string,
  volumeConsumed: number,  // Always returned on success
  flavorText?: string
}
```

### Operation Handler Registration

#### Token Registration (`src/dependencyInjection/tokens.js`)
```javascript
export const tokens = {
  // ... existing tokens
  DrinkFromHandler: 'DrinkFromHandler',
  DrinkEntirelyHandler: 'DrinkEntirelyHandler',
};
```

#### Handler Registration (`src/dependencyInjection/registrations/operationHandlerRegistrations.js`)
```javascript
import DrinkFromHandler from '../../logic/operationHandlers/drinkFromHandler.js';
import DrinkEntirelyHandler from '../../logic/operationHandlers/drinkEntirelyHandler.js';

// Add to handlerFactories array:
{
  type: 'DRINK_FROM',
  factory: (container) => new DrinkFromHandler({
    entityManager: container.resolve(tokens.IEntityManager),
    logger: container.resolve(tokens.ILogger),
    safeEventDispatcher: container.resolve(tokens.ISafeEventDispatcher),
  }),
},
{
  type: 'DRINK_ENTIRELY',
  factory: (container) => new DrinkEntirelyHandler({
    entityManager: container.resolve(tokens.IEntityManager),
    logger: container.resolve(tokens.ILogger),
    safeEventDispatcher: container.resolve(tokens.ISafeEventDispatcher),
  }),
}
```

#### Static Configuration (`src/configuration/staticConfiguration.js`)
```javascript
export const OPERATION_TYPES = {
  // ... existing types
  DRINK_FROM: 'DRINK_FROM',
  DRINK_ENTIRELY: 'DRINK_ENTIRELY',
};
```

### Component Definitions

#### Empty Component (`data/mods/items/components/empty.component.json`)

**Purpose**: Marker component indicating a container is empty and cannot be consumed from

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "items:empty",
  "description": "Marker component indicating a container is empty and cannot be consumed from.",
  "dataSchema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}
```

**Usage**:
- Added when `currentVolumeMilliliters` reaches 0
- Prevents `drink_from` and `drink_entirely` actions via `forbidden_components`
- Removed when container is refilled (future refill mechanic)

### Action Updates

#### drink_from.action.json
```json
{
  "forbidden_components": {
    "primary": ["items:empty"]
  }
}
```

#### drink_entirely.action.json
```json
{
  "forbidden_components": {
    "primary": ["items:empty"]
  }
}
```

### Rule Definitions

#### Condition Files

**`data/mods/items/conditions/event-is-action-drink-from.condition.json`**
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "items:event-is-action-drink-from",
  "description": "Checks if the event is an attempt_action event for drink_from action",
  "condition": {
    "==": [
      { "var": "event.payload.actionId" },
      "items:drink_from"
    ]
  }
}
```

**`data/mods/items/conditions/event-is-action-drink-entirely.condition.json`**
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "items:event-is-action-drink-entirely",
  "description": "Checks if the event is an attempt_action event for drink_entirely action",
  "condition": {
    "==": [
      { "var": "event.payload.actionId" },
      "items:drink_entirely"
    ]
  }
}
```

#### Rule: handle_drink_from.rule.json

**Purpose**: Process drink_from action with dual perception (public + private with flavor)

**Structure**:
```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "id": "items:handle_drink_from",
  "description": "Handles drinking a single serving from a liquid container",
  "priority": 100,
  "conditions": ["items:event-is-action-drink-from"],
  "operations": [
    {
      "type": "DRINK_FROM",
      "params": {
        "actorEntity": { "var": "event.payload.actorId" },
        "containerEntity": { "var": "event.payload.primaryTargetId" }
      },
      "resultVariable": "drinkResult"
    },
    {
      "type": "IF",
      "condition": { "!": { "var": "drinkResult.success" } },
      "then": [
        {
          "type": "DISPATCH_EVENT",
          "params": {
            "eventType": "action:execution_failed",
            "payload": {
              "actorId": { "var": "event.payload.actorId" },
              "actionId": "items:drink_from",
              "reason": { "var": "drinkResult.error" }
            }
          }
        },
        {
          "type": "END_TURN"
        }
      ],
      "else": [
        {
          "type": "GET_NAME",
          "params": {
            "entityId": { "var": "event.payload.actorId" }
          },
          "resultVariable": "actorName"
        },
        {
          "type": "GET_NAME",
          "params": {
            "entityId": { "var": "event.payload.primaryTargetId" }
          },
          "resultVariable": "containerName"
        },
        {
          "type": "QUERY_COMPONENT",
          "params": {
            "entityId": { "var": "event.payload.primaryTargetId" },
            "componentId": "items:liquid_container"
          },
          "resultVariable": "liquidData"
        },
        {
          "type": "DISPATCH_PERCEPTIBLE_EVENT",
          "params": {
            "actorId": { "var": "event.payload.actorId" },
            "locationId": { "var": "event.payload.locationId" },
            "message": {
              "cat": [
                { "var": "actorName" },
                " drinks from ",
                { "var": "containerName" },
                "."
              ]
            },
            "perceptionType": "liquid_consumed_public"
          }
        },
        {
          "type": "DISPATCH_PERCEPTIBLE_EVENT",
          "params": {
            "actorId": { "var": "event.payload.actorId" },
            "locationId": { "var": "event.payload.locationId" },
            "message": {
              "cat": [
                { "var": "actorName" },
                " drinks from ",
                { "var": "containerName" },
                ". ",
                { "var": "liquidData.flavorText" }
              ]
            },
            "perceptionType": "liquid_consumed",
            "recipientIds": [{ "var": "event.payload.actorId" }]
          }
        },
        {
          "type": "SET_VARIABLE",
          "params": {
            "name": "successMessage",
            "value": {
              "cat": [
                { "var": "actorName" },
                " drinks from ",
                { "var": "containerName" },
                ". ",
                { "var": "liquidData.flavorText" }
              ]
            }
          }
        },
        {
          "type": "MACRO",
          "macroId": "core:logSuccessAndEndTurn"
        }
      ]
    }
  ]
}
```

**Key Features**:
1. **Dual Perception**: Public message without flavor, private message with flavor text
2. **Flavor Text Extraction**: Retrieved from `liquid_container.flavorText` field
3. **Private Delivery**: `recipientIds` ensures only actor sees flavor text
4. **Error Handling**: Fails gracefully with appropriate error dispatch

#### Rule: handle_drink_entirely.rule.json

**Purpose**: Process drink_entirely action with dual perception

**Structure**: Nearly identical to `handle_drink_from.rule.json` with these differences:

```json
{
  "operations": [
    {
      "type": "DRINK_ENTIRELY",  // Changed from DRINK_FROM
      // ... rest same
    },
    // In success branch:
    {
      "type": "DISPATCH_PERCEPTIBLE_EVENT",
      "params": {
        "message": {
          "cat": [
            { "var": "actorName" },
            " drinks all of ",  // Changed from "drinks from"
            { "var": "containerName" },
            "."
          ]
        },
        "perceptionType": "liquid_consumed_entirely_public"
      }
    },
    {
      "type": "DISPATCH_PERCEPTIBLE_EVENT",
      "params": {
        "message": {
          "cat": [
            { "var": "actorName" },
            " drinks all of ",  // Changed
            { "var": "containerName" },
            ". ",
            { "var": "liquidData.flavorText" }
          ]
        },
        "perceptionType": "liquid_consumed_entirely",  // Changed
        "recipientIds": [{ "var": "event.payload.actorId" }]
      }
    }
  ]
}
```

## Testing Strategy

### Unit Tests

#### Test File: `tests/unit/logic/operationHandlers/drinkFromHandler.test.js`

**Test Suite Structure**:
```javascript
describe('DrinkFromHandler', () => {
  describe('Constructor', () => {
    it('should validate entityManager dependency');
    it('should validate logger dependency');
    it('should validate safeEventDispatcher dependency');
  });

  describe('execute - Validation', () => {
    it('should return error for invalid actor entity');
    it('should return error for invalid container entity');
    it('should return error when actor lacks position component');
    it('should return error when container lacks liquid_container component');
    it('should return error when container lacks drinkable component');
    it('should return error when container has empty component');
    it('should return error when actor and container not co-located');
    it('should return error when volume less than serving size');
  });

  describe('execute - Volume Management', () => {
    it('should reduce volume by serving size on success');
    it('should return volumeConsumed in result');
    it('should extract and return flavor text from component');
    it('should consume partial serving when less than serving size remains');
  });

  describe('execute - Empty State Transitions', () => {
    it('should set volume to 0 when last sip consumed');
    it('should add empty component when volume reaches 0');
    it('should remove drinkable component when volume reaches 0');
    it('should handle exact serving size remaining correctly');
  });

  describe('execute - Event Dispatching', () => {
    it('should dispatch liquid_consumed event on success');
    it('should include correct payload in event');
  });

  describe('execute - Error Handling', () => {
    it('should not modify state on validation failure');
    it('should log errors appropriately');
  });
});
```

**Test Utilities**:
```javascript
function createTestScenario({
  actorId = 'actor-1',
  containerId = 'mug-1',
  locationId = 'tavern',
  currentVolume = 500,
  maxCapacity = 500,
  servingSize = 100,
  flavorText = 'The ale is cold and refreshing.',
  isEmpty = false
}) {
  // Setup entities with components
  // Return { actorId, containerId, entityManager, handler }
}
```

#### Test File: `tests/unit/logic/operationHandlers/drinkEntirelyHandler.test.js`

**Test Suite Structure**: Similar to `drinkFromHandler.test.js` with adaptations:
```javascript
describe('DrinkEntirelyHandler', () => {
  describe('execute - Complete Consumption', () => {
    it('should consume all remaining volume');
    it('should return volumeConsumed equal to original volume');
    it('should always set volume to 0');
    it('should always add empty component');
    it('should always remove drinkable component');
  });

  describe('execute - Small Volume Handling', () => {
    it('should handle volume less than serving size');
    it('should consume all volume regardless of serving size');
  });
});
```

### Integration Tests

#### Test File: `tests/integration/mods/items/drinkFromRuleExecution.test.js`

**Reference Pattern**: Follow `takeFromContainerRuleExecution.test.js` patterns

**Test Suite Structure**:
```javascript
describe('drink_from Rule Execution', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('items', 'items:drink_from');
  });

  afterEach(() => {
    fixture.cleanup();
  });

  describe('Successful Execution', () => {
    it('should successfully execute drink_from action', async () => {
      const scenario = createDrinkingScenario(fixture);

      await fixture.executeAction(
        scenario.actorId,
        scenario.containerId
      );

      // Assert volume reduced
      const liquidData = fixture.getComponent(
        scenario.containerId,
        'items:liquid_container'
      );
      expect(liquidData.currentVolumeMilliliters).toBe(400); // 500 - 100
    });

    it('should dispatch public perception without flavor text', async () => {
      const scenario = createDrinkingScenario(fixture);
      const events = [];

      fixture.eventBus.on('perceptible_event', (event) => {
        events.push(event);
      });

      await fixture.executeAction(scenario.actorId, scenario.containerId);

      const publicEvent = events.find(
        e => e.payload.perceptionType === 'liquid_consumed_public'
      );
      expect(publicEvent.payload.message).toBe('Alice drinks from mug.');
      expect(publicEvent.payload.message).not.toContain('cold and refreshing');
    });

    it('should dispatch private perception with flavor text', async () => {
      const scenario = createDrinkingScenario(fixture);
      const events = [];

      fixture.eventBus.on('perceptible_event', (event) => {
        events.push(event);
      });

      await fixture.executeAction(scenario.actorId, scenario.containerId);

      const privateEvent = events.find(
        e => e.payload.perceptionType === 'liquid_consumed' &&
             e.payload.recipientIds
      );
      expect(privateEvent.payload.message).toContain('cold and refreshing');
      expect(privateEvent.payload.recipientIds).toEqual([scenario.actorId]);
    });
  });

  describe('Empty State Transitions', () => {
    it('should add empty component when last serving consumed', async () => {
      const scenario = createDrinkingScenario(fixture, {
        currentVolume: 100, // Exactly one serving left
        servingSize: 100
      });

      await fixture.executeAction(scenario.actorId, scenario.containerId);

      expect(
        fixture.hasComponent(scenario.containerId, 'items:empty')
      ).toBe(true);
    });

    it('should remove drinkable component when emptied', async () => {
      const scenario = createDrinkingScenario(fixture, {
        currentVolume: 100,
        servingSize: 100
      });

      await fixture.executeAction(scenario.actorId, scenario.containerId);

      expect(
        fixture.hasComponent(scenario.containerId, 'items:drinkable')
      ).toBe(false);
    });

    it('should set volume to 0 when emptied', async () => {
      const scenario = createDrinkingScenario(fixture, {
        currentVolume: 50,
        servingSize: 100
      });

      await fixture.executeAction(scenario.actorId, scenario.containerId);

      const liquidData = fixture.getComponent(
        scenario.containerId,
        'items:liquid_container'
      );
      expect(liquidData.currentVolumeMilliliters).toBe(0);
    });
  });

  describe('Validation Failures', () => {
    it('should fail when actor not co-located with container', async () => {
      const scenario = createDrinkingScenario(fixture, {
        actorLocation: 'tavern',
        containerLocation: 'kitchen'
      });

      await expect(
        fixture.executeAction(scenario.actorId, scenario.containerId)
      ).rejects.toThrow(/not co-located/);
    });

    it('should fail when insufficient volume', async () => {
      const scenario = createDrinkingScenario(fixture, {
        currentVolume: 50,
        servingSize: 100
      });

      await expect(
        fixture.executeAction(scenario.actorId, scenario.containerId)
      ).rejects.toThrow(/insufficient volume/);
    });
  });

  describe('Multiple Consumption Workflow', () => {
    it('should allow multiple drinks until empty', async () => {
      const scenario = createDrinkingScenario(fixture, {
        currentVolume: 300,
        servingSize: 100
      });

      // First drink
      await fixture.executeAction(scenario.actorId, scenario.containerId);
      let liquidData = fixture.getComponent(
        scenario.containerId,
        'items:liquid_container'
      );
      expect(liquidData.currentVolumeMilliliters).toBe(200);

      // Second drink
      await fixture.executeAction(scenario.actorId, scenario.containerId);
      liquidData = fixture.getComponent(
        scenario.containerId,
        'items:liquid_container'
      );
      expect(liquidData.currentVolumeMilliliters).toBe(100);

      // Third drink (empties container)
      await fixture.executeAction(scenario.actorId, scenario.containerId);
      liquidData = fixture.getComponent(
        scenario.containerId,
        'items:liquid_container'
      );
      expect(liquidData.currentVolumeMilliliters).toBe(0);
      expect(fixture.hasComponent(scenario.containerId, 'items:empty')).toBe(true);
    });
  });
});
```

**Helper Function**:
```javascript
function createDrinkingScenario(fixture, options = {}) {
  const {
    actorName = 'Alice',
    actorLocation = 'tavern',
    containerLocation = 'tavern',
    containerName = 'mug',
    currentVolume = 500,
    maxCapacity = 500,
    servingSize = 100,
    flavorText = 'The ale is cold and refreshing.',
    isRefillable = true
  } = options;

  // Create actor with position
  const actorId = fixture.createEntity({
    name: actorName,
    components: [
      {
        componentId: 'core:position',
        data: { locationId: actorLocation }
      }
    ]
  });

  // Create container with liquid and drinkable components
  const containerId = fixture.createEntity({
    name: containerName,
    components: [
      {
        componentId: 'core:position',
        data: { locationId: containerLocation }
      },
      {
        componentId: 'items:liquid_container',
        data: {
          currentVolumeMilliliters: currentVolume,
          maxCapacityMilliliters: maxCapacity,
          servingSizeMilliliters: servingSize,
          flavorText,
          isRefillable
        }
      },
      {
        componentId: 'items:drinkable',
        data: {}
      }
    ]
  });

  return { actorId, containerId, actorName, containerName };
}
```

#### Test File: `tests/integration/mods/items/drinkEntirelyRuleExecution.test.js`

**Test Suite Structure**: Similar to drink_from with focus on complete consumption:
```javascript
describe('drink_entirely Rule Execution', () => {
  describe('Complete Consumption', () => {
    it('should consume all volume regardless of serving size', async () => {
      const scenario = createDrinkingScenario(fixture, {
        currentVolume: 250,
        servingSize: 100
      });

      await fixture.executeAction(scenario.actorId, scenario.containerId);

      const liquidData = fixture.getComponent(
        scenario.containerId,
        'items:liquid_container'
      );
      expect(liquidData.currentVolumeMilliliters).toBe(0);
    });

    it('should always add empty component', async () => {
      const scenario = createDrinkingScenario(fixture, {
        currentVolume: 50
      });

      await fixture.executeAction(scenario.actorId, scenario.containerId);

      expect(
        fixture.hasComponent(scenario.containerId, 'items:empty')
      ).toBe(true);
    });

    it('should use correct perception messages', async () => {
      const scenario = createDrinkingScenario(fixture);
      const events = [];

      fixture.eventBus.on('perceptible_event', (event) => {
        events.push(event);
      });

      await fixture.executeAction(scenario.actorId, scenario.containerId);

      const publicEvent = events.find(
        e => e.payload.perceptionType === 'liquid_consumed_entirely_public'
      );
      expect(publicEvent.payload.message).toBe('Alice drinks all of mug.');
    });
  });
});
```

### Action Discovery Tests

#### Test File: `tests/integration/mods/items/drinkFromActionDiscovery.test.js`

**Test Suite Structure**:
```javascript
describe('drink_from Action Discovery', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('items', 'items:drink_from');
  });

  afterEach(() => {
    fixture.cleanup();
  });

  describe('Action Availability', () => {
    it('should discover drink_from for drinkable containers', async () => {
      const scenario = createDrinkingScenario(fixture);

      const actions = await fixture.discoverActions(scenario.actorId);

      expect(actions).toContainAction('items:drink_from', {
        primaryTargetId: scenario.containerId
      });
    });

    it('should NOT discover drink_from for empty containers', async () => {
      const scenario = createDrinkingScenario(fixture, {
        currentVolume: 0
      });

      // Manually add empty component
      fixture.addComponent(scenario.containerId, 'items:empty', {});

      const actions = await fixture.discoverActions(scenario.actorId);

      expect(actions).not.toContainAction('items:drink_from', {
        primaryTargetId: scenario.containerId
      });
    });

    it('should NOT discover drink_from when not co-located', async () => {
      const scenario = createDrinkingScenario(fixture, {
        actorLocation: 'tavern',
        containerLocation: 'kitchen'
      });

      const actions = await fixture.discoverActions(scenario.actorId);

      expect(actions).not.toContainAction('items:drink_from');
    });

    it('should NOT discover drink_from for non-drinkable items', async () => {
      const actorId = fixture.createEntity({
        name: 'Alice',
        components: [
          { componentId: 'core:position', data: { locationId: 'tavern' } }
        ]
      });

      const nonDrinkableId = fixture.createEntity({
        name: 'rock',
        components: [
          { componentId: 'core:position', data: { locationId: 'tavern' } }
        ]
      });

      const actions = await fixture.discoverActions(actorId);

      expect(actions).not.toContainAction('items:drink_from');
    });
  });
});
```

#### Test File: `tests/integration/mods/items/drinkEntirelyActionDiscovery.test.js`

**Test Suite Structure**: Mirror drink_from patterns adapted for drink_entirely action

## Implementation Phases

### Phase 1: Infrastructure (Operation Handlers)
**Priority**: Critical - Required for all subsequent phases

**Files**:
1. `src/logic/operationHandlers/drinkFromHandler.js`
2. `src/logic/operationHandlers/drinkEntirelyHandler.js`
3. `src/dependencyInjection/tokens.js` (add tokens)
4. `src/dependencyInjection/registrations/operationHandlerRegistrations.js` (register handlers)
5. `src/configuration/staticConfiguration.js` (add operation types)

**Validation**:
- Unit tests pass for both handlers
- Handlers registered correctly in DI container
- Operation types recognized by system

### Phase 2: Components and Actions
**Priority**: High - Required for rule execution

**Files**:
1. `data/mods/items/components/empty.component.json` (new)
2. `data/mods/items/actions/drink_from.action.json` (modify: add forbidden_components)
3. `data/mods/items/actions/drink_entirely.action.json` (modify: add forbidden_components)

**Validation**:
- Empty component schema validates
- Actions correctly prevent usage on empty containers
- Component manifest updated

### Phase 3: Rules Implementation
**Priority**: High - Core gameplay logic

**Files**:
1. `data/mods/items/conditions/event-is-action-drink-from.condition.json`
2. `data/mods/items/conditions/event-is-action-drink-entirely.condition.json`
3. `data/mods/items/rules/handle_drink_from.rule.json`
4. `data/mods/items/rules/handle_drink_entirely.rule.json`

**Validation**:
- Rules trigger on correct events
- Dual perception system works (public + private)
- Flavor text extraction functional
- Empty state transitions occur correctly

### Phase 4: Testing
**Priority**: Critical - Ensures quality and prevents regressions

**Files**:
1. `tests/unit/logic/operationHandlers/drinkFromHandler.test.js`
2. `tests/unit/logic/operationHandlers/drinkEntirelyHandler.test.js`
3. `tests/integration/mods/items/drinkFromRuleExecution.test.js`
4. `tests/integration/mods/items/drinkEntirelyRuleExecution.test.js`
5. `tests/integration/mods/items/drinkFromActionDiscovery.test.js`
6. `tests/integration/mods/items/drinkEntirelyActionDiscovery.test.js`

**Validation**:
- All unit tests pass with 80%+ coverage
- All integration tests pass
- Action discovery tests verify correct behavior
- No ESLint errors

### Phase 5: Documentation
**Priority**: Medium - Important for maintainability

**Files**:
1. `docs/actions/drinking-actions.md` (new)
2. `docs/systems/items-system.md` (update if exists)

**Content**:
- Explain drink_from vs drink_entirely mechanics
- Document volume tracking system
- Document empty state transitions
- Provide usage examples

## File Summary

### New Files (19 total)

**Source Code** (2):
1. `src/logic/operationHandlers/drinkFromHandler.js`
2. `src/logic/operationHandlers/drinkEntirelyHandler.js`

**Modified Source Files** (3):
3. `src/dependencyInjection/tokens.js`
4. `src/dependencyInjection/registrations/operationHandlerRegistrations.js`
5. `src/configuration/staticConfiguration.js`

**Data Files** (5):
6. `data/mods/items/components/empty.component.json` (new)
7. `data/mods/items/conditions/event-is-action-drink-from.condition.json` (new)
8. `data/mods/items/conditions/event-is-action-drink-entirely.condition.json` (new)
9. `data/mods/items/rules/handle_drink_from.rule.json` (new)
10. `data/mods/items/rules/handle_drink_entirely.rule.json` (new)

**Modified Data Files** (2):
11. `data/mods/items/actions/drink_from.action.json`
12. `data/mods/items/actions/drink_entirely.action.json`

**Test Files** (6):
13. `tests/unit/logic/operationHandlers/drinkFromHandler.test.js`
14. `tests/unit/logic/operationHandlers/drinkEntirelyHandler.test.js`
15. `tests/integration/mods/items/drinkFromRuleExecution.test.js`
16. `tests/integration/mods/items/drinkEntirelyRuleExecution.test.js`
17. `tests/integration/mods/items/drinkFromActionDiscovery.test.js`
18. `tests/integration/mods/items/drinkEntirelyActionDiscovery.test.js`

**Documentation** (1):
19. `docs/actions/drinking-actions.md`

## Success Criteria

### Functional Requirements
✅ Actor can drink single serving from container with volume reduction
✅ Actor can drink entire contents of container
✅ Flavor text appears in private perception message to actor only
✅ Public perception shows drinking action without flavor text
✅ Container becomes empty (gains empty component, loses drinkable) when volume reaches 0
✅ Cannot drink from empty containers (forbidden via action definition)
✅ Cannot drink when not co-located with container
✅ Volume tracking is accurate across multiple drinks

### Quality Requirements
✅ All unit tests pass with 80%+ branch coverage
✅ All integration tests pass
✅ Action discovery tests verify correct availability
✅ No ESLint errors in new code
✅ Type checking passes (npm run typecheck)
✅ All operation handler schemas validate
✅ All rule JSON validates against schemas

### Code Quality
✅ Follows project naming conventions (camelCase files, PascalCase classes)
✅ Uses dependency injection for all services
✅ Includes JSDoc comments for public APIs
✅ Error handling follows project patterns (no direct console logging)
✅ Uses `batchAddComponentsOptimized` for atomic updates
✅ Validation uses project utility functions

### Documentation
✅ Implementation patterns documented
✅ Usage examples provided
✅ Edge cases explained

## Design Decisions

### Dual Perception System
**Decision**: Use separate perception events for public and private messages

**Rationale**:
- Public message keeps other players informed without spoiling immersion
- Private message with flavor text enhances immersion for the actor
- Follows established pattern for private/public information in the game

**Implementation**: Two `DISPATCH_PERCEPTIBLE_EVENT` operations with different perception types and the private one having `recipientIds`

### Empty Component as Marker
**Decision**: Use marker component instead of boolean flag in liquid_container

**Rationale**:
- Allows use of `forbidden_components` in action definitions
- Follows ECS pattern of using components for state
- Enables future refill mechanics to simply remove component
- Consistent with other item state patterns (e.g., `items:open`)

### Specialized Operation Handlers
**Decision**: Create dedicated handlers instead of using atomic operations

**Rationale**:
- Volume management logic is too complex for JSON Logic
- Requires conditional component addition/removal
- Benefits from centralized validation
- Allows for event dispatching within handler
- Enables reuse for future liquid-related actions

### Flavor Text in Private Perception
**Decision**: Extract flavor text from component and include in private message

**Rationale**:
- Enhances immersion for the drinking actor
- Keeps flavor text data co-located with liquid container
- Allows different containers to have unique flavor descriptions
- Private delivery prevents spoiling for other players

### Volume Consumption Logic
**Decision**: Consume `min(servingSize, currentVolume)` for drink_from

**Rationale**:
- Gracefully handles last partial serving
- Prevents negative volumes
- Realistic behavior (can't drink more than what's left)
- drink_entirely always consumes all, providing clear distinction

## Future Considerations

### Refill Mechanics
When implementing refill actions:
- Remove `items:empty` component
- Add `items:drinkable` component
- Set appropriate volume in `liquid_container`

### Multiple Liquid Types
Consider adding:
- `liquidType` field to `liquid_container` (e.g., "water", "ale", "wine")
- Different flavor text based on liquid type
- Effects based on liquid consumed (future status effects system)

### Container Variety
Support different container behaviors:
- Non-refillable containers (bottles, cans)
- Multi-serving containers (pitchers, barrels)
- Temperature tracking (hot coffee, cold water)

### Spillage Mechanics
Future enhancement:
- Spill action when container is knocked over
- Partial spillage during movement
- Wet ground effects

## References

### Similar Systems
- **takeFromContainer**: Pattern for item interaction with containers
- **putInContainer**: Pattern for container capacity validation
- **transferItem**: Pattern for item movement between locations
- **openContainer**: Pattern for container state changes

### Test Patterns
- `tests/integration/mods/items/takeFromContainerRuleExecution.test.js`: Rule execution pattern
- `tests/integration/mods/items/containerWorkflow.test.js`: Multi-step workflow pattern
- `tests/unit/logic/operationHandlers/takeFromContainerHandler.test.js`: Handler unit test pattern

### Documentation
- `docs/testing/mod-testing-guide.md`: Primary testing reference
- `CLAUDE.md`: Project architecture and patterns
- `docs/systems/ecs-architecture.md`: ECS patterns (if exists)

---

**Specification Version**: 1.0
**Created**: 2025-01-07
**Status**: Ready for Implementation
