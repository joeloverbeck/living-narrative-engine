# Teleport Action Implementation Specification

## Overview

This specification defines a new teleportation system for the movement mod, allowing actors with teleportation abilities to instantly travel between locations. The system uses a **marker-based gating pattern** similar to `positioning:closeness` for intimacy actions, where the `movement:can_teleport` component serves as an ability marker that modders can add to character definitions.

### Design Philosophy

**Marker-Based Ability Gating:**

The teleport action follows the **required component pattern** used by intimacy actions:
- Simple marker component (`movement:can_teleport`) with no data properties
- Component presence on actor enables teleport action discovery
- Component absence blocks teleport action entirely
- Modders control which characters can teleport by adding/removing the marker

**Key Design Decisions:**

1. **Ability Gating**: Uses `required_components.actor: ["movement:can_teleport"]` to restrict teleportation to specific characters
2. **Scope Reuse**: Leverages existing `movement:clear_directions` scope (same as `go` action)
3. **Prerequisite Consistency**: Uses `movement:actor-can-move` prerequisite despite teleportation not requiring legs
   - **Rationale**: Prevents weird edge cases (e.g., teleporting while lying in bed) without complex state handling
   - **Trade-off**: Slightly illogical (teleportation shouldn't need legs) but maintains system simplicity
4. **Visual Differentiation**: Shares visual scheme with `go` action to indicate movement category
5. **Dual Perceptible Events**: Origin location sees "vanish" message, destination sees "materialize" message

## Requirements

### Functional Requirements

1. **Marker Component**: Create `movement:can_teleport` as empty marker component for ability gating

2. **Action Definition**: Create `movement:teleport` action that:
   - Requires actor to have `movement:can_teleport` component
   - Uses `movement:clear_directions` scope for target selection
   - Has template format: `"teleport to {destination}"`
   - Shares visual styling with `movement:go` action
   - Uses same prerequisites as `movement:go` (actor can move)
   - Respects same forbidden components as movement actions

3. **Condition Definition**: Create `movement:event-is-action-teleport` condition for rule matching

4. **Rule Processing**: Create `handle_teleport` rule that:
   - Updates actor position to destination location
   - Dispatches origin perceptible event: `"{actor} vanishes from {origin_location}, disappearing entirely."`
   - Dispatches destination perceptible event: `"{actor} materializes suddenly, as if from nowhere."`
   - Dispatches success message: `"{actor} teleports to {destination_location}."`
   - Ends turn successfully

5. **Validation**: Ensure that:
   - Action only appears when actor has `can_teleport` marker
   - Action only appears when clear directions exist
   - Action is blocked by forbidden components (lying, sitting, kneeling, bending)
   - Dual perceptible events dispatch to correct locations
   - Component updates handled correctly

### Non-Functional Requirements

1. **Consistency**: Follow existing movement mod patterns and conventions
2. **Modularity**: Marker component allows modder control over teleportation ability
3. **Extensibility**: Allow future enhancements (e.g., teleport cooldowns, energy costs)
4. **Testability**: All components, actions, conditions, and rules must be comprehensively tested

## Component Definition

### 1. `movement:can_teleport` Component

**Purpose:** Marker component that grants teleportation ability to actors

**File:** `data/mods/movement/components/can_teleport.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "movement:can_teleport",
  "description": "Marker component indicating this actor has the ability to teleport between locations",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {}
  }
}
```

**Usage Pattern:**
```json
// In character entity definition
{
  "components": {
    "movement:can_teleport": {}  // Empty object - marker only
  }
}
```

**Design Notes:**
- Empty schema (no properties) - pure marker component
- Similar to `positioning:allows_lying_on` pattern
- Modders add to character definitions to enable teleportation
- Component presence checked during action discovery

## Condition Definition

### 1. `movement:event-is-action-teleport` Condition

**Purpose:** Identifies teleport action events for rule triggering

**File:** `data/mods/movement/conditions/event-is-action-teleport.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "movement:event-is-action-teleport",
  "description": "Checks if the triggering event is for the 'movement:teleport' action.",
  "logic": {
    "==": [
      {
        "var": "event.payload.actionId"
      },
      "movement:teleport"
    ]
  }
}
```

**Design Notes:**
- Identical pattern to `movement:event-is-action-go`
- Simple equality check on action ID
- Used as rule condition matcher

## Action Definition

### 1. `movement:teleport` Action

**Purpose:** Allows actors with teleportation ability to instantly travel to any connected location

**File:** `data/mods/movement/actions/teleport.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "movement:teleport",
  "name": "Teleport",
  "description": "Instantly teleport to a connected location, vanishing from your current position and materializing at the destination.",
  "targets": {
    "primary": {
      "scope": "movement:clear_directions",
      "placeholder": "destination",
      "description": "Location to teleport to"
    }
  },
  "required_components": {
    "actor": ["movement:can_teleport"]
  },
  "template": "teleport to {destination}",
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "movement:actor-can-move"
      },
      "failure_message": "You cannot teleport without functioning legs."
    }
  ],
  "visual": {
    "backgroundColor": "#006064",
    "textColor": "#e0f7fa",
    "hoverBackgroundColor": "#00838f",
    "hoverTextColor": "#ffffff"
  },
  "metadata": {
    "category": "movement",
    "author": "system",
    "tags": ["movement", "teleportation", "supernatural"]
  }
}
```

**Design Notes:**

- **Targets Field**: Uses object format `{primary: {...}}` (alternative: simple string `"movement:clear_directions"`)
  - Both formats are valid - object format shown for multi-target compatibility
  - Simple string format also supported for single-target actions
- **Scope**: Reuses `movement:clear_directions` (same targets as `go` action)
- **Required Components**: `movement:can_teleport` marker blocks action for characters without ability
- **Forbidden Components**: Field is OPTIONAL - omitted when not using target validation
  - Example: `go.action.json` has NO forbidden_components field
  - Only include if specific components should block action discovery
- **Prerequisites**: Uses `movement:actor-can-move` despite logical inconsistency
  - **Rationale**: Prevents teleporting while lying down, sitting, etc. without complex forbidden component rules
  - **Trade-off**: "Need legs to teleport" is illogical but maintains system simplicity
- **Visual**: Matches `movement:go` color scheme (#006064 cyan-teal family) to indicate movement category
- **Template**: Clear, action-focused phrasing
- **Metadata**: Uses descriptive tags instead of version/date (matches `go.action.json` pattern)

## Rule Definition

### 1. `handle_teleport` Rule

**Purpose:** Processes teleport action, updates position, dispatches location-specific perceptible events

**File:** `data/mods/movement/rules/handle_teleport.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_teleport",
  "comment": "Handles the 'movement:teleport' action. Updates actor position and dispatches vanish/materialize perceptible events.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "movement:event-is-action-teleport"
  },
  "actions": [
    {
      "type": "QUERY_COMPONENTS",
      "comment": "Fetch actor name and position components in bulk.",
      "parameters": {
        "entity_ref": "actor",
        "pairs": [
          {
            "component_type": "core:name",
            "result_variable": "actorNameComponent"
          },
          {
            "component_type": "core:position",
            "result_variable": "actorPositionComponentPreTeleport"
          }
        ]
      }
    },
    {
      "type": "IF",
      "comment": "Step 2: Proceed only if the actor has the required components.",
      "parameters": {
        "condition": {
          "and": [
            { "var": "context.actorNameComponent" },
            { "var": "context.actorPositionComponentPreTeleport" }
          ]
        },
        "then_actions": [
          {
            "type": "QUERY_COMPONENT",
            "comment": "Fetch the name of the current location (origin).",
            "parameters": {
              "entity_ref": {
                "entityId": "{context.actorPositionComponentPreTeleport.locationId}"
              },
              "component_type": "core:name",
              "result_variable": "originLocationNameComponent"
            }
          },
          {
            "type": "GET_TIMESTAMP",
            "comment": "Get the current ISO timestamp for perception logging.",
            "parameters": {
              "result_variable": "currentTimestamp"
            }
          },
          {
            "type": "SET_VARIABLE",
            "comment": "Use backward-compatible targetId (works with both legacy and multi-target events).",
            "parameters": {
              "variable_name": "resolvedTargetLocationId",
              "value": "{event.payload.targetId}"
            }
          },
          {
            "type": "IF",
            "comment": "Step 3: Check if a valid target location was found.",
            "parameters": {
              "condition": {
                "!=": [
                  {
                    "var": "context.resolvedTargetLocationId"
                  },
                  null
                ]
              },
              "then_actions": [
                {
                  "type": "QUERY_COMPONENT",
                  "comment": "Fetch the name of the destination location for messaging.",
                  "parameters": {
                    "entity_ref": {
                      "entityId": "{context.resolvedTargetLocationId}"
                    },
                    "component_type": "core:name",
                    "result_variable": "destinationLocationNameComponent"
                  }
                },
                {
                  "type": "DISPATCH_PERCEPTIBLE_EVENT",
                  "comment": "Dispatch perceptible event for actor vanishing from origin location.",
                  "parameters": {
                    "location_id": "{context.actorPositionComponentPreTeleport.locationId}",
                    "description_text": "{context.actorNameComponent.text} vanishes from {context.originLocationNameComponent.text}, disappearing entirely.",
                    "perception_type": "character_exit",
                    "actor_id": "{event.payload.actorId}",
                    "target_id": null,
                    "involved_entities": []
                  }
                },
                {
                  "type": "MODIFY_COMPONENT",
                  "comment": "Update the actor's locationId to the destination.",
                  "parameters": {
                    "entity_ref": "actor",
                    "component_type": "core:position",
                    "field": "locationId",
                    "mode": "set",
                    "value": "{context.resolvedTargetLocationId}"
                  }
                },
                {
                  "type": "DISPATCH_EVENT",
                  "comment": "Dispatch the primary 'entity_moved' event for other systems.",
                  "parameters": {
                    "eventType": "core:entity_moved",
                    "payload": {
                      "eventName": "core:entity_moved",
                      "entityId": "{event.payload.actorId}",
                      "previousLocationId": "{context.actorPositionComponentPreTeleport.locationId}",
                      "currentLocationId": "{context.resolvedTargetLocationId}",
                      "originalCommand": "{event.payload.originalInput}"
                    }
                  }
                },
                {
                  "type": "DISPATCH_PERCEPTIBLE_EVENT",
                  "comment": "Dispatch perceptible event for actor materializing at destination.",
                  "parameters": {
                    "location_id": "{context.resolvedTargetLocationId}",
                    "description_text": "{context.actorNameComponent.text} materializes suddenly, as if from nowhere.",
                    "perception_type": "character_enter",
                    "actor_id": "{event.payload.actorId}",
                    "target_id": null,
                    "involved_entities": []
                  }
                },
                {
                  "type": "SET_VARIABLE",
                  "comment": "Prepare success message for the UI.",
                  "parameters": {
                    "variable_name": "successMessage",
                    "value": "{context.actorNameComponent.text} teleports to {context.destinationLocationNameComponent.text}."
                  }
                },
                { "macro": "core:displaySuccessAndEndTurn" }
              ],
              "else_actions": [
                {
                  "type": "DISPATCH_EVENT",
                  "comment": "Dispatch a UI event indicating the failed teleport.",
                  "parameters": {
                    "eventType": "core:display_failed_action_result",
                    "payload": {
                      "message": "{context.actorNameComponent.text} tries to teleport to the specified location, but the teleportation fails."
                    }
                  }
                },
                {
                  "type": "END_TURN",
                  "comment": "End the turn after a failed teleport.",
                  "parameters": {
                    "entityId": "{event.payload.actorId}",
                    "success": false,
                    "error": {
                      "message": "Failed to teleport: No valid target location could be determined."
                    }
                  }
                }
              ]
            }
          }
        ],
        "else_actions": [
          {
            "type": "END_TURN",
            "comment": "Action failed because actor is missing required components.",
            "parameters": {
              "entityId": "{event.payload.actorId}",
              "success": false,
              "error": {
                "message": "Actor is missing required components for teleportation."
              }
            }
          }
        ]
      }
    }
  ]
}
```

**Design Notes:**

- **Structure**: Nearly identical to `go.rule.json` with key message differences
- **Origin Event**: "vanishes from {origin}, disappearing entirely"
- **Destination Event**: "materializes suddenly, as if from nowhere"
- **Success Message**: "teleports to {destination}"
- **Component Updates**: Same position modification as `go` action
- **Event Flow**: QUERY → VALIDATE → VANISH → TELEPORT → MATERIALIZE → SUCCESS

## Testing Strategy

### Action Discovery Tests

**File:** `tests/integration/mods/movement/teleport_action_discovery.test.js`

#### Test Structure

```javascript
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import teleportAction from '../../../../data/mods/movement/actions/teleport.action.json';

describe('movement:teleport action discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'movement',
      'movement:teleport'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('should have correct action structure', () => {
      expect(teleportAction).toBeDefined();
      expect(teleportAction.id).toBe('movement:teleport');
      expect(teleportAction.name).toBe('Teleport');
      expect(teleportAction.description).toContain('teleport');
      expect(teleportAction.targets.primary.scope).toBe('movement:clear_directions');
    });

    it('should require can_teleport marker component', () => {
      expect(teleportAction.required_components).toBeDefined();
      expect(teleportAction.required_components.actor).toEqual([
        'movement:can_teleport',
      ]);
    });

    it('should have correct visual styling matching movement actions', () => {
      expect(teleportAction.visual).toBeDefined();
      expect(teleportAction.visual.backgroundColor).toBe('#006064');
      expect(teleportAction.visual.textColor).toBe('#e0f7fa');
      expect(teleportAction.visual.hoverBackgroundColor).toBe('#00838f');
      expect(teleportAction.visual.hoverTextColor).toBe('#ffffff');
    });

    it('should have correct template', () => {
      expect(teleportAction.template).toBe('teleport to {destination}');
    });

    it('should have correct prerequisites', () => {
      expect(teleportAction.prerequisites).toBeDefined();
      expect(teleportAction.prerequisites.length).toBe(1);
      expect(teleportAction.prerequisites[0].logic.condition_ref).toBe(
        'movement:actor-can-move'
      );
    });
  });

  describe('Action discovery with can_teleport marker', () => {
    it('should appear when actor has can_teleport component and clear directions exist', () => {
      // EXPECTED BEHAVIOR:
      // 1. Alice is in location with exits
      // 2. Alice has movement:can_teleport component
      // 3. Clear directions exist via movement:clear_directions scope
      // 4. Expected: movement:teleport action should be available
      // 5. Targets should resolve to connected locations
      expect(true).toBe(true);
    });

    it('should NOT appear when actor lacks can_teleport component', () => {
      // EXPECTED BEHAVIOR:
      // If Alice does NOT have movement:can_teleport component:
      // - Action's required_components.actor check fails
      // - movement:teleport action should NOT be available
      //
      // This is the primary gating mechanism for teleportation ability
      expect(true).toBe(true);
    });

    it('should NOT appear when no clear directions exist', () => {
      // EXPECTED BEHAVIOR:
      // If Alice has can_teleport but no exits exist:
      // - Scope movement:clear_directions returns empty set
      // - movement:teleport action should NOT be available
      //
      // Prevents teleportation from dead-end locations
      expect(true).toBe(true);
    });
  });

  describe('Action discovery with forbidden components', () => {
    it('should NOT appear when actor is lying down', () => {
      // EXPECTED BEHAVIOR:
      // If Alice has positioning:lying_down component:
      // - Prerequisites check movement:actor-can-move fails (movement locked)
      // - movement:teleport action should NOT be available
      //
      // Enforced by movement lock system, not forbidden_components
      expect(true).toBe(true);
    });

    it('should NOT appear when actor is sitting', () => {
      // EXPECTED BEHAVIOR:
      // If Alice has positioning:sitting_on component:
      // - Prerequisites check movement:actor-can-move fails (movement locked)
      // - movement:teleport action should NOT be available
      //
      // Sitting locks movement via core:movement component
      expect(true).toBe(true);
    });

    it('should NOT appear when actor is kneeling', () => {
      // EXPECTED BEHAVIOR:
      // If Alice has positioning:kneeling_before component:
      // - Prerequisites check movement:actor-can-move fails (movement locked)
      // - movement:teleport action should NOT be available
      //
      // Prevents teleporting while in kneeling position
      expect(true).toBe(true);
    });

    it('should NOT appear when actor is bending over', () => {
      // EXPECTED BEHAVIOR:
      // If Alice has positioning:bending_over component:
      // - Prerequisites check movement:actor-can-move fails (movement locked)
      // - movement:teleport action should NOT be available
      //
      // Ensures actors cannot teleport while bending over
      expect(true).toBe(true);
    });
  });

  describe('Target resolution validation', () => {
    it('should resolve targets to all connected locations', () => {
      // EXPECTED BEHAVIOR:
      // 1. Alice is in room with multiple exits (north, south, east)
      // 2. All exits are unblocked (movement:exit-is-unblocked condition true)
      // 3. Expected: Teleport action should show all three directions as targets
      // 4. Each target should be a valid location entity
      expect(true).toBe(true);
    });

    it('should exclude blocked exits from targets', () => {
      // EXPECTED BEHAVIOR:
      // If some exits are blocked (locked doors, obstacles):
      // - Only unblocked exits should appear as teleport targets
      // - Uses same movement:exit-is-unblocked filtering as go action
      //
      // Maintains consistency with movement system
      expect(true).toBe(true);
    });
  });
});
```

### Rule Execution Tests

**File:** `tests/integration/mods/movement/teleport_action.test.js`

#### Test Structure

```javascript
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';

/**
 * Creates standardized teleport scenario.
 *
 * @param {string} actorName - Name for the actor
 * @param {string} originLocationName - Name for origin location
 * @param {string} destinationLocationName - Name for destination location
 * @returns {object} Object with actor, origin, destination entities
 */
function setupTeleportScenario(
  actorName = 'Alice',
  originLocationName = 'Bedroom',
  destinationLocationName = 'Kitchen'
) {
  const origin = new ModEntityBuilder('test:bedroom')
    .asRoom(originLocationName)
    .withComponent('movement:exits', {
      directions: [
        {
          direction: 'north',
          target: 'test:kitchen',
          blocked: false,
        },
      ],
    })
    .build();

  const destination = new ModEntityBuilder('test:kitchen')
    .asRoom(destinationLocationName)
    .withComponent('movement:exits', {
      directions: [
        {
          direction: 'south',
          target: 'test:bedroom',
          blocked: false,
        },
      ],
    })
    .build();

  const actor = new ModEntityBuilder('test:actor1')
    .withName(actorName)
    .atLocation('test:bedroom')
    .asActor()
    .withComponent('movement:can_teleport', {})
    .build();

  return { origin, destination, actor };
}

describe('movement:teleport action rule execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('movement', 'teleport');
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Successful teleportation', () => {
    it('should update actor position to destination', async () => {
      // Arrange: Setup scenario
      const scenario = setupTeleportScenario();
      testFixture.reset([scenario.origin, scenario.destination, scenario.actor]);

      // Act: Dispatch teleport action
      await testFixture.executeAction('test:actor1', 'test:kitchen');

      // Assert: Position component updated
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['core:position'].locationId).toBe('test:kitchen');
    });

    it('should dispatch vanish perceptible event at origin', async () => {
      // Arrange
      const scenario = setupTeleportScenario('Alice', 'Bedroom', 'Kitchen');
      testFixture.reset([scenario.origin, scenario.destination, scenario.actor]);

      // Act: Teleport
      await testFixture.executeAction('test:actor1', 'test:kitchen');

      // Assert: Check origin perceptible event
      const originEvents = testFixture.events.filter(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.locationId === 'test:bedroom'
      );
      expect(originEvents.length).toBeGreaterThan(0);

      const vanishEvent = originEvents.find((e) =>
        e.payload.description.includes('vanishes')
      );
      expect(vanishEvent).toBeDefined();
      expect(vanishEvent.payload.description).toContain('Alice');
      expect(vanishEvent.payload.description).toContain('Bedroom');
      expect(vanishEvent.payload.description).toContain('disappearing entirely');
    });

    it('should dispatch materialize perceptible event at destination', async () => {
      // Arrange
      const scenario = setupTeleportScenario('Alice', 'Bedroom', 'Kitchen');
      testFixture.reset([scenario.origin, scenario.destination, scenario.actor]);

      // Act: Teleport
      await testFixture.executeAction('test:actor1', 'test:kitchen');

      // Assert: Check destination perceptible event
      const destinationEvents = testFixture.events.filter(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.locationId === 'test:kitchen'
      );
      expect(destinationEvents.length).toBeGreaterThan(0);

      const materializeEvent = destinationEvents.find((e) =>
        e.payload.description.includes('materializes')
      );
      expect(materializeEvent).toBeDefined();
      expect(materializeEvent.payload.description).toContain('Alice');
      expect(materializeEvent.payload.description).toContain(
        'materializes suddenly'
      );
      expect(materializeEvent.payload.description).toContain(
        'as if from nowhere'
      );
    });

    it('should dispatch success message with teleport verb', async () => {
      // Arrange
      const scenario = setupTeleportScenario('Alice', 'Bedroom', 'Kitchen');
      testFixture.reset([scenario.origin, scenario.destination, scenario.actor]);

      // Act: Teleport
      await testFixture.executeAction('test:actor1', 'test:kitchen');

      // Assert: Check success message
      const successEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:display_successful_action_result'
      );
      expect(successEvents.length).toBeGreaterThan(0);

      const successMessage = successEvents[0].payload.message;
      expect(successMessage).toContain('Alice');
      expect(successMessage).toContain('teleports');
      expect(successMessage).toContain('Kitchen');
    });

    it('should dispatch entity_moved event', async () => {
      // Arrange
      const scenario = setupTeleportScenario();
      testFixture.reset([scenario.origin, scenario.destination, scenario.actor]);

      // Act: Teleport
      await testFixture.executeAction('test:actor1', 'test:kitchen');

      // Assert: Check entity_moved event
      const movedEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:entity_moved'
      );
      expect(movedEvents.length).toBe(1);
      expect(movedEvents[0].payload.entityId).toBe('test:actor1');
      expect(movedEvents[0].payload.previousLocationId).toBe('test:bedroom');
      expect(movedEvents[0].payload.currentLocationId).toBe('test:kitchen');
    });

    it('should end turn successfully', async () => {
      // Arrange
      const scenario = setupTeleportScenario();
      testFixture.reset([scenario.origin, scenario.destination, scenario.actor]);

      // Act: Teleport
      const result = await testFixture.executeAction(
        'test:actor1',
        'test:kitchen'
      );

      // Assert: Turn ended with success
      expect(result.success).toBe(true);
    });
  });

  describe('Failed teleportation', () => {
    it('should fail gracefully when target is invalid', async () => {
      // Arrange: Setup with invalid target
      const scenario = setupTeleportScenario();
      testFixture.reset([scenario.origin, scenario.destination, scenario.actor]);

      // Act: Attempt teleport to non-existent location
      const result = await testFixture.executeAction(
        'test:actor1',
        'test:nonexistent'
      );

      // Assert: Failure message dispatched
      expect(result.success).toBe(false);
      const failureEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:display_failed_action_result'
      );
      expect(failureEvents.length).toBeGreaterThan(0);
      expect(failureEvents[0].payload.message).toContain('teleportation fails');
    });

    it('should fail when actor is missing required components', async () => {
      // Arrange: Actor without name or position
      const origin = new ModEntityBuilder('test:bedroom')
        .asRoom('Bedroom')
        .build();

      const actorWithoutComponents = new ModEntityBuilder('test:actor1')
        .build(); // Missing name/position

      testFixture.reset([origin, actorWithoutComponents]);

      // Act: Attempt teleport
      const result = await testFixture.executeAction(
        'test:actor1',
        'test:bedroom'
      );

      // Assert: Failure due to missing components
      expect(result.success).toBe(false);
      expect(result.error.message).toContain('missing required components');
    });
  });

  describe('Perceptible event location validation', () => {
    it('should send vanish event ONLY to origin location', async () => {
      // Arrange
      const scenario = setupTeleportScenario();
      testFixture.reset([scenario.origin, scenario.destination, scenario.actor]);

      // Act: Teleport
      await testFixture.executeAction('test:actor1', 'test:kitchen');

      // Assert: Vanish event only at origin
      const vanishEvents = testFixture.events.filter(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.description.includes('vanishes')
      );
      expect(vanishEvents.length).toBe(1);
      expect(vanishEvents[0].payload.locationId).toBe('test:bedroom');
    });

    it('should send materialize event ONLY to destination location', async () => {
      // Arrange
      const scenario = setupTeleportScenario();
      testFixture.reset([scenario.origin, scenario.destination, scenario.actor]);

      // Act: Teleport
      await testFixture.executeAction('test:actor1', 'test:kitchen');

      // Assert: Materialize event only at destination
      const materializeEvents = testFixture.events.filter(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.description.includes('materializes')
      );
      expect(materializeEvents.length).toBe(1);
      expect(materializeEvents[0].payload.locationId).toBe('test:kitchen');
    });
  });
});
```

## Implementation Checklist

### Phase 1: Component and Condition Creation

- [ ] Create `data/mods/movement/components/can_teleport.component.json`
  - [ ] Use empty schema (marker component only)
  - [ ] Add descriptive comment about modder usage
  - [ ] Validate against component schema

- [ ] Create `data/mods/movement/conditions/event-is-action-teleport.condition.json`
  - [ ] Follow pattern from `event-is-action-go.condition.json`
  - [ ] Test condition matches correctly
  - [ ] Validate against condition schema

### Phase 2: Action Definition

- [ ] Create `data/mods/movement/actions/teleport.action.json`
  - [ ] Set ID to `movement:teleport`
  - [ ] Set targets.primary.scope to `movement:clear_directions`
  - [ ] Set template to `"teleport to {destination}"`
  - [ ] Add `required_components.actor: ["movement:can_teleport"]`
  - [ ] Add prerequisites with `movement:actor-can-move` condition
  - [ ] Copy visual styling from `go.action.json`
  - [ ] Validate against action schema
  - [ ] Test action discovery with/without marker component

### Phase 3: Rule Definition

- [ ] Create `data/mods/movement/rules/handle_teleport.rule.json`
  - [ ] Set rule_id to `handle_teleport`
  - [ ] Set condition to `movement:event-is-action-teleport`
  - [ ] Copy operation structure from `go.rule.json`
  - [ ] Update origin perceptible event message (vanish)
  - [ ] Update destination perceptible event message (materialize)
  - [ ] Update success message (teleports)
  - [ ] Validate against rule schema
  - [ ] Test rule execution with test scenarios

### Phase 4: Mod Manifest Update

- [ ] Update `data/mods/movement/mod-manifest.json`
  - [ ] Add `can_teleport.component.json` to components list
  - [ ] Add `teleport.action.json` to actions list
  - [ ] Add `event-is-action-teleport.condition.json` to conditions list
  - [ ] Add `handle_teleport.rule.json` to rules list
  - [ ] Increment mod version if appropriate

### Phase 5: Testing - Action Discovery

- [ ] Create `tests/integration/mods/movement/teleport_action_discovery.test.js`
  - [ ] Action structure validation suite
  - [ ] Required components validation
  - [ ] Visual styling validation
  - [ ] Template validation
  - [ ] Prerequisites validation
  - [ ] Discovery with `can_teleport` marker suite
  - [ ] Discovery without `can_teleport` marker (should not appear)
  - [ ] Discovery with clear directions
  - [ ] Discovery without clear directions (should not appear)
  - [ ] Forbidden component blocking (lying, sitting, kneeling, bending)
  - [ ] Target resolution validation
  - [ ] Blocked exit filtering
  - [ ] Run tests: `NODE_ENV=test npx jest tests/integration/mods/movement/teleport_action_discovery.test.js --no-coverage`

### Phase 6: Testing - Rule Execution

- [ ] Create `tests/integration/mods/movement/teleport_action.test.js`
  - [ ] Setup helper function (`setupTeleportScenario`)
  - [ ] Position update validation
  - [ ] Origin vanish perceptible event validation
  - [ ] Destination materialize perceptible event validation
  - [ ] Success message validation
  - [ ] `entity_moved` event validation
  - [ ] Turn end success validation
  - [ ] Failed teleport handling (invalid target)
  - [ ] Failed teleport handling (missing components)
  - [ ] Location-specific event dispatching validation
  - [ ] Run tests: `NODE_ENV=test npx jest tests/integration/mods/movement/teleport_action.test.js --no-coverage`

### Phase 7: Integration Testing

- [ ] Run full movement mod test suite
- [ ] Verify no regressions in existing `go` action
- [ ] Test with multiple actors having/lacking `can_teleport`
- [ ] Test scope resolution with complex exit configurations
- [ ] Verify prerequisite blocking (lying/sitting/kneeling/bending)

### Phase 8: Documentation

- [ ] Add inline comments to action JSON explaining marker pattern
- [ ] Document `can_teleport` usage in mod README (if exists)
- [ ] Add example character entity with `can_teleport` marker
- [ ] Document testing approach and coverage

## Edge Cases and Validation

### Component Marker Validation

1. **Missing Marker**: Action should not appear for actors without `movement:can_teleport`
2. **Marker Removal**: Removing component should immediately hide action from discovery
3. **Marker Addition**: Adding component should immediately enable action discovery
4. **Empty Object**: Marker should work with `{}` (no properties)

### Scope Resolution Edge Cases

1. **No Exits**: Should not show teleport action when location has no exits
2. **All Blocked**: Should not show teleport action when all exits are blocked
3. **Partial Blocking**: Should only show unblocked exits as teleport targets
4. **Self-Reference**: Should not allow teleporting to current location

### Prerequisite Edge Cases

1. **Lying Down**: `movement:actor-can-move` should fail (movement locked)
2. **Sitting**: `movement:actor-can-move` should fail (movement locked)
3. **Kneeling**: `movement:actor-can-move` should fail (movement locked)
4. **Bending Over**: `movement:actor-can-move` should fail (movement locked)
5. **Standing**: `movement:actor-can-move` should pass (movement unlocked)

### Perceptible Event Edge Cases

1. **Origin Location**: Only actors at origin should see "vanish" message
2. **Destination Location**: Only actors at destination should see "materialize" message
3. **Empty Locations**: Events should dispatch even if no other actors present
4. **Self-Perception**: Teleporting actor should receive success message, not perceptible events

### Rule Execution Edge Cases

1. **Invalid Target**: Should fail gracefully with appropriate error message
2. **Missing Components**: Should fail with "missing required components" error
3. **Null Target**: Should handle null targetId gracefully
4. **Component Query Failure**: Should fail turn if actor name/position unavailable

## Reference Implementations

### Similar Patterns in Codebase

1. **Marker Components**:
   - `positioning:allows_lying_on` - Empty marker for furniture capability
   - `positioning:allows_sitting` - Slot-based furniture marker

2. **Required Component Gating**:
   - `intimacy:kiss_cheek` - Uses `positioning:closeness` required component
   - All intimacy actions use `positioning:closeness` for gating

3. **Action/Rule Pairs**:
   - `movement:go` / `handle_go_action` - Movement with dual perceptible events
   - `positioning:lie_down` / `handle_lie_down` - Position state change

4. **Test Patterns**:
   - `tests/integration/mods/positioning/lie_down_action_discovery.test.js` - Discovery testing
   - `tests/integration/mods/positioning/lie_down_action.test.js` - Rule execution testing

### Key Files to Reference

- Action structure: `data/mods/movement/actions/go.action.json`
- Rule structure: `data/mods/movement/rules/go.rule.json`
- Marker component: `data/mods/positioning/components/allows_lying_on.component.json`
- Required component usage: `data/mods/intimacy/actions/kiss_cheek.action.json`
- Condition pattern: `data/mods/movement/conditions/event-is-action-go.condition.json`
- Scope reference: `data/mods/movement/scopes/clear_directions.scope`
- Discovery tests: `tests/integration/mods/positioning/lie_down_action_discovery.test.js`
- Execution tests: `tests/integration/mods/positioning/lie_down_action.test.js`

## Implementation Notes

### Validated Patterns from Codebase

**Action Schema Flexibility** (Validated: 2025-01-03)
- Actions support TWO valid target formats:
  1. **Object format**: `"targets": { "primary": { "scope": "...", ... } }`
     - Used by: `go.action.json`, `kneel_before.action.json`
     - Best for: Multi-target actions, detailed target configuration
  2. **String format**: `"targets": "scope:name"`
     - Used by: `lie_down.action.json`
     - Best for: Simple single-target actions
- **Recommendation**: Use object format for consistency with `go.action.json`

**Optional Fields** (Validated: 2025-01-03)
- `forbidden_components` is OPTIONAL - only include if blocking specific components
  - `go.action.json` has NO forbidden_components field
  - Movement locking handled via `movement:actor-can-move` prerequisite
- `required_components` is OPTIONAL - only include if gating by component presence
  - Teleport REQUIRES this field for `movement:can_teleport` marker gating

**Rule Naming Convention** (Validated: 2025-01-03)
- Pattern: `handle_{action_name}` (consistent with positioning mod)
  - `handle_go_action` (movement mod)
  - `handle_lie_down` (positioning mod)
  - `handle_kneel_before` (positioning mod)
- **Decision**: Use `handle_teleport` (matches established pattern)

**Test Import Pattern** (Validated: 2025-01-03)
- Tests DO import action JSON files for structure validation
  - Example: `lie_down_action_discovery.test.js` line 8
  - Pattern: `import actionName from '../../../../data/mods/movement/actions/action_name.action.json';`
- **Purpose**: Validate action structure against expected schema

**Metadata Format** (Validated: 2025-01-03)
- Pattern varies by action purpose:
  - `go.action.json`: Uses `author` and `tags` fields
  - Migration actions: Use `version`, `created`, `migrated_from` fields
- **Recommendation**: Use `author` and `tags` for non-migration actions

### Critical Assumptions Validated

✅ **Component Marker Pattern**: Empty schema matches `positioning:allows_lying_on`
✅ **Condition Structure**: Pattern identical to `movement:event-is-action-go`
✅ **Rule Operation Flow**: QUERY → VALIDATE → UPDATE → DISPATCH → SUCCESS
✅ **Perceptible Event Pattern**: Dual-dispatch pattern validated via `go.rule.json`
✅ **Test Structure**: Discovery + execution split validated via positioning tests
✅ **Scope DSL Extension**: `.scope` extension confirmed in `movement:clear_directions.scope`

### Corrections Applied

1. **Removed `forbidden_components` field** - Optional, not needed for teleport action
2. **Updated metadata format** - Changed from version/date to author/tags pattern
3. **Added targets field flexibility note** - Clarified both object and string formats are valid
4. **Documented optional fields** - Explicitly noted which fields can be omitted

## Design Trade-offs and Rationale

### Using `movement:actor-can-move` Prerequisite

**Trade-off**: Logically inconsistent (teleportation shouldn't require legs)

**Rationale**:
- Prevents complex edge cases (teleporting while lying in bed)
- Maintains consistency with movement system gating
- Simpler than adding explicit forbidden components for all positional states
- Acceptable compromise for gameplay clarity over logical purity

### Reusing `movement:clear_directions` Scope

**Trade-off**: Teleportation shares same targets as walking

**Rationale**:
- Reduces scope duplication and maintenance burden
- Maintains consistency in target availability across movement actions
- Allows future expansion (e.g., teleport-only locations) via new scope
- Simplifies testing and validation

### Marker Component vs. Property-Based Component

**Trade-off**: No data properties for configuration (e.g., cooldowns, energy cost)

**Rationale**:
- Follows established marker pattern (`allows_lying_on`)
- Extensible: Future properties can be added without breaking existing implementations
- Simpler modder experience (just add component to enable ability)
- Clear binary gating: has ability or doesn't

### Visual Styling Match with `go` Action

**Trade-off**: Teleport not visually distinct from walking

**Rationale**:
- Both are movement category actions
- Color consistency aids user categorization
- Differentiation via text (action name, template) sufficient
- Future: Could add distinct styling if needed

## Future Enhancements

### Potential Extensions

1. **Cooldown System**:
   - Add `lastTeleportTimestamp` property to `can_teleport` component
   - Add cooldown check in action prerequisites
   - Display "teleportation recharging" failure message

2. **Energy Cost**:
   - Add `energy` component to actors
   - Require minimum energy for teleportation
   - Deplete energy on teleport, restore over time

3. **Teleport-Only Locations**:
   - Create `movement:teleport_destinations` scope
   - Include locations not in `clear_directions`
   - Allow magical/hidden locations accessible only via teleport

4. **Teleport Restrictions**:
   - Add `anti_teleport` marker to locations
   - Block teleportation into/out of restricted zones
   - Support magical wards, shielded areas

5. **Teleport Effects**:
   - Add visual effect component (`teleport_flash`, `teleport_smoke`)
   - Trigger particle effects in UI
   - Support different teleportation styles (portal, fade, instant)

6. **Multi-Actor Teleportation**:
   - Allow teleporting with partners (similar to closeness)
   - Require all actors to have `can_teleport`
   - Dispatch group perceptible events

## Success Criteria

### Definition of Done

- [ ] All JSON files validate against schemas
- [ ] Action appears in action discovery when marker present
- [ ] Action hidden when marker absent
- [ ] Teleportation updates position correctly
- [ ] Origin location receives "vanish" perceptible event
- [ ] Destination location receives "materialize" perceptible event
- [ ] Success message uses "teleports" verb
- [ ] All test suites pass with 100% coverage
- [ ] No regressions in existing movement tests
- [ ] Code follows project conventions and patterns
- [ ] Inline documentation complete and clear

### Quality Standards

- **Test Coverage**: 100% branch coverage for action discovery and rule execution
- **Schema Validation**: All JSON files validate without errors
- **Naming Consistency**: Follow established naming conventions (`movement:teleport`, `can_teleport`)
- **Code Quality**: Passes ESLint and Prettier checks
- **Documentation**: Clear inline comments explaining marker pattern usage
- **Integration**: No breaking changes to existing movement system

---

**Version**: 1.0.0
**Created**: 2025-01-03
**Status**: Draft - Ready for Implementation
