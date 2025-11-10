# Dimensional Travel Restrictions Specification

## Overview

This specification defines the implementation of dimensional travel restrictions for the patrol mod demo scenario. The system introduces blocked exits and entity-specific travel affordances to prevent inappropriate cross-dimensional movement while allowing specific entities (like the Writhing Observer) to traverse dimensional boundaries.

## Goals

1. **Blocked Exit System**: Implement exit blocking mechanism to prevent standard movement through certain portals
2. **Dimensional Portal Component**: Mark exits that connect different dimensions
3. **Interdimensional Travel Affordance**: Create component for entities capable of dimensional travel
4. **Dimension-Specific Action**: Create specialized action for interdimensional travel
5. **Scope Filtering**: Ensure standard "go" action excludes blocked exits
6. **Selective Access**: Allow humans (Len Amezua, Dylan Crace) to remain in normal reality while allowing eldritch entities to travel between dimensions

## Context: The Patrol Mod Scenario

### Characters
- **Len Amezua** (`patrol:len_amezua`): Human sentinel, industrial safety background
- **Dylan Crace** (`patrol:dylan_crace`): Human sentinel, ex-military contractor
- **Writhing Observer** (`patrol:writhing_observer`): Eldritch entity from beyond the rip in reality

### Locations
- **Perimeter of Rip in Reality** (`patrol:perimeter_of_rip_in_reality`): Salt flats with visible dimensional rift
- **Eldritch Dimension** (`patrol:eldritch_dimension`): Alien dimension beyond the rift

### Current Problem
All characters can freely use `movement:go` to travel between dimensions. This breaks narrative logic:
- Humans shouldn't be able to cross dimensional boundaries
- Only entities with dimensional travel capabilities should traverse the rift
- The exit system needs blocking capability

## System Architecture

### Component Definitions

#### 1. Dimensional Portal Marker (`patrol:is_dimensional_portal`)

**Purpose**: Mark exit destinations that represent dimensional boundaries

**File**: `data/mods/patrol/components/is_dimensional_portal.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "patrol:is_dimensional_portal",
  "description": "Marker component indicating this exit connects to a different dimension and requires special abilities to traverse.",
  "dataSchema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}
```

**Usage**:
- Applied to entities referenced as blockers in exit definitions
- Signals that standard movement is insufficient
- Enables specialized scope filtering for dimensional travel actions

#### 2. Interdimensional Travel Affordance (`patrol:can_travel_through_dimensions`)

**Purpose**: Grant entities the ability to traverse dimensional boundaries

**File**: `data/mods/patrol/components/can_travel_through_dimensions.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "patrol:can_travel_through_dimensions",
  "description": "Marker component indicating this entity can travel between dimensions through tears in reality.",
  "dataSchema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}
```

**Usage**:
- Applied to Writhing Observer and similar eldritch entities
- Similar pattern to `movement:can_teleport`
- Required by dimensional travel actions

### Blocker Entity Definition

#### Dimensional Rift Blocker (`patrol:dimensional_rift_blocker`)

**Purpose**: Entity representing the impassable dimensional boundary for standard movement

**File**: `data/mods/patrol/entities/definitions/dimensional_rift_blocker.entity.json`

```json
{
  "$schema": "http://example.com/schemas/entity-definition.schema.json",
  "id": "patrol:dimensional_rift_blocker",
  "components": {
    "core:name": {
      "text": "dimensional rift"
    },
    "core:description": {
      "text": "A shimmering tear in reality that bends light and warps space. Crossing it requires more than physical movement—it demands the ability to exist across dimensions."
    },
    "patrol:is_dimensional_portal": {}
  }
}
```

**Instantiation**: Entity must be instantiated in game.json or spawned at runtime to be referenced by exits

### Location Updates

#### Perimeter of Rip in Reality

**File**: `data/mods/patrol/entities/definitions/perimeter_of_rip_in_reality.location.json`

**Changes**:
```json
{
  "components": {
    "movement:exits": [
      {
        "direction": "through the dimensional rift",
        "target": "patrol:eldritch_dimension_instance",
        "blocker": "patrol:dimensional_rift_blocker_instance"
      }
    ]
  }
}
```

**Key Changes**:
- `blocker` changes from `null` to entity instance reference
- `direction` becomes more descriptive of dimensional transition

#### Eldritch Dimension

**File**: `data/mods/patrol/entities/definitions/eldritch_dimension.location.json`

**Changes**:
```json
{
  "components": {
    "movement:exits": [
      {
        "direction": "through the dimensional tear back to reality",
        "target": "patrol:perimeter_of_rip_in_reality_instance",
        "blocker": "patrol:dimensional_rift_blocker_instance"
      }
    ]
  }
}
```

**Key Changes**:
- Same blocker entity (rift blocks in both directions)
- Direction emphasizes return to normal reality

### Scope Definitions

#### Dimensional Portals Scope

**Purpose**: Identify exits that connect to other dimensions and are accessible to dimensional travelers

**File**: `data/mods/patrol/scopes/dimensional_portals.scope`

```
patrol:dimensional_portals := location.movement:exits[
    { "and": [
        { "var": "entity.blocker" },
        { "condition_ref": "patrol:blocker-is-dimensional-portal" }
    ]}
].target
```

**Logic**:
1. Filter location exits that have a blocker
2. Further filter to blockers with `patrol:is_dimensional_portal` component
3. Extract target destinations

**Dependencies**:
- Requires `patrol:blocker-is-dimensional-portal` condition

#### Blocker Is Dimensional Portal Condition

**File**: `data/mods/patrol/conditions/blocker-is-dimensional-portal.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "patrol:blocker-is-dimensional-portal",
  "description": "Checks if the blocker entity has the is_dimensional_portal marker component",
  "logic": {
    "has_component": [
      { "var": "entity.blocker" },
      "patrol:is_dimensional_portal"
    ]
  }
}
```

**Note**: Assumes `has_component` JSON Logic operation exists or requires custom resolver

### Action Definitions

#### Travel Through Dimensions Action

**Purpose**: Allow entities with dimensional travel capability to cross dimensional boundaries

**File**: `data/mods/patrol/actions/travel_through_dimensions.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "patrol:travel_through_dimensions",
  "name": "Travel Through Dimensions",
  "description": "Slip through the tear in reality, traversing the boundary between dimensions. Your form ripples and distorts as you step into alien geometries.",
  "targets": {
    "primary": {
      "scope": "patrol:dimensional_portals",
      "placeholder": "destination",
      "description": "Dimensional destination to travel to"
    }
  },
  "required_components": {
    "actor": ["patrol:can_travel_through_dimensions"]
  },
  "template": "travel through dimensions to {destination}",
  "visual": {
    "backgroundColor": "#1a0033",
    "textColor": "#cc99ff",
    "hoverBackgroundColor": "#330066",
    "hoverTextColor": "#e6ccff"
  },
  "metadata": {
    "category": "dimensional",
    "tags": ["dimensional", "supernatural", "eldritch", "movement"]
  }
}
```

**Key Features**:
- Uses `patrol:dimensional_portals` scope (only blocked exits with dimensional portal markers)
- Requires `patrol:can_travel_through_dimensions` component
- Distinct visual styling (dark purple/cosmic theme)
- Immersive description matching eldritch theme

#### Movement:Go Action (No Changes Required)

**File**: `data/mods/movement/actions/go.action.json`

**Current Behavior**:
```json
{
  "targets": {
    "primary": {
      "scope": "movement:clear_directions"
    }
  }
}
```

**Scope Resolution**:
```
movement:clear_directions := location.movement:exits[
    { "condition_ref": "movement:exit-is-unblocked" }
].target
```

**Existing Condition**:
```json
{
  "id": "movement:exit-is-unblocked",
  "logic": {
    "!": { "var": "entity.blocker" }
  }
}
```

**Why No Changes Needed**:
- Scope already filters for `blocker` being null/falsy
- Adding blockers to dimensional exits automatically excludes them from `movement:go`
- Existing system handles the restriction without modification

### Rule Definitions

#### Handle Travel Through Dimensions Rule

**Purpose**: Process dimensional travel action with appropriate narrative messaging

**File**: `data/mods/patrol/rules/handle_travel_through_dimensions.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "id": "patrol:handle_travel_through_dimensions",
  "description": "Handles entity traveling through dimensional tear to reach another dimension",
  "priority": 100,
  "conditions": ["patrol:event-is-action-travel-through-dimensions"],
  "operations": [
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
      "resultVariable": "destinationName"
    },
    {
      "type": "QUERY_COMPONENT",
      "params": {
        "entityId": { "var": "event.payload.actorId" },
        "componentId": "core:position"
      },
      "resultVariable": "actorPosition"
    },
    {
      "type": "DISPATCH_PERCEPTIBLE_EVENT",
      "params": {
        "actorId": { "var": "event.payload.actorId" },
        "locationId": { "var": "actorPosition.locationId" },
        "message": {
          "cat": [
            { "var": "actorName" },
            "'s form ripples and distorts as they step through the dimensional tear."
          ]
        },
        "perceptionType": "dimensional_departure"
      }
    },
    {
      "type": "CHANGE_LOCATION",
      "params": {
        "entityId": { "var": "event.payload.actorId" },
        "destinationLocationId": { "var": "event.payload.primaryTargetId" }
      }
    },
    {
      "type": "DISPATCH_PERCEPTIBLE_EVENT",
      "params": {
        "actorId": { "var": "event.payload.actorId" },
        "locationId": { "var": "event.payload.primaryTargetId" },
        "message": {
          "cat": [
            { "var": "actorName" },
            " materializes from the dimensional tear, their form stabilizing in alien space."
          ]
        },
        "perceptionType": "dimensional_arrival"
      }
    },
    {
      "type": "SET_VARIABLE",
      "params": {
        "name": "successMessage",
        "value": {
          "cat": [
            { "var": "actorName" },
            " travels through dimensions to ",
            { "var": "destinationName" },
            "."
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
```

**Key Features**:
1. **Departure Message**: Visible at origin location with eldritch flavor
2. **Location Change**: Uses standard `CHANGE_LOCATION` operation
3. **Arrival Message**: Visible at destination with dimensional theme
4. **Success Logging**: Standard macro for turn completion

#### Event Condition for Dimensional Travel

**File**: `data/mods/patrol/conditions/event-is-action-travel-through-dimensions.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "patrol:event-is-action-travel-through-dimensions",
  "description": "Checks if the event is an attempt_action event for travel_through_dimensions action",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "patrol:travel_through_dimensions"
    ]
  }
}
```

### Character Component Updates

#### Writhing Observer

**File**: `data/mods/patrol/entities/definitions/writhing_observer.character.json`

**Add Component**:
```json
{
  "components": {
    "patrol:can_travel_through_dimensions": {}
  }
}
```

**Full Updated Components Section**:
```json
{
  "components": {
    "core:name": { "text": "Writhing observer" },
    "core:portrait": {
      "imagePath": "portraits/writhing_observer.png",
      "altText": "Writhing observer"
    },
    "core:actor": {},
    "core:player_type": { "type": "human" },
    "core:perception_log": {
      "maxEntries": 50,
      "logEntries": []
    },
    "anatomy:body": { "recipeId": "anatomy:writhing_observer" },
    "core:gender": { "value": "male" },
    "patrol:can_travel_through_dimensions": {}
  }
}
```

## Testing Strategy

### Unit Tests

#### Scope Resolution Tests

**File**: `tests/unit/scopeDsl/dimensionalPortalsScope.test.js`

**Purpose**: Verify scope correctly identifies dimensional portals

```javascript
describe('patrol:dimensional_portals Scope', () => {
  let scopeEngine;
  let testLocation;

  beforeEach(() => {
    // Setup scope engine with resolver registry
    // Create test location with mixed exits
  });

  describe('Blocker Filtering', () => {
    it('should include exits with dimensional portal blockers', () => {
      const exits = [
        {
          direction: 'through rift',
          target: 'dimension-1',
          blocker: createBlockerEntity({ hasPortalComponent: true })
        }
      ];

      const result = scopeEngine.resolve('patrol:dimensional_portals', {
        location: { 'movement:exits': exits }
      });

      expect(result).toContain('dimension-1');
    });

    it('should exclude exits with non-portal blockers', () => {
      const exits = [
        {
          direction: 'through door',
          target: 'room-1',
          blocker: createBlockerEntity({ hasPortalComponent: false })
        }
      ];

      const result = scopeEngine.resolve('patrol:dimensional_portals', {
        location: { 'movement:exits': exits }
      });

      expect(result).not.toContain('room-1');
    });

    it('should exclude unblocked exits', () => {
      const exits = [
        {
          direction: 'north',
          target: 'room-2',
          blocker: null
        }
      ];

      const result = scopeEngine.resolve('patrol:dimensional_portals', {
        location: { 'movement:exits': exits }
      });

      expect(result).not.toContain('room-2');
    });
  });
});
```

#### Condition Tests

**File**: `tests/unit/conditions/blockerIsDimensionalPortal.test.js`

```javascript
describe('patrol:blocker-is-dimensional-portal Condition', () => {
  let condition;
  let entityManager;

  beforeEach(() => {
    entityManager = createMockEntityManager();
    condition = loadCondition('patrol:blocker-is-dimensional-portal');
  });

  describe('Component Detection', () => {
    it('should return true when blocker has dimensional portal component', () => {
      const blockerId = 'blocker-1';
      entityManager.hasComponent.mockReturnValue(true);

      const result = condition.evaluate({
        entity: { blocker: blockerId },
        entityManager
      });

      expect(result).toBe(true);
      expect(entityManager.hasComponent).toHaveBeenCalledWith(
        blockerId,
        'patrol:is_dimensional_portal'
      );
    });

    it('should return false when blocker lacks dimensional portal component', () => {
      const blockerId = 'blocker-2';
      entityManager.hasComponent.mockReturnValue(false);

      const result = condition.evaluate({
        entity: { blocker: blockerId },
        entityManager
      });

      expect(result).toBe(false);
    });

    it('should handle null blocker gracefully', () => {
      const result = condition.evaluate({
        entity: { blocker: null },
        entityManager
      });

      expect(result).toBe(false);
    });
  });
});
```

### Integration Tests

#### Action Discovery Tests

**File**: `tests/integration/mods/patrol/travelThroughDimensionsActionDiscovery.test.js`

**Purpose**: Verify action appears only for entities with dimensional travel capability

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('travel_through_dimensions Action Discovery', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'patrol',
      'patrol:travel_through_dimensions'
    );
  });

  afterEach(() => {
    fixture.cleanup();
  });

  describe('Dimensional Traveler Availability', () => {
    it('should discover travel_through_dimensions for Writhing Observer at perimeter', async () => {
      // Create perimeter location with dimensional exit
      const perimeterId = fixture.createEntity({
        name: 'perimeter of rip in reality',
        components: [
          {
            componentId: 'core:location',
            data: {}
          }
        ]
      });

      // Create eldritch dimension
      const dimensionId = fixture.createEntity({
        name: 'eldritch dimension',
        components: [
          {
            componentId: 'core:location',
            data: {}
          }
        ]
      });

      // Create dimensional blocker
      const blockerId = fixture.createEntity({
        name: 'dimensional rift',
        components: [
          {
            componentId: 'patrol:is_dimensional_portal',
            data: {}
          }
        ]
      });

      // Add exit with blocker to perimeter
      fixture.modifyComponent(perimeterId, 'movement:exits', [
        {
          direction: 'through the dimensional rift',
          target: dimensionId,
          blocker: blockerId
        }
      ]);

      // Create Writhing Observer at perimeter
      const observerId = fixture.createEntity({
        name: 'Writhing Observer',
        components: [
          {
            componentId: 'core:actor',
            data: {}
          },
          {
            componentId: 'core:position',
            data: { locationId: perimeterId }
          },
          {
            componentId: 'patrol:can_travel_through_dimensions',
            data: {}
          }
        ]
      });

      const actions = await fixture.discoverActions(observerId);

      expect(actions).toContainAction('patrol:travel_through_dimensions', {
        primaryTargetId: dimensionId
      });
    });

    it('should NOT discover travel_through_dimensions for humans', async () => {
      const { perimeterId, dimensionId, blockerId, humanId } =
        createDimensionalScenario(fixture, {
          actorHasAffordance: false
        });

      const actions = await fixture.discoverActions(humanId);

      expect(actions).not.toContainAction('patrol:travel_through_dimensions');
    });

    it('should NOT discover travel_through_dimensions for unblocked exits', async () => {
      const scenario = createStandardLocationScenario(fixture);

      const observerId = fixture.createEntity({
        name: 'Writhing Observer',
        components: [
          {
            componentId: 'core:actor',
            data: {}
          },
          {
            componentId: 'core:position',
            data: { locationId: scenario.locationId }
          },
          {
            componentId: 'patrol:can_travel_through_dimensions',
            data: {}
          }
        ]
      });

      const actions = await fixture.discoverActions(observerId);

      // Should not appear because exits are unblocked (normal movement)
      expect(actions).not.toContainAction('patrol:travel_through_dimensions');
    });
  });

  describe('Go Action Exclusion', () => {
    it('should NOT discover go action for dimensional exits', async () => {
      const { perimeterId, dimensionId, blockerId, humanId } =
        createDimensionalScenario(fixture, {
          actorHasAffordance: false
        });

      const actions = await fixture.discoverActions(humanId);

      // Humans should not be able to "go" through dimensional rift
      expect(actions).not.toContainAction('movement:go', {
        primaryTargetId: dimensionId
      });
    });

    it('should still discover go action for unblocked exits', async () => {
      const scenario = createMixedExitScenario(fixture);

      const actions = await fixture.discoverActions(scenario.humanId);

      // Should discover go to normal room but not dimensional destination
      expect(actions).toContainAction('movement:go', {
        primaryTargetId: scenario.normalRoomId
      });
      expect(actions).not.toContainAction('movement:go', {
        primaryTargetId: scenario.dimensionId
      });
    });
  });
});

/**
 * Helper: Create scenario with dimensional portal and optional traveler
 */
function createDimensionalScenario(fixture, options = {}) {
  const {
    actorHasAffordance = true,
    actorName = 'Test Actor'
  } = options;

  const perimeterId = fixture.createEntity({
    name: 'perimeter of rip in reality',
    components: [{ componentId: 'core:location', data: {} }]
  });

  const dimensionId = fixture.createEntity({
    name: 'eldritch dimension',
    components: [{ componentId: 'core:location', data: {} }]
  });

  const blockerId = fixture.createEntity({
    name: 'dimensional rift',
    components: [
      { componentId: 'patrol:is_dimensional_portal', data: {} }
    ]
  });

  fixture.modifyComponent(perimeterId, 'movement:exits', [
    {
      direction: 'through the dimensional rift',
      target: dimensionId,
      blocker: blockerId
    }
  ]);

  const actorComponents = [
    { componentId: 'core:actor', data: {} },
    { componentId: 'core:position', data: { locationId: perimeterId } }
  ];

  if (actorHasAffordance) {
    actorComponents.push({
      componentId: 'patrol:can_travel_through_dimensions',
      data: {}
    });
  }

  const actorId = fixture.createEntity({
    name: actorName,
    components: actorComponents
  });

  return {
    perimeterId,
    dimensionId,
    blockerId,
    [actorHasAffordance ? 'observerId' : 'humanId']: actorId
  };
}

/**
 * Helper: Create location with both blocked and unblocked exits
 */
function createMixedExitScenario(fixture) {
  const startLocationId = fixture.createEntity({
    name: 'start location',
    components: [{ componentId: 'core:location', data: {} }]
  });

  const normalRoomId = fixture.createEntity({
    name: 'normal room',
    components: [{ componentId: 'core:location', data: {} }]
  });

  const dimensionId = fixture.createEntity({
    name: 'eldritch dimension',
    components: [{ componentId: 'core:location', data: {} }]
  });

  const blockerId = fixture.createEntity({
    name: 'dimensional rift',
    components: [
      { componentId: 'patrol:is_dimensional_portal', data: {} }
    ]
  });

  fixture.modifyComponent(startLocationId, 'movement:exits', [
    {
      direction: 'north',
      target: normalRoomId,
      blocker: null
    },
    {
      direction: 'through the dimensional rift',
      target: dimensionId,
      blocker: blockerId
    }
  ]);

  const humanId = fixture.createEntity({
    name: 'Human Sentinel',
    components: [
      { componentId: 'core:actor', data: {} },
      { componentId: 'core:position', data: { locationId: startLocationId } }
    ]
  });

  return { startLocationId, normalRoomId, dimensionId, blockerId, humanId };
}
```

#### Rule Execution Tests

**File**: `tests/integration/mods/patrol/travelThroughDimensionsRuleExecution.test.js`

**Purpose**: Verify complete dimensional travel workflow

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('travel_through_dimensions Rule Execution', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'patrol',
      'patrol:travel_through_dimensions'
    );
  });

  afterEach(() => {
    fixture.cleanup();
  });

  describe('Successful Dimensional Travel', () => {
    it('should successfully execute dimensional travel', async () => {
      const scenario = createDimensionalScenario(fixture, {
        actorHasAffordance: true
      });

      await fixture.executeAction(
        scenario.observerId,
        scenario.dimensionId
      );

      // Verify location changed
      const position = fixture.getComponent(
        scenario.observerId,
        'core:position'
      );
      expect(position.locationId).toBe(scenario.dimensionId);
    });

    it('should dispatch departure perception at origin', async () => {
      const scenario = createDimensionalScenario(fixture);
      const events = [];

      fixture.eventBus.on('perceptible_event', (event) => {
        events.push(event);
      });

      await fixture.executeAction(
        scenario.observerId,
        scenario.dimensionId
      );

      const departureEvent = events.find(
        e => e.payload.perceptionType === 'dimensional_departure'
      );
      expect(departureEvent).toBeDefined();
      expect(departureEvent.payload.locationId).toBe(scenario.perimeterId);
      expect(departureEvent.payload.message).toContain('ripples and distorts');
    });

    it('should dispatch arrival perception at destination', async () => {
      const scenario = createDimensionalScenario(fixture);
      const events = [];

      fixture.eventBus.on('perceptible_event', (event) => {
        events.push(event);
      });

      await fixture.executeAction(
        scenario.observerId,
        scenario.dimensionId
      );

      const arrivalEvent = events.find(
        e => e.payload.perceptionType === 'dimensional_arrival'
      );
      expect(arrivalEvent).toBeDefined();
      expect(arrivalEvent.payload.locationId).toBe(scenario.dimensionId);
      expect(arrivalEvent.payload.message).toContain('materializes');
    });
  });

  describe('Round-Trip Travel', () => {
    it('should allow travel from reality to dimension and back', async () => {
      const scenario = createBidirectionalScenario(fixture);

      // Travel to dimension
      await fixture.executeAction(
        scenario.observerId,
        scenario.dimensionId
      );

      let position = fixture.getComponent(
        scenario.observerId,
        'core:position'
      );
      expect(position.locationId).toBe(scenario.dimensionId);

      // Travel back to reality
      await fixture.executeAction(
        scenario.observerId,
        scenario.perimeterId
      );

      position = fixture.getComponent(
        scenario.observerId,
        'core:position'
      );
      expect(position.locationId).toBe(scenario.perimeterId);
    });
  });

  describe('Validation Failures', () => {
    it('should fail when actor lacks dimensional travel component', async () => {
      const scenario = createDimensionalScenario(fixture, {
        actorHasAffordance: false
      });

      await expect(
        fixture.executeAction(scenario.humanId, scenario.dimensionId)
      ).rejects.toThrow();
    });
  });
});

/**
 * Helper: Create bidirectional dimensional travel scenario
 */
function createBidirectionalScenario(fixture) {
  const perimeterId = fixture.createEntity({
    name: 'perimeter of rip in reality',
    components: [{ componentId: 'core:location', data: {} }]
  });

  const dimensionId = fixture.createEntity({
    name: 'eldritch dimension',
    components: [{ componentId: 'core:location', data: {} }]
  });

  const blockerId = fixture.createEntity({
    name: 'dimensional rift',
    components: [
      { componentId: 'patrol:is_dimensional_portal', data: {} }
    ]
  });

  // Perimeter exit to dimension
  fixture.modifyComponent(perimeterId, 'movement:exits', [
    {
      direction: 'through the dimensional rift',
      target: dimensionId,
      blocker: blockerId
    }
  ]);

  // Dimension exit back to perimeter
  fixture.modifyComponent(dimensionId, 'movement:exits', [
    {
      direction: 'through the dimensional tear back to reality',
      target: perimeterId,
      blocker: blockerId
    }
  ]);

  const observerId = fixture.createEntity({
    name: 'Writhing Observer',
    components: [
      { componentId: 'core:actor', data: {} },
      { componentId: 'core:position', data: { locationId: perimeterId } },
      { componentId: 'patrol:can_travel_through_dimensions', data: {} }
    ]
  });

  return { perimeterId, dimensionId, blockerId, observerId };
}
```

#### End-to-End Scenario Test

**File**: `tests/e2e/patrol/dimensionalTravelScenario.test.js`

**Purpose**: Verify complete patrol scenario with dimensional restrictions

```javascript
describe('Patrol Dimensional Travel Scenario', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forMod('patrol');
  });

  afterEach(() => {
    fixture.cleanup();
  });

  describe('Complete Scenario', () => {
    it('should prevent humans from crossing dimensional boundary', async () => {
      // Load Len Amezua at perimeter
      const lenId = fixture.loadCharacter('patrol:len_amezua');
      const perimeterId = fixture.getLocationId('perimeter_of_rip_in_reality');

      fixture.placeEntityAtLocation(lenId, perimeterId);

      // Discover actions
      const actions = await fixture.discoverActions(lenId);

      // Should not have dimensional travel action (lacks component)
      expect(actions).not.toContainAction('patrol:travel_through_dimensions');

      // Should not have go action to eldritch dimension (blocked exit)
      const dimensionId = fixture.getLocationId('eldritch_dimension');
      expect(actions).not.toContainAction('movement:go', {
        primaryTargetId: dimensionId
      });
    });

    it('should allow Writhing Observer to cross dimensional boundary', async () => {
      // Load Writhing Observer at perimeter
      const observerId = fixture.loadCharacter('patrol:writhing_observer');
      const perimeterId = fixture.getLocationId('perimeter_of_rip_in_reality');

      fixture.placeEntityAtLocation(observerId, perimeterId);

      // Discover actions
      const actions = await fixture.discoverActions(observerId);

      // Should have dimensional travel action (has component)
      expect(actions).toContainAction('patrol:travel_through_dimensions');

      // Execute travel
      const dimensionId = fixture.getLocationId('eldritch_dimension');
      await fixture.executeAction(observerId, dimensionId);

      // Verify successful travel
      const position = fixture.getComponent(observerId, 'core:position');
      expect(position.locationId).toBe(dimensionId);
    });

    it('should allow Observer to travel back and forth', async () => {
      const observerId = fixture.loadCharacter('patrol:writhing_observer');
      const perimeterId = fixture.getLocationId('perimeter_of_rip_in_reality');
      const dimensionId = fixture.getLocationId('eldritch_dimension');

      // Start at perimeter
      fixture.placeEntityAtLocation(observerId, perimeterId);

      // Travel to dimension
      await fixture.executeAction(observerId, dimensionId);
      let position = fixture.getComponent(observerId, 'core:position');
      expect(position.locationId).toBe(dimensionId);

      // Travel back to perimeter
      await fixture.executeAction(observerId, perimeterId);
      position = fixture.getComponent(observerId, 'core:position');
      expect(position.locationId).toBe(perimeterId);
    });
  });
});
```

## Implementation Phases

### Phase 1: Component Definitions
**Priority**: Critical - Foundation for all other work

**Files**:
1. `data/mods/patrol/components/is_dimensional_portal.component.json` (new)
2. `data/mods/patrol/components/can_travel_through_dimensions.component.json` (new)

**Validation**:
- Components validate against schema
- Components added to mod manifest
- `npm run validate` passes

### Phase 2: Blocker Entity and Location Updates
**Priority**: Critical - Establishes blocked exits

**Files**:
1. `data/mods/patrol/entities/definitions/dimensional_rift_blocker.entity.json` (new)
2. `data/mods/patrol/entities/definitions/perimeter_of_rip_in_reality.location.json` (modify)
3. `data/mods/patrol/entities/definitions/eldritch_dimension.location.json` (modify)

**Validation**:
- Blocker entity instantiated in game initialization
- Location exits reference blocker correctly
- Existing `movement:go` action excludes dimensional exits
- Manual testing: humans cannot "go" to eldritch dimension

### Phase 3: Scope and Condition Definitions
**Priority**: High - Required for action discovery

**Files**:
1. `data/mods/patrol/conditions/blocker-is-dimensional-portal.condition.json` (new)
2. `data/mods/patrol/scopes/dimensional_portals.scope` (new)

**Validation**:
- Condition logic validates
- Scope resolves correctly (unit test)
- Scope returns only dimensional portal destinations
- `npm run scope:lint` passes

### Phase 4: Action and Rule Implementation
**Priority**: High - Core functionality

**Files**:
1. `data/mods/patrol/actions/travel_through_dimensions.action.json` (new)
2. `data/mods/patrol/conditions/event-is-action-travel-through-dimensions.condition.json` (new)
3. `data/mods/patrol/rules/handle_travel_through_dimensions.rule.json` (new)

**Validation**:
- Action schema validates
- Rule schema validates
- Action appears for entities with dimensional travel component
- Action executes successfully with location change

### Phase 5: Character Component Updates
**Priority**: Medium - Enables scenario testing

**Files**:
1. `data/mods/patrol/entities/definitions/writhing_observer.character.json` (modify)

**Validation**:
- Writhing Observer gains `patrol:can_travel_through_dimensions` component
- Action discovery includes dimensional travel for Observer
- Action discovery excludes dimensional travel for Len and Dylan

### Phase 6: Testing
**Priority**: Critical - Ensures quality and prevents regressions

**Files**:
1. `tests/unit/scopeDsl/dimensionalPortalsScope.test.js` (new)
2. `tests/unit/conditions/blockerIsDimensionalPortal.test.js` (new)
3. `tests/integration/mods/patrol/travelThroughDimensionsActionDiscovery.test.js` (new)
4. `tests/integration/mods/patrol/travelThroughDimensionsRuleExecution.test.js` (new)
5. `tests/e2e/patrol/dimensionalTravelScenario.test.js` (new)

**Validation**:
- All unit tests pass with 80%+ coverage
- All integration tests pass
- E2E scenario test verifies complete workflow
- No ESLint errors
- `npm run test:ci` passes

### Phase 7: Documentation
**Priority**: Low - Important for maintainability

**Files**:
1. `docs/mods/patrol-dimensional-travel.md` (new)

**Content**:
- Explain dimensional travel system
- Document blocker mechanism
- Document affordance pattern
- Provide usage examples for other mods

## File Summary

### New Files (14 total)

**Data Files - Components** (2):
1. `data/mods/patrol/components/is_dimensional_portal.component.json`
2. `data/mods/patrol/components/can_travel_through_dimensions.component.json`

**Data Files - Entities** (1):
3. `data/mods/patrol/entities/definitions/dimensional_rift_blocker.entity.json`

**Data Files - Scopes** (1):
4. `data/mods/patrol/scopes/dimensional_portals.scope`

**Data Files - Conditions** (2):
5. `data/mods/patrol/conditions/blocker-is-dimensional-portal.condition.json`
6. `data/mods/patrol/conditions/event-is-action-travel-through-dimensions.condition.json`

**Data Files - Actions** (1):
7. `data/mods/patrol/actions/travel_through_dimensions.action.json`

**Data Files - Rules** (1):
8. `data/mods/patrol/rules/handle_travel_through_dimensions.rule.json`

**Modified Data Files** (3):
9. `data/mods/patrol/entities/definitions/perimeter_of_rip_in_reality.location.json`
10. `data/mods/patrol/entities/definitions/eldritch_dimension.location.json`
11. `data/mods/patrol/entities/definitions/writhing_observer.character.json`

**Test Files** (5):
12. `tests/unit/scopeDsl/dimensionalPortalsScope.test.js`
13. `tests/unit/conditions/blockerIsDimensionalPortal.test.js`
14. `tests/integration/mods/patrol/travelThroughDimensionsActionDiscovery.test.js`
15. `tests/integration/mods/patrol/travelThroughDimensionsRuleExecution.test.js`
16. `tests/e2e/patrol/dimensionalTravelScenario.test.js`

**Documentation** (1):
17. `docs/mods/patrol-dimensional-travel.md`

## Success Criteria

### Functional Requirements
✅ Humans (Len Amezua, Dylan Crace) cannot use "go" action to reach eldritch dimension
✅ Humans do not see "travel through dimensions" action (lack affordance component)
✅ Writhing Observer can use "travel through dimensions" action
✅ Writhing Observer can travel bidirectionally (reality ↔ dimension)
✅ Dimensional travel triggers appropriate departure/arrival messages
✅ Standard movement still works for unblocked exits
✅ Blocked exits prevent "go" action via existing scope filtering

### Quality Requirements
✅ All unit tests pass with 80%+ branch coverage
✅ All integration tests pass
✅ E2E scenario test verifies complete workflow
✅ No ESLint errors in new code
✅ Schema validation passes (`npm run validate`)
✅ Scope validation passes (`npm run scope:lint`)
✅ All condition JSON validates

### Code Quality
✅ Follows project naming conventions (underscores for rules/actions, hyphens for conditions)
✅ Component definitions follow marker pattern (no data properties)
✅ Scope uses correct ScopeDsl syntax with condition references
✅ Rule uses standard operation patterns (GET_NAME, CHANGE_LOCATION, etc.)
✅ Action visual styling matches thematic content (dark cosmic colors)

### Documentation
✅ System architecture explained
✅ Component usage documented
✅ Scope DSL patterns referenced
✅ Testing patterns provided
✅ Integration with existing movement system explained

## Design Decisions

### Blocker-Based Exit Restriction
**Decision**: Use existing blocker mechanism rather than creating new exit types

**Rationale**:
- Leverages existing `movement:exit-is-unblocked` condition
- No changes needed to `movement:go` action
- Consistent with established ECS patterns
- Allows reuse of blocker system for future scenarios (locked doors, collapsed passages, etc.)
- Blocker entities can carry narrative information (description, name)

**Alternatives Considered**:
- Creating "dimensional_exit" type: Would require modifying movement system
- Adding "requires_dimensional_travel" flag: Less flexible than component-based approach
- Using exit metadata: Would require new scope filtering logic

### Marker Component for Affordance
**Decision**: Use marker component pattern (`can_travel_through_dimensions`) instead of capability data

**Rationale**:
- Follows established pattern from `movement:can_teleport`
- Enables simple action `required_components` filtering
- Easy to add/remove via component mutation
- Consistent with ECS philosophy (behavior via component presence)
- Future-proof for status effects that grant/remove ability

**Alternatives Considered**:
- Adding "abilities" array to actor component: Breaks single-responsibility principle
- Using inherent entity type checking: Less flexible, harder to test
- Implicit from anatomy: Would couple anatomy and affordances inappropriately

### Separate Action for Dimensional Travel
**Decision**: Create distinct `travel_through_dimensions` action rather than enhancing `go`

**Rationale**:
- Clear semantic distinction (mundane vs supernatural movement)
- Distinct visual styling reinforces thematic difference
- Allows different messaging (departure/arrival flavor text)
- Prevents scope resolution ambiguity
- Future actions (phase_through_walls, shadow_step) can follow same pattern
- Easier to discover and understand from player perspective

**Alternatives Considered**:
- Conditional `go` action logic: Would complicate existing simple movement
- Single action with different rules: Would create confusing action discovery
- Transport operation that's invisible: Loses narrative opportunity

### Blocker as Dimensional Portal Marker
**Decision**: Add `is_dimensional_portal` component to blocker entity

**Rationale**:
- Allows scope to distinguish dimensional blocks from future mundane blocks (locked doors)
- Maintains semantic clarity (not all blockers are dimensional portals)
- Enables rich blocker entities with descriptions and components
- Supports future expansion (dimensional keys, portal stability, etc.)
- Follows ECS pattern of component-driven behavior

**Alternatives Considered**:
- All blockers implicitly dimensional: Too restrictive for future scenarios
- Exit metadata flag: Would duplicate information unnecessarily
- Separate dimensional_exit component on location: Less composable

### Narrative Perception Messages
**Decision**: Include departure and arrival perceptions with eldritch flavor

**Rationale**:
- Enhances immersion for dimensional travel experience
- Distinguishes from mundane "X enters the room" messages
- Provides narrative feedback at both origin and destination
- Establishes pattern for future supernatural movement actions
- Reinforces thematic consistency of patrol mod

### Bidirectional Blocking
**Decision**: Use same blocker entity for both directions of travel

**Rationale**:
- Dimensional rifts block equally in both directions
- Simplifies entity management (single blocker instance)
- Consistent with physical reality (tear in space, not one-way membrane)
- Reduces data duplication

**Alternatives Considered**:
- Different blockers per direction: Unnecessary complexity
- One-way portal with null return: Breaks expected bidirectional travel

## Future Considerations

### Additional Dimensional Affordances
Consider implementing:
- **Phase Through Dimensions**: Brief partial overlap between realities
- **Sense Across Dimensions**: Perception without physical travel
- **Dimensional Anchor**: Prevents forced dimensional travel
- **Reality Tether**: Limits time spent in alien dimensions

### Gradual Dimensional Corruption
When humans spend extended time near dimensional rifts:
- Accumulate "dimensional exposure" status
- Risk spontaneous dimensional phasing
- Develop limited dimensional perception
- Potential for permanent transformation

### Blocker System Expansion
Reuse blocker pattern for:
- **Locked Doors**: Blocker with `is_locked` component, removable via keys
- **Collapsed Passages**: Blocker requiring engineering/strength
- **Magical Barriers**: Blocker requiring dispel or specific components
- **Temporal Blocks**: Blocker that only exists at certain times

### Conditional Dimensional Travel
Add complexity to dimensional travel:
- **Dimensional Instability**: Random failure chance or energy cost
- **Dimensional Anchors**: Items or components that improve stability
- **Time-Limited Portals**: Rifts that open/close on schedules
- **Multiple Dimensional Layers**: Depth-based dimensional navigation

### Scope DSL Enhancement
If `has_component` doesn't exist in JSON Logic:
- Implement custom `has_component` operation in scope engine
- Add to scope DSL documentation
- Create tests for component-based filtering
- Consider other useful component queries (count_components, component_value)

### Patrol Mod Expansion
Additional scenario elements:
- **Dimensional Contamination**: Items that gain components from crossing
- **Reality Degradation**: Perimeter location properties change over time
- **Eldritch Communication**: Actions available only in eldritch dimension
- **Dimensional Refugees**: NPCs fleeing dimensional incursions

## Technical Notes

### Scope DSL: has_component Operation

The spec assumes `has_component` JSON Logic operation exists. If not implemented, alternative approaches:

**Option 1: Custom Resolver**
```javascript
// In scope resolver registry
registerResolver('has_component', (entityId, componentId, context) => {
  return context.entityManager.hasComponent(entityId, componentId);
});
```

**Option 2: Component Value Check**
```json
{
  "logic": {
    "!!": { "var": "entity.blocker.patrol:is_dimensional_portal" }
  }
}
```
Note: Less explicit but works if component path resolution supported

**Option 3: Dedicated Condition Scope**
```
patrol:dimensional_blockers := location.movement:exits.blocker[
    { "var": "components.patrol:is_dimensional_portal" }
]
```
Then check if blocker is in that set (more complex scope logic)

**Recommended**: Implement `has_component` as it's generally useful for many mod scenarios

### Game Initialization Requirements

The blocker entity must be instantiated at game start. Options:

**Option 1: game.json Entity Instances**
```json
{
  "entityInstances": [
    {
      "id": "patrol:dimensional_rift_blocker_instance",
      "definitionId": "patrol:dimensional_rift_blocker"
    }
  ]
}
```

**Option 2: Mod Initialization Script**
- Add init script to patrol mod
- Spawn blocker entity at runtime
- Store entity ID for reference by locations

**Recommended**: Use game.json for permanent scenario entities like blockers

### Testing with ModTestFixture

When creating dimensional scenarios in tests:

```javascript
// Create blocker entity manually (don't rely on game initialization)
const blockerId = fixture.createEntity({
  name: 'dimensional rift',
  components: [
    { componentId: 'patrol:is_dimensional_portal', data: {} }
  ]
});

// Use blocker in exit definitions
fixture.modifyComponent(locationId, 'movement:exits', [
  {
    direction: 'through rift',
    target: targetLocationId,
    blocker: blockerId  // Use created entity ID
  }
]);
```

This ensures tests are self-contained and don't depend on game initialization order.

## References

### Similar Systems
- **movement:can_teleport**: Pattern for movement affordance components
- **movement:exit-is-unblocked**: Existing blocker condition implementation
- **movement:clear_directions**: Scope filtering pattern for available exits

### Test Patterns
- `tests/integration/mods/movement/teleportActionDiscovery.test.js`: Affordance-based action pattern
- `tests/integration/mods/positioning/actionDiscovery.test.js`: Component requirement testing
- `tests/common/mods/ModTestFixture.js`: Fixture usage patterns

### Documentation
- `docs/testing/mod-testing-guide.md`: Primary testing reference
- `docs/scopeDsl/README.md`: Scope DSL syntax and patterns
- `CLAUDE.md`: Project architecture and ECS patterns
- `specs/lovecraftian-abomination-the-writhing-observer.spec.md`: Related patrol mod content

### Related Specifications
- Writhing Observer character spec (already exists)
- Patrol mod location specifications
- Movement system architecture

---

**Specification Version**: 1.0
**Created**: 2025-01-10
**Author**: Claude (AI Assistant)
**Status**: Ready for Implementation
**Estimated Effort**: 2-3 days (including testing)
